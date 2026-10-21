import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const entrypointPath = fileURLToPath(new URL('../../deploy/docker/cups-entrypoint.sh', import.meta.url));
const entrypoint = readFileSync(entrypointPath, 'utf8');
const compose = readFileSync(new URL('../../compose.yaml', import.meta.url), 'utf8');
const dockerfile = readFileSync(new URL('../../deploy/docker/cups.Dockerfile', import.meta.url), 'utf8');

describe('protected CUPS transport candidate', () => {
  it.skipIf(process.platform === 'win32')('has valid POSIX shell syntax', () => {
    const result = spawnSync('/bin/sh', ['-n', entrypointPath], { encoding: 'utf8' });
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('shares only a separately protected socket directory with a read-only app mount', () => {
    expect(compose).toContain('cups-transport:/run/mahaffeys-cups:ro');
    expect(compose).toContain('NITRO_CUPS_SERVER: /run/mahaffeys-cups/cups.sock');
    expect(compose).not.toMatch(/:\/run\/cups(?:\s|:|$)/m);
    expect(entrypoint).toContain('chown 0:1000 "$transport"');
    expect(entrypoint).toContain('chmod 0750 "$transport"');
    expect(entrypoint).toContain('/proc/self/mountinfo');
    expect(entrypoint).toContain('[ -L "$socket" ]');
    expect(entrypoint).toContain('! -name cups.sock');
    expect(entrypoint).not.toMatch(/chmod\s+0?777|AuthType\s+None|Allow\s+from\s+all/i);
  });

  it('matches the non-root peer identity without granting it a login or changing SystemGroup', () => {
    expect(dockerfile).toContain('useradd --uid 1000 --gid 1000 --groups lpadmin');
    expect(dockerfile).toContain('--shell /usr/sbin/nologin node');
    expect(entrypoint).toContain('/etc/cups/cups-files.conf');
    expect(entrypoint).toContain('no policy changes made');
    expect(entrypoint).toContain('before-protected-socket');
    expect(entrypoint).toContain('cupsd -t -c "$config"');
  });
});
