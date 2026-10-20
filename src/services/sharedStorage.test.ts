import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('./apiClient', async (importOriginal) => ({
  ...await importOriginal<typeof import('./apiClient')>(), apiRequest: mocks.request,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn() } }));
vi.mock('./diagnosticLogger', () => ({ diagnosticLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('./offlineQueue', () => ({ offlineQueue: {} }));

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  mocks.request.mockReset().mockResolvedValue({});
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  });
  vi.stubGlobal('window', { addEventListener: vi.fn(), dispatchEvent: vi.fn() });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function connectedStorage() {
  const { sharedStorage } = await import('./sharedStorage');
  mocks.request.mockResolvedValueOnce({ state: {} });
  await sharedStorage.hydrate();
  return sharedStorage;
}

describe('shared storage sync recovery', () => {
  it('retains every unuploaded batch item and reports failure to manual retry', async () => {
    const storage = await connectedStorage();
    storage.setItem('mahaffeys_customers', '[]');
    storage.setItem('mahaffeys_tools', '[]');
    mocks.request.mockRejectedValueOnce(new Error('Upload unavailable'));
    await expect(storage.flushNow()).rejects.toThrow('Upload unavailable');
    expect(storage.getStatus()).toBe('error');
    expect(storage.getPendingWriteCount()).toBe(2);
    await storage.flushNow();
    expect(storage.getPendingWriteCount()).toBe(0);
    expect(storage.getStatus()).toBe('connected');
    expect(storage.getLastError()).toBeNull();
    expect(mocks.request.mock.calls.map(([path]) => path)).toEqual([
      '/api/state', '/api/state/mahaffeys_customers/chunk',
      '/api/state/mahaffeys_customers/chunk', '/api/state/mahaffeys_tools/chunk',
    ]);
    storage.disconnect();
  });

  it('uploads newer edits made while a previous version is in flight', async () => {
    const storage = await connectedStorage();
    storage.setItem('mahaffeys_tools', '[{"id":"old"}]');
    let complete!: (value: unknown) => void;
    mocks.request.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const flushing = storage.flushNow();
    storage.setItem('mahaffeys_tools', '[{"id":"new"}]');
    complete({});
    await flushing;
    const bodies = mocks.request.mock.calls.slice(1).map(([, options]) => JSON.parse(options.body).chunk);
    expect(bodies).toEqual(['[{"id":"old"}]', '[{"id":"new"}]']);
    expect(storage.getPendingWriteCount()).toBe(0);
    storage.disconnect();
  });

  it('notifies newly mounted indicators immediately and exposes hydration failures', async () => {
    const storage = await connectedStorage();
    const listener = vi.fn();
    const unsubscribe = storage.subscribe(listener);
    expect(listener).toHaveBeenLastCalledWith('connected');
    mocks.request.mockRejectedValueOnce(new Error('Session expired'));
    await expect(storage.hydrate()).rejects.toThrow('Session expired');
    expect(storage.getStatus()).toBe('error');
    expect(storage.getLastError()).toBe('Session expired');
    unsubscribe();
    storage.disconnect();
  });

  it('reconciles rejected financial history, retains the rejected snapshot, and retries once', async () => {
    const storage = await connectedStorage();
    const { ApiError } = await import('./apiClient');
    const canonical = { id: 'history-1', ticketType: 'SCRAP_METAL', status: 'COMPLETED', finalPayout: 150, scrapLines: [{ id: 'line-1', amount: 150 }], updatedAt: '2025-01-01' };
    const stale = { ...canonical, finalPayout: 0, scrapLines: [], updatedAt: '2026-01-01', notes: 'Keep this note' };
    storage.setItem('mahaffeys_tickets', JSON.stringify([stale]));
    mocks.request
      .mockRejectedValueOnce(new ApiError('Historical financial meaning cannot be replaced by generic state writes', 409))
      .mockResolvedValueOnce({ state: { mahaffeys_tickets: [canonical] } })
      .mockResolvedValueOnce({});
    await storage.flushNow();
    const repaired = JSON.parse(mocks.request.mock.calls[3][1].body).chunk;
    expect(JSON.parse(repaired)[0]).toMatchObject({ finalPayout: 150, scrapLines: canonical.scrapLines, notes: 'Keep this note' });
    expect(storage.getRejectedFinancialSnapshots()).toEqual({ mahaffeys_tickets: JSON.stringify([stale]) });
    expect(storage.getPendingWriteCount()).toBe(0);
    expect(storage.getStatus()).toBe('connected');
    storage.disconnect();
    expect(storage.getRejectedFinancialSnapshots()).toEqual({});
  });

  it('pauses permanent rejections without blocking unrelated uploads or retrying on a timer', async () => {
    const storage = await connectedStorage();
    const { ApiError } = await import('./apiClient');
    storage.setItem('mahaffeys_tickets', '[{"id":"invalid-ticket"}]');
    storage.setItem('mahaffeys_tools', '[]');
    mocks.request.mockRejectedValueOnce(new ApiError('New scrap tickets must use the buying API', 409));
    await expect(storage.flushNow()).rejects.toThrow('buying API');
    expect(storage.getBlockedWriteCount()).toBe(1);
    expect(storage.getPendingWriteCount()).toBe(1);
    expect(mocks.request.mock.calls.map(([path]) => path)).toContain('/api/state/mahaffeys_tools/chunk');
    const requests = mocks.request.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.request).toHaveBeenCalledTimes(requests);
    storage.disconnect();
  });

  it('keeps protected history during hydration despite a newer local timestamp', async () => {
    const { sharedStorage: storage } = await import('./sharedStorage');
    const server = { id: 'history-2', ticketType: 'AUTO_SALVAGE', status: 'VOIDED', finalPayout: 90, updatedAt: '2025-01-01' };
    localStorage.setItem('mahaffeys_tickets', JSON.stringify([{ ...server, status: 'PENDING', finalPayout: 0, checkNumber: 'stale', updatedAt: '2026-01-01' }]));
    mocks.request.mockResolvedValueOnce({ state: { mahaffeys_tickets: [server] } });
    await storage.hydrate();
    await storage.flushNow();
    const ticket = JSON.parse(storage.getItem('mahaffeys_tickets')!)[0];
    expect(ticket.status).toBe('VOIDED');
    expect(ticket.finalPayout).toBe(90);
    expect(ticket).not.toHaveProperty('checkNumber');
    storage.disconnect();
  });
});
