import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ request: vi.fn(), apply: vi.fn(), refresh: vi.fn() }));
vi.mock('./apiClient', () => ({ apiRequest: mocks.request }));
vi.mock('./authService', () => ({ authService: { getCurrentUser: () => ({ id: 'current-user' }) } }));
vi.mock('./sharedStorage', () => ({ sharedStorage: { applyServerValue: mocks.apply } }));
vi.mock('./storageService', () => ({ storageService: { refreshCacheFromStorage: mocks.refresh } }));
vi.mock('./offlineQueue', () => ({ offlineQueue: {} }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));
vi.mock('./diagnosticLogger', () => ({ diagnosticLogger: { warn: vi.fn(), sync: vi.fn(), debug: vi.fn() } }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('window', { addEventListener: vi.fn(), dispatchEvent: vi.fn() });
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => { throw new DOMException('Storage is full', 'QuotaExceededError'); },
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('background sync alert recovery', () => {
  it('uses quota-aware persistence and keeps the full server snapshot in memory', async () => {
    const value = [{ id: 'remote-tool' }];
    mocks.request.mockResolvedValueOnce({
      entries: [{ key: 'mahaffeys_tools', value, updatedAt: new Date().toISOString(), updatedBy: 'other-user' }],
      serverTime: new Date().toISOString(), count: 1,
    });
    const { syncService } = await import('./syncService');
    await syncService.syncNow();
    expect(mocks.apply).toHaveBeenCalledWith('mahaffeys_tools', value);
    expect(mocks.refresh).toHaveBeenCalledWith('mahaffeys_tools', value);
    expect(syncService.getStatus().status).toBe('idle');
    expect(syncService.getStatus().lastError).toBeNull();
    syncService.stop();
  });

  it('reports poll failures to manual sync and clears the error after recovery', async () => {
    mocks.request.mockRejectedValueOnce(new Error('Server unavailable'));
    const { syncService } = await import('./syncService');
    await expect(syncService.syncNow()).rejects.toThrow('Server unavailable');
    expect(syncService.getStatus().status).toBe('error');
    expect(syncService.getStatus().lastError).toBe('Server unavailable');
    mocks.request.mockResolvedValueOnce({ entries: [], serverTime: new Date().toISOString(), count: 0 });
    await syncService.syncNow();
    expect(syncService.getStatus().status).toBe('idle');
    expect(syncService.getStatus().lastError).toBeNull();
    syncService.stop();
  });
});
