import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ admin: vi.fn(), body: vi.fn(), origin: vi.fn(), call: vi.fn(), enabled: vi.fn(), limit: vi.fn(), audit: vi.fn() }));
vi.mock('nitro', () => ({ defineHandler: (handler: unknown) => handler }));
vi.mock('nitro/h3', () => ({
  createError: (error: { statusCode: number; statusMessage: string }) => Object.assign(new Error(error.statusMessage), error),
  readBody: mocks.body, assertBodySize: vi.fn(), setResponseHeader: vi.fn(),
  getRequestHeaders: () => ({ origin: mocks.origin() }), getRequestURL: () => new URL('https://yard.example/api/admin/server/control'),
}));
vi.mock('./auth', () => ({ requireAdmin: mocks.admin }));
vi.mock('./hostControl', () => ({ callHostControl: mocks.call, hostControlEnabled: mocks.enabled, limitHostControl: mocks.limit }));
vi.mock('./audit', () => ({ recordAudit: mocks.audit, auditFor: (_user: unknown, value: unknown) => value }));
import readCapabilities from '../routes/api/admin/server/control.get';
import actionRoute from '../routes/api/admin/server/control.post';
import restartRoute from '../routes/api/admin/server/restart.post';
const capabilities = readCapabilities as unknown as (event: object) => Promise<unknown>;
const action = actionRoute as unknown as (event: object) => Promise<unknown>;
const restart = restartRoute as unknown as (event: object) => Promise<unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockResolvedValue({ id: 'admin', role: 'admin' });
  mocks.origin.mockReturnValue('https://yard.example');
  mocks.enabled.mockReturnValue(true);
  mocks.body.mockResolvedValue({ action: 'diagnostics', report: 'network' });
  mocks.call.mockResolvedValue({ jobId: 'a'.repeat(32), status: 'queued' });
});
afterEach(() => { vi.unstubAllEnvs(); });

describe('administrator host control routes', () => {
  it('rejects non-admins and foreign origins before transport or audit', async () => {
    mocks.admin.mockRejectedValueOnce(Object.assign(new Error(), { statusCode: 403 }));
    await expect(action({})).rejects.toMatchObject({ statusCode: 403 });
    mocks.origin.mockReturnValue('https://foreign.example');
    await expect(action({})).rejects.toMatchObject({ statusCode: 403 });
    await expect(restart({})).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.call).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled();
  });
  it('validates action fields and confirmations before delegating', async () => {
    for (const body of [{ action: 'shell', command: 'reboot' }, { action: 'restart', confirmation: 'yes' }, { action: 'diagnostics', report: 'network', path: '/etc' }]) {
      mocks.body.mockResolvedValue(body);
      await expect(action({})).rejects.toMatchObject({ statusCode: 400 });
    }
    mocks.body.mockResolvedValue({ confirmation: 'yes' });
    await expect(restart({})).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.call).not.toHaveBeenCalled();
  });
  it('audits a confirmed restart and returns its real server job rather than false success', async () => {
    mocks.body.mockResolvedValue({ confirmation: 'RESTART APP' });
    await expect(restart({})).resolves.toEqual({ jobId: 'a'.repeat(32), status: 'queued' });
    expect(mocks.call).toHaveBeenCalledWith({ action: 'restart', confirmation: 'RESTART APP' });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'server.restart' }));
    mocks.call.mockRejectedValueOnce(Object.assign(new Error('Unavailable'), { statusCode: 503 }));
    await expect(restart({})).rejects.toMatchObject({ statusCode: 503 });
  });
  it('does not probe disabled preview connectors and handles installed-service failure honestly', async () => {
    mocks.enabled.mockReturnValue(false);
    await expect(capabilities({})).resolves.toMatchObject({ available: false });
    expect(mocks.call).not.toHaveBeenCalled();
    mocks.enabled.mockReturnValue(true); mocks.call.mockRejectedValueOnce(new Error('Unavailable'));
    await expect(capabilities({})).resolves.toMatchObject({ available: false });
  });
  it('never enables host access in development even if the production flag is set', async () => {
    const actual = await vi.importActual<typeof import('./hostControl')>('./hostControl');
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('NITRO_HOST_CONTROL_ENABLED', 'true');
    expect(actual.hostControlEnabled()).toBe(false);
    await expect(actual.callHostControl({ action: 'restart', confirmation: 'RESTART APP' })).rejects.toMatchObject({ statusCode: 503 });
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('NITRO_HOST_CONTROL_ENABLED', 'false');
    expect(actual.hostControlEnabled()).toBe(false);
  });
  it('rate-limits repeated writes and does not add audit noise for job polling', async () => {
    const actual = await vi.importActual<typeof import('./hostControl')>('./hostControl');
    const id = 'write-limit-test';
    for (let index = 0; index < 4; index++) actual.limitHostControl(id, true);
    expect(() => actual.limitHostControl(id, true)).toThrow('Too many');
    mocks.body.mockResolvedValue({ action: 'status', jobId: 'b'.repeat(32) });
    await action({});
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
