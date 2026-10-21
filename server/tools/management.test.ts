import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseCommand, validateManifest, deploymentOnlyManifest, digest } from './management/policy.mjs';
import { redact } from './management/operations.mjs';
import { managementRequestSchema, managementToken } from './managementProtocol';
import { managementRequest, managementTools } from './managementTools';
import { requestToken, sshArgs } from './sshDiagnostics';

const revision = 'a'.repeat(40);
const jobId = 'b'.repeat(32);
const baseline = () => ({
  name: 'mahaffeys',
  services: {
    mahaffeys: { image: 'app', environment: { NITRO_CUPS_SERVER: 'cups:631' }, volumes: [{ type: 'volume', source: 'images', target: '/var/lib/images' }], healthcheck: { test: ['CMD', 'node', 'health'] } },
    cups: { image: 'cups', volumes: [{ type: 'volume', source: 'config', target: '/etc/cups' }], ports: [{ published: '631', target: 631 }] },
    postgres: { image: 'postgres:16', volumes: [{ type: 'volume', source: 'data', target: '/var/lib/postgresql/data' }] },
  },
  volumes: { config: { name: 'mahaffeys_config' }, images: { name: 'mahaffeys_images' }, data: { name: 'mahaffeys_data' } },
});
function candidate() {
  const value: any = baseline();
  value.services.mahaffeys.environment.NITRO_CUPS_SERVER = '/run/mahaffeys-cups/cups.sock';
  value.services.mahaffeys.volumes.push({ type: 'volume', source: 'cups-transport', target: '/run/mahaffeys-cups', read_only: true });
  value.services.cups.volumes.push({ type: 'volume', source: 'cups-transport', target: '/run/mahaffeys-cups' });
  value.volumes['cups-transport'] = { name: 'mahaffeys_cups-transport' };
  return value;
}

describe('guarded management protocol', () => {
  it('syntax-checks the installed worker and administrator installer without executing them', () => {
    for (const path of ['./management/runner.mjs', '../../scripts/install-mahaffeys-management.mjs']) {
      const result = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(path, import.meta.url))], { encoding: 'utf8' });
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
    }
  });
  it('uses exact validated revisions/job IDs and rejects command injection', () => {
    expect(parseCommand(`mgmt:prepare:${revision}`)).toEqual({ action: 'prepare', target: revision });
    expect(parseCommand(`mgmt:deploy:${jobId}`)).toEqual({ action: 'deploy', target: jobId });
    for (const token of ['restart', 'mgmt:exec:ls', `mgmt:prepare:${revision};reboot`, `mgmt:status:${jobId}\nreboot`, 'mgmt:prepare:main', `mgmt:rollback:${revision}`, `mgmt:status:../${jobId}`]) expect(() => parseCommand(token)).toThrow();
  });
  it('requires explicit write confirmations and rejects surplus fields', () => {
    const request = managementRequest('mahaffeys_prepare_deployment', { revision, confirmation: 'RUN VERIFIED TESTS' });
    expect(managementToken(request)).toBe(`mgmt:prepare:${revision}`);
    expect(requestToken(request)).toBe(`mgmt:prepare:${revision}`);
    for (const args of [{ revision }, { revision, confirmation: 'yes' }, { revision, confirmation: 'RUN VERIFIED TESTS', shell: 'reboot' }, { revision, confirmation: 'RUN VERIFIED TESTS', action: 'deploy' }]) expect(() => managementRequest('mahaffeys_prepare_deployment', args)).toThrow();
    expect(managementRequestSchema.safeParse({ operation: 'management', action: 'deploy', jobId, confirmation: 'DEPLOY APPROVED PLAN' }).success).toBe(true);
  });
  it('keeps SSH strict and marks all write tools as requiring approval', () => {
    const request = managementRequest('mahaffeys_management_status', { jobId });
    const args = sshArgs(request, { identityFile: '/keys/management', knownHostsFile: '/keys/known_hosts' });
    expect(args).toContain('StrictHostKeyChecking=yes');
    expect(args).toContain('PasswordAuthentication=no');
    expect(args.slice(-2)).toEqual(['jhilliard@192.168.1.210', `mgmt:status:${jobId}`]);
    expect(managementTools.filter(tool => tool.name !== 'mahaffeys_management_status').every(tool => tool.annotations.readOnlyHint === false && tool.annotations.destructiveHint === true)).toBe(true);
  });
  it('lists management tools only in explicitly enabled mode and rejects invalid writes before SSH', async () => {
    const client = new Client({ name: 'management-test', version: '1.0.0' });
    const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('./mahaffeys-mcp.mjs', import.meta.url)), '--enable-management', '--management-identity-file', join(tmpdir(), 'management-only-key')], stderr: 'pipe' });
    try {
      await client.connect(transport);
      const result = await client.listTools();
      expect(result.tools).toHaveLength(10);
      expect(result.tools.find(tool => tool.name === 'mahaffeys_deploy_prepared')?.annotations?.readOnlyHint).toBe(false);
      const invalid = await client.callTool({ name: 'mahaffeys_deploy_prepared', arguments: { jobId, confirmation: 'yes' } });
      expect(invalid.isError).toBe(true);
    } finally { await client.close(); }
  });
});

describe('restricted deployment manifest', () => {
  it('accepts only protected socket additions and managed versioned configuration', () => {
    expect(() => validateManifest(baseline(), candidate())).not.toThrow();
    expect(digest({ b: 1, a: 2 })).toBe(digest({ a: 2, b: 1 }));
  });
  it('normalizes only checkout-relative unmanaged build contexts without mutating manifests', () => {
    const before: any = baseline();
    const after = candidate();
    const roots = { baseline: join(tmpdir(), 'live-checkout'), candidate: join(tmpdir(), 'isolated-checkout') };
    before.services.worker = { build: { context: join(roots.baseline, 'vision-worker'), dockerfile: 'Dockerfile' } };
    after.services.worker = { build: { context: join(roots.candidate, 'vision-worker'), dockerfile: 'Dockerfile' } };
    const hashes = [digest(before), digest(after)];
    expect(() => validateManifest(before, after, roots)).not.toThrow();
    expect([digest(before), digest(after)]).toEqual(hashes);
    for (const change of [
      { context: join(roots.candidate, 'other-worker'), dockerfile: 'Dockerfile' },
      { context: join(roots.candidate, 'vision-worker'), dockerfile: 'other.Dockerfile' },
      { context: join(roots.candidate, '..', 'outside'), dockerfile: 'Dockerfile' },
      { context: 'https://example.com/repository.git', dockerfile: 'Dockerfile' },
    ]) {
      after.services.worker.build = change;
      expect(() => validateManifest(before, after, roots)).toThrow();
    }
    after.services.worker.build = { context: join(roots.candidate, 'vision-worker'), dockerfile: 'Dockerfile' };
    after.services.postgres.environment = { UNAPPROVED: 'change' };
    expect(() => validateManifest(before, after, roots)).toThrow(/out of scope/);
  });
  it('removes dependency paths so Compose create cannot create/recreate a database or other service', () => {
    const full = candidate();
    full.services.mahaffeys.depends_on = { postgres: { condition: 'service_healthy' }, cups: { condition: 'service_started' } };
    full.services.mahaffeys.links = ['postgres'];
    const runtime = deploymentOnlyManifest(full);
    expect(Object.keys(runtime.services).sort()).toEqual(['cups', 'mahaffeys']);
    expect(runtime.services.mahaffeys.depends_on).toBeUndefined();
    expect(runtime.services.mahaffeys.links).toBeUndefined();
    expect(full.services.mahaffeys.depends_on.postgres).toBeDefined();
    expect(runtime.services.cups.volumes).toEqual(full.services.cups.volumes);
  });
  it.each(['privileged', 'cap_add', 'pid', 'devices', 'security_opt', 'ports', 'healthcheck', 'volumes_from', 'configs', 'secrets', 'command', 'entrypoint'])('rejects changes to %s', field => {
    const value = candidate();
    value.services.mahaffeys[field] = 'unsafe';
    expect(() => validateManifest(baseline(), value)).toThrow();
  });
  it('rejects root app execution, database changes, lost mounts, unsafe sockets and host binds', () => {
    const mutations = [
      (value: any) => { value.services.mahaffeys.user = 'root'; },
      (value: any) => { value.services.postgres.image = 'other'; },
      (value: any) => { value.services.cups.volumes.shift(); },
      (value: any) => { value.services.mahaffeys.volumes[1].read_only = false; },
      (value: any) => { value.services.cups.volumes[1].target = '/run/cups'; },
      (value: any) => { value.services.cups.volumes[1].type = 'bind'; },
      (value: any) => { value.volumes['cups-transport'].driver_opts = { device: '/' }; },
    ];
    for (const mutate of mutations) { const value = candidate(); mutate(value); expect(() => validateManifest(baseline(), value)).toThrow(); }
  });
  it('redacts credential patterns in bounded management errors', () => {
    const value = redact('postgresql://user:password@db/x token="hidden" Bearer abc.def\n-----BEGIN OPENSSH PRIVATE KEY-----\nprivate\n-----END OPENSSH PRIVATE KEY-----');
    for (const secret of ['user:password', '"hidden"', 'abc.def', '\nprivate\n']) expect(value).not.toContain(secret);
    expect(redact('x'.repeat(10_000)).length).toBeLessThanOrEqual(1600);
  });
});
