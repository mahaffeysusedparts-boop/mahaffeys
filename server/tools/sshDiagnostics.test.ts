import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { checkSshFiles, localEvidenceRequests, readSshTrace, redactLogs, requestToken, sshArgs, sshFailure, type DiagnosticRequest } from './sshDiagnostics';

const files = { identityFile: 'C:\\Users\\jackh\\.ssh\\mahaffeys_mcp', knownHostsFile: 'C:\\Users\\jackh\\.ssh\\known_hosts' };

describe('read-only SSH diagnostics', () => {
  it('accepts only approved diagnostic tokens and bounded logs', () => {
    expect(requestToken({ operation: 'logs', service: 'cups', lines: 60 })).toBe('logs:cups:60');
    expect(requestToken({ operation: 'cups' })).toBe('cups');
    expect(() => requestToken({ operation: 'restart' } as unknown as DiagnosticRequest)).toThrow();
    expect(() => requestToken({ operation: 'logs', service: 'cups; reboot', lines: 60 } as unknown as DiagnosticRequest)).toThrow();
    for (const lines of [0, 9, 201, 1.5, NaN]) expect(() => requestToken({ operation: 'logs', service: 'cups', lines })).toThrow();
  });

  it('uses fixed server, strict host verification, and key-only noninteractive authentication', () => {
    const args = sshArgs({ operation: 'containers' }, files);
    expect(args).toContain('StrictHostKeyChecking=yes');
    expect(args).toContain('BatchMode=yes');
    expect(args).toContain('PasswordAuthentication=no');
    expect(args).toContain('IdentitiesOnly=yes');
    expect(args.slice(-2)).toEqual(['jhilliard@192.168.1.210', 'containers']);
    expect(args).toContain(files.identityFile);
    expect(args).toContain(`UserKnownHostsFile=${files.knownHostsFile}`);
  });

  it('limits local evidence checks to version and public fingerprint reads', () => {
    const checks = localEvidenceRequests(files);
    expect(checks.map(check => check.executable)).toEqual(['ssh', 'ssh-add', 'ssh-keygen']);
    expect(checks[0].args).toEqual(['-V']);
    expect(checks[1].args).toEqual(['-l', '-E', 'sha256']);
    expect(checks[2].args).toEqual(['-l', '-f', `${files.identityFile}.pub`, '-E', 'sha256']);
  });

  it('redacts common credentials from diagnostics', () => {
    const output = redactLogs('NITRO_DATABASE_URL=postgresql://user:pass@database/yard PASSWORD="hidden value" token=secret Authorization: Bearer abc.def\n-----BEGIN OPENSSH PRIVATE KEY-----\nprivate\n-----END OPENSSH PRIVATE KEY-----');
    expect(output).not.toContain('user:pass');
    expect(output).not.toContain('hidden value');
    expect(output).not.toContain('abc.def');
    expect(output).not.toContain('token=secret');
    expect(output).not.toContain('\nprivate\n');
  });

  it('does not recommend bypassing host verification or password authentication', () => {
    expect(sshFailure('Host key verification failed.')).toContain('Host verification has not been bypassed');
    expect(sshFailure('Permission denied (publickey).')).toContain('Password login is intentionally disabled');
  });

  it('checks missing paths and wrong key formats without revealing key contents', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'ssh-preflight-test-'));
    const localFiles = { identityFile: join(directory, 'key'), knownHostsFile: join(directory, 'known_hosts') };
    try {
      await expect(checkSshFiles(localFiles)).rejects.toThrow('Cannot open the private key');
      await writeFile(localFiles.identityFile, 'ssh-ed25519 PUBLIC_DATA_DO_NOT_RETURN');
      await expect(checkSshFiles(localFiles)).rejects.toThrow('not an OpenSSH private key');
      await writeFile(localFiles.identityFile, '-----BEGIN OPENSSH PRIVATE KEY-----\nPRIVATE_DATA_DO_NOT_RETURN');
      await expect(checkSshFiles(localFiles)).rejects.toThrow('known_hosts.txt');
      await writeFile(localFiles.knownHostsFile, '192.168.1.210 ssh-ed25519 PUBLIC_HOST_KEY');
      await expect(checkSshFiles(localFiles)).resolves.toBeUndefined();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('reads only a bounded, redacted tail of the temporary OpenSSH trace', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'ssh-trace-test-'));
    const trace = join(directory, 'connection.log');
    try {
      await writeFile(trace, 'x'.repeat(80 * 1024) + '\nPermission denied (publickey). token=PRIVATE_TOKEN\n');
      const output = await readSshTrace(trace);
      expect(output.length).toBeLessThanOrEqual(64 * 1024);
      expect(output).toContain('Permission denied (publickey)');
      expect(output).not.toContain('PRIVATE_TOKEN');
      expect(await readSshTrace(join(directory, 'missing'))).toBe('');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform === 'win32')('rejects hostile remote requests before touching Docker', () => {
    const script = fileURLToPath(new URL('../../scripts/mahaffeys-diagnostics.sh', import.meta.url));
    for (const token of ['restart', 'logs:cups:201', 'logs:cups:60;reboot', 'logs:unknown:60', 'containers\nreboot', 'logs:cups:10:extra']) {
      const result = spawnSync('/bin/sh', [script], { env: { PATH: '/usr/bin:/bin', SSH_ORIGINAL_COMMAND: token }, encoding: 'utf8' });
      expect(result.status).toBe(2);
      expect(result.stdout).toBe('');
    }
  });

  it('starts the stdio bridge and lists only read-only tools without contacting SSH', async () => {
    const client = new Client({ name: 'bridge-test', version: '1.0.0' });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [fileURLToPath(new URL('./mahaffeys-mcp.mjs', import.meta.url))],
      cwd: tmpdir(),
      stderr: 'pipe',
    });
    try {
      await client.connect(transport);
      const result = await client.listTools();
      expect(result.tools).toHaveLength(6);
      expect(result.tools.every(tool => tool.annotations?.readOnlyHint === true)).toBe(true);
      expect(result.tools.some(tool => /deploy|restart|exec|shell/.test(tool.name))).toBe(false);
      const invalid = await client.callTool({ name: 'mahaffeys_container_logs', arguments: { service: 'cups;reboot' } });
      expect(invalid.isError).toBe(true);
    } finally {
      await client.close();
    }
  });
});
