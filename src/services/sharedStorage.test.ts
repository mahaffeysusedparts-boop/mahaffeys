import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('./apiClient', () => ({ apiRequest: mocks.request }));
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
});
