import type { WheelCatalogSnapshot } from '../../src/types/wheelFitment';
import { query } from './db';
import { normalizeWheelCatalog } from './wheelFitment';

const DAY = 86400000;
let memory: { snapshot: WheelCatalogSnapshot; stale: boolean; checkAfter: number } | undefined;
let pending: Promise<{ snapshot: WheelCatalogSnapshot; stale: boolean }> | undefined;

async function refreshCatalog() {
  await query(`CREATE TABLE IF NOT EXISTS interchange_source_snapshots (
    source_id TEXT PRIMARY KEY,
    payload JSONB NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL
  )`);
  const stored = await query<{ payload: WheelCatalogSnapshot }>('SELECT payload FROM interchange_source_snapshots WHERE source_id = $1', ['ankusi-wheels']);
  const previous = stored.rows[0]?.payload;
  if (previous && Date.now() - Date.parse(previous.fetchedAt) < DAY) {
    memory = { snapshot: previous, stale: false, checkAfter: Date.parse(previous.fetchedAt) + DAY };
    return { snapshot: previous, stale: false };
  }
  try {
    const response = await fetch('https://ankusiwheels.com/wp-json/ankusi/v1/dataset/json', { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30000), redirect: 'error' });
    if (!response.ok) throw new Error(`Wheel catalog returned ${response.status}`);
    const body = await response.text();
    if (body.length > 16000000) throw new Error('Wheel catalog exceeds the supported size');
    const snapshot = normalizeWheelCatalog(JSON.parse(body), new Date().toISOString());
    await query(`INSERT INTO interchange_source_snapshots (source_id, payload, fetched_at) VALUES ($1, $2::jsonb, $3)
      ON CONFLICT (source_id) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = EXCLUDED.fetched_at`, ['ankusi-wheels', JSON.stringify(snapshot), snapshot.fetchedAt]);
    memory = { snapshot, stale: false, checkAfter: Date.now() + DAY };
    return { snapshot, stale: false };
  } catch (error) {
    if (!previous) throw error;
    memory = { snapshot: previous, stale: true, checkAfter: Date.now() + 300000 };
    return { snapshot: previous, stale: true };
  }
}

export async function loadWheelCatalog() {
  if (memory && Date.now() < memory.checkAfter) return { snapshot: memory.snapshot, stale: memory.stale };
  if (!pending) pending = refreshCatalog().finally(() => { pending = undefined; });
  return pending;
}
