import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WheelCatalogSnapshot } from '../../src/types/wheelFitment';

const mocks = vi.hoisted(() => ({ query: vi.fn(), fetch: vi.fn() }));
vi.mock('./db', () => ({ query: mocks.query }));
const dataset = {
  name: 'ANKUSI Wheel Fitment Dataset', version: 'test-only', license: 'CC BY 4.0', records: 1,
  data: [{ make: 'Test', model: 'Test Model', year: '2008', chassis_code: '', bolt_pattern: '5x114.3', lug_count: '5', center_bore_mm: '64.1', center_bore_rear_mm: '', oe_wheel: '', source_url: 'https://ankusiwheels.com/fitment-guide/test-only/' }],
};
const snapshot: WheelCatalogSnapshot = { version: 'previous-test', fetchedAt: '2020-01-01T00:00:00Z', sourceRecords: 1, rejectedRecords: 0, records: [] };

beforeEach(() => {
  vi.resetModules();
  mocks.query.mockReset().mockResolvedValue({ rows: [] });
  mocks.fetch.mockReset();
  vi.stubGlobal('fetch', mocks.fetch);
});
afterEach(() => vi.unstubAllGlobals());

function stored(value: WheelCatalogSnapshot) {
  mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.startsWith('SELECT') ? [{ payload: value }] : [] }));
}

describe('persistent free wheel source refresh', () => {
  it('imports the validated full dataset and shares simultaneous requests', async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify(dataset), { status: 200 }));
    const { loadWheelCatalog } = await import('./wheelCatalog');
    const [first, second] = await Promise.all([loadWheelCatalog(), loadWheelCatalog()]);
    expect(first.snapshot.records).toHaveLength(1);
    expect(second.snapshot.version).toBe('test-only');
    expect(first.stale).toBe(false);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    const insert = mocks.query.mock.calls.find(([sql]) => String(sql).startsWith('INSERT'));
    expect(insert?.[1][0]).toBe('ankusi-wheels');
    expect(JSON.parse(insert?.[1][1]).records).toHaveLength(1);
    await loadWheelCatalog();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('loads a fresh persisted snapshot without contacting the provider', async () => {
    stored({ ...snapshot, fetchedAt: new Date().toISOString() });
    const { loadWheelCatalog } = await import('./wheelCatalog');
    expect((await loadWheelCatalog()).stale).toBe(false);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('retains and labels last-known-good data when refresh fails, without overwriting it', async () => {
    stored(snapshot);
    mocks.fetch.mockRejectedValue(new Error('Source unavailable'));
    const { loadWheelCatalog } = await import('./wheelCatalog');
    const result = await loadWheelCatalog();
    expect(result).toEqual({ snapshot, stale: true });
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).startsWith('INSERT'))).toBe(false);
    await loadWheelCatalog();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects a changed license without publishing or persisting it', async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ ...dataset, license: 'All rights reserved' }), { status: 200 }));
    const { loadWheelCatalog } = await import('./wheelCatalog');
    await expect(loadWheelCatalog()).rejects.toThrow();
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).startsWith('INSERT'))).toBe(false);
  });
});
