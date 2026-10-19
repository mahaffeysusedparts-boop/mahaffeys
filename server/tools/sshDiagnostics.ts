import { spawn } from 'node:child_process';
import { access, mkdtemp, open, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

export const SERVER_HOST = '192.168.1.210';
export const SERVER_USER = 'jhilliard';
export const SERVICES = ['mahaffeys', 'cups', 'nginx', 'postgres', 'storage-agent', 'vision-worker'] as const;
export type Service = typeof SERVICES[number];
export type DiagnosticRequest =
  | { operation: 'connection' | 'containers' | 'version' | 'cups' | 'printer' }
  | { operation: 'logs'; service: Service; lines: number };

export interface SshFiles {
  identityFile: string;
  knownHostsFile: string;
}

export function defaultSshFiles(): SshFiles {
  return {
    identityFile: join(homedir(), '.ssh', 'mahaffeys_mcp'),
    knownHostsFile: join(homedir(), '.ssh', 'known_hosts'),
  };
}

export function requestToken(request: DiagnosticRequest): string {
  if (request.operation === 'logs') {
    if (!SERVICES.includes(request.service) || !Number.isInteger(request.lines) || request.lines < 10 || request.lines > 200) {
      throw new Error('Choose an approved service and between 10 and 200 log lines.');
    }
    return `logs:${request.service}:${request.lines}`;
  }
  if (!['connection', 'containers', 'version', 'cups', 'printer'].includes(request.operation)) {
    throw new Error('Only read-only diagnostic operations are allowed.');
  }
  return request.operation;
}

export function sshArgs(request: DiagnosticRequest, files: SshFiles): string[] {
  return [
    '-F', 'none', '-T', '-p', '22',
    '-o', 'BatchMode=yes',
    '-o', 'PreferredAuthentications=publickey',
    '-o', 'PasswordAuthentication=no',
    '-o', 'KbdInteractiveAuthentication=no',
    '-o', 'StrictHostKeyChecking=yes',
    '-o', 'IdentitiesOnly=yes',
    '-o', 'ConnectTimeout=8',
    '-o', 'ConnectionAttempts=1',
    '-o', 'ServerAliveInterval=5',
    '-o', 'ServerAliveCountMax=2',
    '-o', `UserKnownHostsFile=${files.knownHostsFile}`,
    '-i', files.identityFile,
    `${SERVER_USER}@${SERVER_HOST}`,
    requestToken(request),
  ];
}

export function redactLogs(text: string): string {
  return text
    .replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[REDACTED]@')
    .replace(/\bBearer\s+[a-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\b((?:[a-z0-9_]*(?:password|passwd|secret|token|api_key|apikey|authorization)[a-z0-9_]*)\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/gi, '$1[REDACTED]')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, '[PRIVATE KEY REDACTED]');
}

export function sshFailure(message: string): string {
  if (/host key verification failed|REMOTE HOST IDENTIFICATION HAS CHANGED/i.test(message)) {
    return 'SSH host verification failed. Verify the server fingerprint through a trusted channel and configure your Windows known_hosts file. Host verification has not been bypassed.';
  }
  if (/permission denied.*publickey/i.test(message)) {
    return 'SSH key authentication failed. Authorize the dedicated public key for jhilliard and load its passphrase-protected private key into the Windows OpenSSH agent. Password login is intentionally disabled for this bridge.';
  }
  return redactLogs(message);
}

export async function runDiagnostic(request: DiagnosticRequest, files: SshFiles, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) throw new Error('Diagnostic request cancelled.');
  const executable = process.platform === 'win32'
    ? join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'OpenSSH', 'ssh.exe')
    : 'ssh';
  const args = sshArgs(request, files);
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const limit = 256 * 1024;
    let size = 0;
    let output = '';
    let errors = '';
    let stoppedReason = '';
    const stop = (reason: string) => {
      stoppedReason = reason;
      child.kill();
    };
    const timer = setTimeout(() => stop('SSH diagnostic timed out after 25 seconds.'), 25_000);
    const abort = () => stop('Diagnostic request cancelled.');
    signal?.addEventListener('abort', abort, { once: true });
    const cleanUp = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    };
    child.stdout.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) { stop('Diagnostic output exceeded 256 KB. Request fewer log lines.'); return; }
      output += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) { stop('Diagnostic output exceeded 256 KB. Request fewer log lines.'); return; }
      errors += chunk.toString('utf8');
    });
    child.once('error', error => {
      cleanUp();
      reject(new Error((error as NodeJS.ErrnoException).code === 'ENOENT'
        ? 'Windows OpenSSH Client is not installed or cannot be found. Enable it in Windows Optional Features before connecting.'
        : sshFailure(error.message)));
    });
    child.once('close', code => {
      cleanUp();
      if (stoppedReason) { reject(new Error(stoppedReason)); return; }
      if (code !== 0) { reject(new Error(sshFailure(errors || output || `SSH diagnostics exited with code ${code}.`))); return; }
      resolve(redactLogs(output + (errors ? `\nSSH notices:\n${errors}` : '')).trim());
    });
  });
}
