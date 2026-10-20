import { afterEach, describe, expect, it, vi } from 'vitest';
import { localProcessContext } from './sshDiagnostics';

afterEach(() => vi.unstubAllEnvs());

describe('SSH bridge process context', () => {
  it('reports runtime details and variable presence without values or unrelated secrets', () => {
    vi.stubEnv('SYSTEMROOT', 'PRIVATE_SYSTEM_ROOT_VALUE');
    vi.stubEnv('DIAGNOSTIC_SECRET', 'PRIVATE_SECRET_VALUE');
    const output = localProcessContext();
    expect(output).toContain(`Architecture: ${process.arch}`);
    expect(output).toContain(`Node: ${process.version}`);
    expect(output).toContain('SYSTEMROOT: present');
    expect(output).not.toContain('PRIVATE_SYSTEM_ROOT_VALUE');
    expect(output).not.toContain('PRIVATE_SECRET_VALUE');
    expect(output).not.toContain('DIAGNOSTIC_SECRET');
  });
});
