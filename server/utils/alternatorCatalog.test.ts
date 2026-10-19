import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InterchangeMapping } from '../../src/services/interchangeService';

const mocks = vi.hoisted(() => ({ query: vi.fn(), fetch: vi.fn() }));
vi.mock('./db', () => ({ query: mocks.query }));
vi.mock('./alternatorSources', () => ({ ALTERNATOR_SOURCES: [
  { partNumber: 'TEST-A', url: 'https://www.dbelectrical.com/products/test-a.html' },
  { partNumber: 'TEST-B', url: 'https://www.dbelectrical.com/products/test-b.html' },
] }));
const html = '<h1>Test fixture only</h1><table><tr><td>Unit Type</td><td>Alternator</td></tr></table><table><tr><th>MAKE</th><th>MODEL</th><th>YEAR</th><th>ENGINE</th></tr><tr><td>TEST MAKE</td><td>TEST MODEL</td><td>2007</td><td>5.4L V8</td></tr></table>';
const snapshot: InterchangeMapping = {
  id: 'test-only', partCategory: 'TEST', partName: 'Alternator', interchangeCode: 'TEST-A', description: 'Test only',
  compatibleModels: [{ make: 'TEST MAKE', model: 'TEST MODEL', startYear: 2007, endYear: 2007 }],
  source: { name: 'Test', url: 'https://www.dbelectrical.com/products/test-a.html', fetchedAt: '2020-01-01T00:00:00.000Z', stale: false, verification: 'unverified' },
};

beforeEach(() => {
  vi.resetModules();
  mocks.query.mockReset().mockResolvedValue({ rows: [] });
  mocks.fetch.mockReset();
  vi.stubGlobal('fetch', mocks.fetch);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function stored(fetchedAt: string) {
  mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.startsWith('SELECT') ? [{ source_id: 'alternator-TEST-A', payload: { ...snapshot, source: { ...snapshot.source, fetchedAt } } }] : [] }));
}

describe('public alternator catalog refresh', () => {
  it('persists parsed listings and shares simultaneous loads and subsequent cached reads', async () => {
    mocks.fetch.mockImplementation(async () => new Response(html));
    const { loadAlternatorCatalog } = await import('./alternatorCatalog');
    const [first, second] = await Promise.all([loadAlternatorCatalog(), loadAlternatorCatalog()]);
    expect(first.mappings).toHaveLength(2);
    expect(second.sources.every((source) => source.state === 'loaded')).toBe(true);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(mocks.query.mock.calls.filter(([sql]) => String(sql).startsWith('INSERT'))).toHaveLength(2);
    await loadAlternatorCatalog();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it('uses fresh persisted pages and fetches only missing pages', async () => {
    stored(new Date().toISOString());
    mocks.fetch.mockImplementation(async () => new Response(html));
    const { loadAlternatorCatalog } = await import('./alternatorCatalog');
    expect((await loadAlternatorCatalog()).mappings).toHaveLength(2);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.fetch.mock.calls[0][0]).toContain('test-b.html');
  });
  it('keeps stale pages separate from unavailable pages without overwriting stored data', async () => {
    stored(snapshot.source!.fetchedAt);
    mocks.fetch.mockRejectedValue(new Error('Unavailable'));
    const { loadAlternatorCatalog } = await import('./alternatorCatalog');
    const result = await loadAlternatorCatalog();
    expect(result.mappings).toHaveLength(1);
    expect(result.mappings[0].source).toMatchObject({ stale: true, fetchedAt: snapshot.source!.fetchedAt });
    expect(result.sources.map((source) => source.state)).toEqual(['stale', 'unavailable']);
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).startsWith('INSERT'))).toBe(false);
    await loadAlternatorCatalog();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it('rejects changed HTML without discarding other readable sources', async () => {
    mocks.fetch.mockImplementation(async (url: string) => new Response(url.includes('test-a') ? '<h1>Ford alternator</h1>' : html));
    const { loadAlternatorCatalog } = await import('./alternatorCatalog');
    const result = await loadAlternatorCatalog();
    expect(result.mappings).toHaveLength(1);
    expect(result.sources.map((source) => source.state)).toEqual(['unavailable', 'loaded']);
    expect(mocks.query.mock.calls.filter(([sql]) => String(sql).startsWith('INSERT'))).toHaveLength(1);
  });
});
