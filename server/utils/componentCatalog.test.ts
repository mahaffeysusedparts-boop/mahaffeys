import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InterchangeMapping } from '../../src/services/interchangeService';

const mocks = vi.hoisted(() => ({ query: vi.fn(), fetch: vi.fn() }));
vi.mock('./db', () => ({ query: mocks.query }));
vi.mock('./componentSources', () => ({ COMPONENT_SOURCES: [
  { id: 'test-a', partName: 'Engine', provider: 'powertrain', url: 'https://www.powertrainproducts.net/product/test-a/' },
  { id: 'test-b', partName: 'Engine', provider: 'powertrain', url: 'https://www.powertrainproducts.net/product/test-b/' },
] }));
const html = '<h1>Test engine</h1><table><tr><th>Year</th><th>Make</th><th>Model</th><th>Engine</th><th>Note</th></tr><tr><td>2000 - 2002</td><td>TEST MAKE</td><td>TEST MODEL</td><td>5.3L V8</td><td>TEST ONLY</td></tr></table>';
const snapshot: InterchangeMapping = { id: 'test-a', partCategory: 'TEST', partName: 'Engine', interchangeCode: 'TEST', description: 'Test only', compatibleModels: [{ make: 'TEST MAKE', model: 'TEST MODEL', startYear: 2000, endYear: 2002 }], source: { name: 'Test', url: 'https://www.powertrainproducts.net/product/test-a/', fetchedAt: '2020-01-01T00:00:00.000Z', stale: false, verification: 'unverified' } };

beforeEach(() => {
  vi.resetModules();
  mocks.query.mockReset().mockResolvedValue({ rows: [] });
  mocks.fetch.mockReset();
  vi.stubGlobal('fetch', mocks.fetch);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('broader component catalog', () => {
  it('shares loads and persists independent parsed snapshots', async () => {
    mocks.fetch.mockImplementation(async () => new Response(html));
    const { loadComponentCatalog } = await import('./componentCatalog');
    const [first, second] = await Promise.all([loadComponentCatalog(), loadComponentCatalog()]);
    expect(first.mappings).toHaveLength(2);
    expect(second.sources.every((source) => source.state === 'loaded')).toBe(true);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(mocks.query.mock.calls.filter(([sql]) => String(sql).startsWith('INSERT'))).toHaveLength(2);
    await loadComponentCatalog();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it('retains dated stale records and reports unreadable new pages without inventing applications', async () => {
    mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.startsWith('SELECT') ? [{ source_id: 'test-a', payload: snapshot }] : [] }));
    mocks.fetch.mockImplementation(async () => new Response('<h1>Changed engine page with no table</h1>'));
    const { loadComponentCatalog } = await import('./componentCatalog');
    const result = await loadComponentCatalog();
    expect(result.mappings).toHaveLength(1);
    expect(result.mappings[0].source).toMatchObject({ stale: true, fetchedAt: snapshot.source!.fetchedAt });
    expect(result.sources.map((source) => source.state)).toEqual(['stale', 'unavailable']);
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).startsWith('INSERT'))).toBe(false);
  });
  it('uses fresh stored sources while fetching missing records only', async () => {
    mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.startsWith('SELECT') ? [{ source_id: 'test-a', payload: { ...snapshot, source: { ...snapshot.source, fetchedAt: new Date().toISOString() } } }] : [] }));
    mocks.fetch.mockImplementation(async () => new Response(html));
    const { loadComponentCatalog } = await import('./componentCatalog');
    expect((await loadComponentCatalog()).mappings).toHaveLength(2);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
});
