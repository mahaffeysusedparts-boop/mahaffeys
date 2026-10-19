import type { InterchangeMapping, PartsCatalog } from '../../src/services/interchangeService';
import { COMPONENT_SOURCES, type ComponentSource } from './componentSources';
import { parseComponentListing } from './componentParser';
import { query } from './db';

const DAY = 86400000;
type CatalogGroup = 'main' | 'additional';
const memory = new Map<CatalogGroup, { catalog: PartsCatalog; checkAfter: number }>();
const pending = new Map<CatalogGroup, Promise<PartsCatalog>>();

async function refresh(group: CatalogGroup, sources: ComponentSource[]): Promise<PartsCatalog> {
  await query(`CREATE TABLE IF NOT EXISTS interchange_source_snapshots (
    source_id TEXT PRIMARY KEY, payload JSONB NOT NULL, fetched_at TIMESTAMPTZ NOT NULL
  )`);
  const stored = await query<{ source_id: string; payload: InterchangeMapping }>(
    'SELECT source_id, payload FROM interchange_source_snapshots WHERE source_id = ANY($1::text[])',
    [sources.map((source) => source.id)],
  );
  const previous = new Map(stored.rows.map((row) => [row.source_id, row.payload]));
  const catalog: PartsCatalog = { mappings: [], sources: [] };
  for (let index = 0; index < sources.length; index += 4) {
    await Promise.all(sources.slice(index, index + 4).map(async (source) => {
      const saved = previous.get(source.id);
      let mapping = saved;
      let state: PartsCatalog['sources'][number]['state'] = 'loaded';
      if (!saved?.source || Date.now() - Date.parse(saved.source.fetchedAt) >= DAY) {
        try {
          const response = await fetch(source.url, { headers: { Accept: 'text/html' }, signal: AbortSignal.timeout(10000), redirect: 'error' });
          if (!response.ok) throw new Error(`Listing returned ${response.status}`);
          const html = await response.text();
          if (html.length > 5000000) throw new Error('Listing too large');
          mapping = parseComponentListing(html, source, new Date().toISOString());
          await query(`INSERT INTO interchange_source_snapshots (source_id, payload, fetched_at) VALUES ($1, $2::jsonb, $3)
            ON CONFLICT (source_id) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = EXCLUDED.fetched_at`,
          [source.id, JSON.stringify(mapping), mapping.source!.fetchedAt]);
        } catch (error) {
          console.warn(`Component listing ${source.id} unavailable:`, error instanceof Error ? error.message : 'Unknown error');
          mapping = saved;
          state = saved ? 'stale' : 'unavailable';
        }
      }
      if (mapping?.source) catalog.mappings.push({ ...mapping, source: { ...mapping.source, stale: state === 'stale' } });
      catalog.sources.push({ name: `${source.provider === 'powertrain' ? 'Powertrain Products' : source.provider === '1aauto' ? '1A Auto' : 'DB Electrical'} · ${source.partName} · ${'partNumber' in source ? source.partNumber : source.id.replace('ppi-', '')}`, url: source.url, state, applications: mapping?.compatibleModels.length ?? 0, fetchedAt: mapping?.source?.fetchedAt });
    }));
  }
  catalog.mappings.sort((a, b) => a.partName.localeCompare(b.partName) || a.interchangeCode.localeCompare(b.interchangeCode));
  catalog.sources.sort((a, b) => a.name.localeCompare(b.name));
  memory.set(group, { catalog, checkAfter: Date.now() + (catalog.sources.some((source) => source.state !== 'loaded') ? 300000 : DAY) });
  return catalog;
}

export function loadComponentCatalog(group: CatalogGroup = 'main'): Promise<PartsCatalog> {
  const cached = memory.get(group);
  if (cached && Date.now() < cached.checkAfter) return Promise.resolve(cached.catalog);
  const active = pending.get(group);
  if (active) return active;
  const sources = COMPONENT_SOURCES.filter((source) => (source.provider === '1aauto') === (group === 'additional'));
  const request = refresh(group, sources).finally(() => { pending.delete(group); });
  pending.set(group, request);
  return request;
}
