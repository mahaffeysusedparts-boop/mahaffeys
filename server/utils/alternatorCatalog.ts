import type { InterchangeMapping, PartsCatalog } from '../../src/services/interchangeService';
import { ALTERNATOR_SOURCES } from './alternatorSources';
import { parseAlternatorListing } from './alternatorParser';
import { query } from './db';

const DAY = 86400000;
let memory: { catalog: PartsCatalog; checkAfter: number } | undefined;
let pending: Promise<PartsCatalog> | undefined;

async function refresh() {
  await query(`CREATE TABLE IF NOT EXISTS interchange_source_snapshots (
    source_id TEXT PRIMARY KEY, payload JSONB NOT NULL, fetched_at TIMESTAMPTZ NOT NULL
  )`);
  const stored = await query<{ source_id: string; payload: InterchangeMapping }>(
    'SELECT source_id, payload FROM interchange_source_snapshots WHERE source_id = ANY($1::text[])',
    [ALTERNATOR_SOURCES.map((source) => `alternator-${source.partNumber}`)],
  );
  const previous = new Map(stored.rows.map((row) => [row.source_id, row.payload]));
  const catalog: PartsCatalog = { mappings: [], sources: [] };
  // Bounded concurrency and independent snapshots keep one blocked listing from losing other coverage.
  for (let index = 0; index < ALTERNATOR_SOURCES.length; index += 4) {
    await Promise.all(ALTERNATOR_SOURCES.slice(index, index + 4).map(async ({ partNumber, url }) => {
      const id = `alternator-${partNumber}`;
      const saved = previous.get(id);
      let mapping = saved;
      let state: PartsCatalog['sources'][number]['state'] = 'loaded';
      if (!saved?.source || Date.now() - Date.parse(saved.source.fetchedAt) >= DAY) {
        try {
          const response = await fetch(url, { headers: { Accept: 'text/html' }, signal: AbortSignal.timeout(10000), redirect: 'error' });
          if (!response.ok) throw new Error(`Listing returned ${response.status}`);
          const html = await response.text();
          if (html.length > 5000000) throw new Error('Listing too large');
          mapping = parseAlternatorListing(html, partNumber, url, new Date().toISOString());
          await query(`INSERT INTO interchange_source_snapshots (source_id, payload, fetched_at) VALUES ($1, $2::jsonb, $3)
            ON CONFLICT (source_id) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = EXCLUDED.fetched_at`,
          [id, JSON.stringify(mapping), mapping.source!.fetchedAt]);
        } catch (error) {
          console.warn(`Alternator listing ${partNumber} unavailable:`, error instanceof Error ? error.message : 'Unknown error');
          mapping = saved;
          state = saved ? 'stale' : 'unavailable';
        }
      }
      if (mapping?.source) {
        mapping = { ...mapping, source: { ...mapping.source, stale: state === 'stale' } };
        catalog.mappings.push(mapping);
      }
      catalog.sources.push({ name: `DB Electrical ${partNumber}`, url, state, applications: mapping?.compatibleModels.length ?? 0, fetchedAt: mapping?.source?.fetchedAt });
    }));
  }
  catalog.mappings.sort((a, b) => a.interchangeCode.localeCompare(b.interchangeCode));
  catalog.sources.sort((a, b) => a.name.localeCompare(b.name));
  memory = { catalog, checkAfter: Date.now() + (catalog.sources.some((source) => source.state !== 'loaded') ? 300000 : DAY) };
  return catalog;
}

export function loadAlternatorCatalog() {
  if (memory && Date.now() < memory.checkAfter) return Promise.resolve(memory.catalog);
  if (!pending) pending = refresh().finally(() => { pending = undefined; });
  return pending;
}
