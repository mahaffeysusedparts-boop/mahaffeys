import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ request: vi.fn(), user: { id: 'journal-test' } }));
vi.mock('./apiClient', async original => ({ ...await original<typeof import('./apiClient')>(), apiRequest: mocks.request }));
vi.mock('./authService', () => ({ authService: { getCurrentUser: () => mocks.user } }));

beforeEach(() => { mocks.request.mockReset(); vi.resetModules(); mocks.user.id = crypto.randomUUID(); });
describe('immutable intake operations', () => {
  it('replays the same CREATE payload, client and key after response loss and module reload', async () => {
    mocks.request.mockRejectedValueOnce(new TypeError('response lost'));
    const first = await import('./intakeSubmissionService');
    await expect(first.submitIntakeCommand({ action: 'CREATE', id: 'TEST', ticket: { createdAt: 'original' } })).rejects.toThrow('response lost');
    const original = mocks.request.mock.calls[0][1].body;
    vi.resetModules();
    const resumed = await import('./intakeSubmissionService');
    expect(await resumed.pendingIntakeOperation('CREATE')).toMatchObject({ state: 'UNCERTAIN' });
    mocks.request.mockResolvedValueOnce({ id: 'TEST', buying: { revision: 1 } });
    await resumed.retryIntakeOperation('CREATE');
    expect(mocks.request.mock.calls[1][1].body).toBe(original);
    expect(await resumed.pendingIntakeOperation('CREATE')).toMatchObject({state:'CONFIRMED'});
    await resumed.acknowledgeIntakeOperation('CREATE');
    expect(await resumed.pendingIntakeOperation('CREATE')).toBeNull();
  });
  it('blocks changed inputs until an uncertain SAVE has been reconciled', async () => {
    mocks.request.mockRejectedValueOnce(new TypeError('response lost'));
    const service = await import('./intakeSubmissionService');
    await expect(service.submitIntakeCommand({ action: 'SAVE', id: 'TEST', ticket: { notes: 'first' } })).rejects.toThrow();
    await expect(service.submitIntakeCommand({ action: 'SAVE', id: 'TEST', ticket: { notes: 'changed' } })).rejects.toThrow('Reconcile');
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it('does not send when durable storage is unavailable', async () => {
    const storage = await import('./intakeDraftStorage');
    vi.spyOn(storage, 'intakeDraftAccess').mockRejectedValueOnce(new Error('denied'));
    const service = await import('./intakeSubmissionService');
    await expect(service.submitIntakeCommand({ action: 'CREATE', id: 'TEST' })).rejects.toThrow();
    expect(mocks.request).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
  it('keeps acknowledged payment evidence when cleanup fails and never sends payment again', async () => {
    const service = await import('./intakeSubmissionService');
    const paid = { id: 'TEST', buying: { revision: 2, stage: 'PAID' } };
    mocks.request.mockResolvedValueOnce(paid);
    await service.submitIntakeCommand({ action: 'PAY', id: 'TEST', reference: 'ACTUAL-CHECK' });
    const storage = await import('./intakeDraftStorage');
    vi.spyOn(storage, 'intakeDraftAccess').mockRejectedValueOnce(new Error('cleanup denied'));
    await expect(service.acknowledgeIntakeOperation('TEST')).rejects.toThrow('cleanup denied');
    vi.restoreAllMocks();
    vi.resetModules();
    const resumed = await import('./intakeSubmissionService');
    expect(await resumed.retryIntakeOperation('TEST')).toEqual(paid);
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
});
