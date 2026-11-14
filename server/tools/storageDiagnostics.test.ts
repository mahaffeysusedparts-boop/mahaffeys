import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectStorageReport } from './storageDiagnostics.mjs';

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const diskStats = () => ({ blocks: 100n, bsize: 1024n, bfree: 30n, bavail: 25n });

describe('read-only host storage report', () => {
  it('reports root, Docker and actual app volume capacity without reading container secrets', () => {
    const calls: Array<{ file: string; args: string[] }> = [];
    const run = (file: string, args: string[]) => {
      calls.push({ file, args });
      if (file === '/usr/bin/lsblk') return JSON.stringify({ blockdevices: [{ path: '/dev/sda', size: 2000000000000, children: [{ path: '/dev/sda1', mountpoints: ['/mnt/data'] }] }] });
      if (args.includes('info')) return JSON.stringify('/mnt/data/docker');
      if (args.includes('compose')) return 'a'.repeat(64);
      if (args.includes('inspect')) return JSON.stringify({ name: '/mahaffeys-postgres', mounts: [{ Type: 'volume', Name: 'mahaffeys_mahaffeys-postgres-data', Source: '/mnt/data/docker/volumes/database/_data', Destination: '/var/lib/postgresql/data', RW: true, secret: 'never-return' }] });
      throw new Error('Unexpected operation');
    };
    const report = collectStorageReport(run, diskStats, (path: string) => path);
    expect(report.readOnly).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.dockerRoot).toBe('/mnt/data/docker');
    expect(report.filesystems.map((value: { path: string }) => value.path)).toEqual(['/', '/mnt/data', '/mnt/data/docker', '/mnt/data/docker/volumes/database/_data']);
    expect(report.filesystems[0]).toMatchObject({ totalBytes: 102400, usedBytes: 71680, freeBytes: 30720, availableBytes: 25600 });
    expect(JSON.stringify(report)).not.toContain('never-return');
    expect(calls.filter(call => call.file === '/usr/bin/docker').every(call => call.args.slice(0, 2).join(' ') === '--host unix:///var/run/docker.sock')).toBe(true);
    expect(calls.find(call => call.args.includes('inspect'))?.args).toContain('{"name":{{json .Name}},"mounts":{{json .Mounts}}}');
    expect(calls.flatMap(call => call.args).join(' ')).not.toMatch(/\.Config|\.Env|prune|restart|volume rm|mkfs/);
  });

  it('keeps partial diagnostics and hides subprocess stderr when access fails', () => {
    const report = collectStorageReport(() => { throw new Error('password=do-not-return'); }, diskStats, (path: string) => path);
    expect(report.errors).toHaveLength(3);
    expect(report.filesystems).toHaveLength(1);
    expect(JSON.stringify(report)).not.toContain('do-not-return');
  });

  it('rejects malformed container identifiers before Docker inspection', () => {
    let inspected = false;
    const run = (file: string, args: string[]) => {
      if (file === '/usr/bin/lsblk') return '{"blockdevices":[]}';
      if (args.includes('info')) return '"/var/lib/docker"';
      if (args.includes('compose')) return 'abc;reboot';
      inspected = true;
      return '';
    };
    const report = collectStorageReport(run, diskStats, (path: string) => path);
    expect(inspected).toBe(false);
    expect(report.errors).toHaveLength(1);
  });

  it('marks inaccessible filesystems instead of reporting fake capacity', () => {
    const run = (file: string, args: string[]) => {
      if (file === '/usr/bin/lsblk') return '{"blockdevices":[]}';
      if (args.includes('info')) return '"/var/lib/docker"';
      return '';
    };
    const report = collectStorageReport(run, () => { throw new Error('permission denied'); }, (path: string) => path);
    expect(report.filesystems.every((value: { error?: string }) => value.error)).toBe(true);
    expect(report.filesystems[0]).not.toHaveProperty('availableBytes');
  });

  it('syntax-checks helper and installer without executing installation', () => {
    for (const path of ['./storageDiagnostics.mjs', '../../scripts/install-mahaffeys-storage-diagnostics.mjs']) {
      const result = spawnSync(process.execPath, ['--check', source(path)], { encoding: 'utf8' });
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
    }
  });

  it('retains fixed read-only operation routing and guarded installation', () => {
    const dispatcher = readFileSync(source('../../scripts/mahaffeys-diagnostics.sh'), 'utf8');
    const installer = readFileSync(source('../../scripts/install-mahaffeys-storage-diagnostics.mjs'), 'utf8');
    expect(dispatcher).toContain('exec /usr/bin/timeout 18 /usr/bin/node /usr/local/lib/mahaffeys/storage-report.mjs');
    expect(installer).toContain('ENABLE STORAGE DIAGNOSTICS');
    expect(installer).toContain('process.getuid?.() !== 0');
    expect(installer).toContain('constants.O_NOFOLLOW');
    expect(installer).toContain('Previous installed files restored.');
    expect(installer).not.toMatch(/writeFile\(authorized|usermod|mkfs|mount\(|prune/);
  });
});
