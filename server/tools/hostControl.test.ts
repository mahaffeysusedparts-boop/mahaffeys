import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateControlRequest, isControlWrite } from './hostControlProtocol.mjs';
import { dispatchControl, redactControlOutput } from './hostControlGateway.mjs';
import { collectNetworkReport } from './networkDiagnostics.mjs';
import { managementRequest, managementTools } from './managementTools';
import { managementToken } from './managementProtocol';
import { parseCommand } from './management/policy.mjs';

const path = (value: string) => fileURLToPath(new URL(value, import.meta.url));

describe('bounded host control', () => {
  it('requires exact confirmations and forbids arbitrary service/path/command inputs', () => {
    expect(validateControlRequest({ action: 'restart', confirmation: 'RESTART APP' })).toEqual({ type: 'management', token: 'mgmt:restart:mahaffeys' });
    expect(parseCommand('mgmt:restart:mahaffeys')).toEqual({ action: 'restart', target: 'mahaffeys' });
    expect(managementToken(managementRequest('mahaffeys_restart_app', { confirmation: 'RESTART APP' }))).toBe('mgmt:restart:mahaffeys');
    for (const value of [
      { action: 'restart', confirmation: 'yes' }, { action: 'restart', confirmation: 'RESTART APP', service: 'postgres' },
      { action: 'diagnostics', report: 'network;reboot' }, { action: 'diagnostics', report: 'network', host: '127.0.0.1' },
      { action: 'shell', command: 'reboot' }, { action: 'prepare', revision: 'a'.repeat(40) + '\n', confirmation: 'RUN VERIFIED TESTS' },
      { action: 'status', jobId: '../private' }, { action: 'deploy', jobId: 'b'.repeat(32), confirmation: 'yes' },
    ]) expect(() => validateControlRequest(value)).toThrow();
    for (const token of ['mgmt:restart:postgres', 'mgmt:restart:mahaffeys\n', 'mgmt:restart:mahaffeys;reboot']) expect(() => parseCommand(token)).toThrow();
    expect(isControlWrite({ action: 'restart' })).toBe(true);
    expect(isControlWrite({ action: 'status' })).toBe(false);
    expect(managementTools.find(tool => tool.name === 'mahaffeys_restart_app')?.annotations.destructiveHint).toBe(true);
  });
  it('delegates only fixed installed programs with no shell or user-selected address', async () => {
    const calls: Array<{ file: string; args: string[]; options: any }> = [];
    const run = async (file: string, args: string[], options: any) => { calls.push({ file, args, options }); return { stdout: JSON.stringify({ jobId: 'b'.repeat(32), status: 'queued' }) }; };
    expect(await dispatchControl({ action: 'capabilities' }, run)).toMatchObject({ available: true });
    expect(calls).toHaveLength(0);
    await dispatchControl({ action: 'restart', confirmation: 'RESTART APP' }, run);
    expect(calls[0].file).toBe('/usr/bin/node');
    expect(calls[0].args).toEqual(['/usr/local/lib/mahaffeys/management/runner.mjs']);
    expect(calls[0].options.env.SSH_ORIGINAL_COMMAND).toBe('mgmt:restart:mahaffeys');
    expect(calls[0].options.timeout).toBe(25000);
    expect(calls[0].options).not.toHaveProperty('shell');
    await dispatchControl({ action: 'diagnostics', report: 'network' }, run);
    expect(calls[1].file).toBe('/usr/local/lib/mahaffeys/mahaffeys-diagnostics.sh');
    expect(calls[1].options.env.SSH_ORIGINAL_COMMAND).toBe('network');
  });
  it('keeps the existing deployment gate unchanged and limits restart to the existing app ID', () => {
    const operations = readFileSync(path('./management/operations.mjs'), 'utf8');
    const restart = operations.slice(operations.indexOf('export async function restartApp'), operations.indexOf('async function test('));
    expect(restart).toContain('await baselineManifest(policy)');
    expect(restart).toContain("await docker(['restart', '--time', '30', before.mahaffeys.id]");
    expect(restart).toContain('await health(before.mahaffeys.id)');
    expect(restart).not.toMatch(/compose\(|\['restart'.*cups|remove|prune/);
    const policy = readFileSync(path('./management/policy.mjs'), 'utf8');
    expect(policy).toContain("Only the protected, app-read-only CUPS transport volume may be added");
  });
  it('redacts common credentials but preserves a complete report', () => {
    const text = redactControlOutput('x'.repeat(10000) + '\npassword=private Bearer secret postgresql://user:pass@host/db');
    expect(text.length).toBeGreaterThan(10000);
    expect(text).not.toContain('password=private');
    expect(text).not.toContain('Bearer secret');
    expect(text).not.toContain('user:pass');
  });
  it('syntax-checks standalone host files without executing installation or live diagnostics', () => {
    for (const file of ['./networkDiagnostics.mjs', './hostControlGateway.mjs', './hostControlProtocol.mjs', './management/runner.mjs', '../../scripts/install-mahaffeys-host-control.mjs', '../../scripts/install-mahaffeys-storage-diagnostics.mjs']) {
      const result = spawnSync(process.execPath, ['--check', path(file)], { encoding: 'utf8' });
      expect(result.stderr).toBe(''); expect(result.status).toBe(0);
    }
    const gateway = readFileSync(path('./hostControlGateway.mjs'), 'utf8');
    expect(gateway).toContain('server.listen({ fd: 3 })');
    expect(gateway).toContain("process.env.LISTEN_FDS !== '1'");
    expect(gateway).not.toContain('listen(3010');
    const installer = readFileSync(path('../../scripts/install-mahaffeys-host-control.mjs'), 'utf8');
    expect(installer).toContain('ENABLE GUARDED HOST CONTROL');
    expect(installer).toContain("'operation.lock'), 'wx'");
    expect(installer).toContain('SocketMode=0660');
    expect(installer).not.toMatch(/usermod|authorized_keys|mkfs|prune/);
  });
});

describe('read-only network inventory', () => {
  it('selects interface/route metadata and resolver IPs without resolver options or process identities', () => {
    const calls: Array<{ file: string; args: string[] }> = [];
    const run = (file: string, args: string[]) => {
      calls.push({ file, args });
      if (args.includes('address')) return JSON.stringify([{ ifname: 'eno1', operstate: 'UP', addr_info: [{ local: '192.168.1.210', prefixlen: 24, family: 'inet', scope: 'global' }], secret: 'omit' }]);
      if (args.includes('route')) return JSON.stringify([{ dst: 'default', gateway: '192.168.1.1', dev: 'eno1' }]);
      if (args.includes('dns')) return 'Link 2 (eno1): 192.168.1.1';
      return 'tcp LISTEN 0 4096 0.0.0.0:22 0.0.0.0:*';
    };
    const report = collectNetworkReport(run, () => 'nameserver 127.0.0.53\nsearch private.example\noptions token=omit');
    expect(report.readOnly).toBe(true);
    expect(report.interfaces[0]).toMatchObject({ name: 'eno1', state: 'UP' });
    expect(report.routes[0].gateway).toBe('192.168.1.1');
    expect(report.resolverAddresses).toEqual(['127.0.0.53']);
    expect(JSON.stringify(report)).not.toContain('omit');
    expect(JSON.stringify(report)).not.toContain('private.example');
    expect(calls.some(call => call.args.includes('--processes'))).toBe(false);
    expect(calls.flatMap(call => call.args).join(' ')).not.toMatch(/ add | del | set |ping|curl/);
  });
  it('reports unavailable tools without leaking stderr or claiming network changes', () => {
    const report = collectNetworkReport(() => { throw new Error('token=private'); }, () => 'nameserver 1.1.1.1');
    expect(report.errors).toHaveLength(4);
    expect(report.resolverAddresses).toEqual(['1.1.1.1']);
    expect(JSON.stringify(report)).not.toContain('private');
  });
});
