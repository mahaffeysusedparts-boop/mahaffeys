import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('./storageService', () => ({ storageService: { getSettings: () => ({ scales: [], currentScaleId: null }), getScaleWeightEvents: () => [], saveScaleWeightEvent: vi.fn() } }));
vi.mock('./diagnosticLogger', () => ({ diagnosticLogger: { hardware: vi.fn() } }));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); });
describe('scale provider failure audit', () => {
  it('a frozen poll cannot leave the old stable reading connected beyond the existing watchdog interval', async () => {
    vi.useFakeTimers();
    const request = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ connected: true, weight: 1200, unit: 'LBS', isStable: true, isZero: false }) })
      .mockImplementation((_url: string, options: RequestInit) => new Promise((_resolve, reject) => options.signal?.addEventListener('abort', () => reject(new Error('Frozen poll aborted')))));
    vi.stubGlobal('fetch', request);
    const { scaleService } = await import('./scaleService');
    await vi.advanceTimersByTimeAsync(0);
    expect(scaleService.getStatus()).toMatchObject({ connected: true, isStable: true, grossWeight: 1200 });
    await vi.advanceTimersByTimeAsync(11000);
    expect(scaleService.getStatus()).toMatchObject({ connected: false, isStable: false, grossWeight: 1200 });
  });
});
