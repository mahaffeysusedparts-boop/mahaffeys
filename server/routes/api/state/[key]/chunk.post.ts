import { defineHandler } from "nitro";
import { createError, getRouterParam, readBody } from "nitro/h3";
import { requireUser } from "../../../../utils/auth";
import { withTransaction } from "../../../../utils/db";

const ALLOWED_KEYS = new Set([
  "mahaffeys_metals", "mahaffeys_car_rates", "mahaffeys_customers", "mahaffeys_tickets",
  "mahaffeys_settings", "mahaffeys_nmvtis_logs", "mahaffeys_cat_codes", "mahaffeys_container_drops",
  "mahaffeys_cash_drawer", "mahaffeys_yard_bays", "mahaffeys_pull_parts", "mahaffeys_pull_yard_vehicles",
  "mahaffeys_core_returns", "mahaffeys_admission_passes", "mahaffeys_ip_cameras",
]);

const MAX_CHUNK_LENGTH = 600 * 1024;
const MAX_CHUNKS = 2_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ChunkBody {
  uploadId?: string;
  index?: number;
  total?: number;
  chunk?: string;
}

interface UploadRow {
  state_key: string;
  total_chunks: number;
  user_id: string;
}

interface CountRow {
  count: string;
}

interface AssembledRow {
  serialized: string;
}

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  const key = getRouterParam(event, "key");
  if (!key || !ALLOWED_KEYS.has(key)) throw createError({ statusCode: 400, statusMessage: "Invalid shared data key" });

  const body = await readBody<ChunkBody>(event);
  if (!body.uploadId || !UUID_PATTERN.test(body.uploadId)) throw createError({ statusCode: 400, statusMessage: "Invalid upload ID" });
  if (!Number.isInteger(body.index) || body.index! < 0) throw createError({ statusCode: 400, statusMessage: "Invalid chunk index" });
  if (!Number.isInteger(body.total) || body.total! < 1 || body.total! > MAX_CHUNKS || body.index! >= body.total!) {
    throw createError({ statusCode: 400, statusMessage: "Invalid chunk count" });
  }
  if (typeof body.chunk !== "string" || body.chunk.length > MAX_CHUNK_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: "Invalid upload chunk" });
  }

  return withTransaction(async (client) => {
    await client.query("DELETE FROM state_upload_chunks WHERE created_at < NOW() - INTERVAL '24 hours'");

    const existing = await client.query<UploadRow>(
      "SELECT state_key, total_chunks, user_id FROM state_upload_chunks WHERE upload_id = $1 LIMIT 1",
      [body.uploadId],
    );
    const upload = existing.rows[0];
    if (upload && (upload.state_key !== key || upload.total_chunks !== body.total || upload.user_id !== user.id)) {
      throw createError({ statusCode: 409, statusMessage: "Upload metadata does not match" });
    }

    await client.query(`
      INSERT INTO state_upload_chunks (upload_id, state_key, chunk_index, total_chunks, chunk_data, user_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (upload_id, chunk_index) DO UPDATE SET chunk_data = EXCLUDED.chunk_data
    `, [body.uploadId, key, body.index, body.total, body.chunk, user.id]);

    const countResult = await client.query<CountRow>(
      "SELECT COUNT(*)::text AS count FROM state_upload_chunks WHERE upload_id = $1",
      [body.uploadId],
    );
    if (Number(countResult.rows[0]?.count) !== body.total) return { ok: true, complete: false };

    const assembledResult = await client.query<AssembledRow>(`
      SELECT string_agg(chunk_data, '' ORDER BY chunk_index) AS serialized
      FROM state_upload_chunks
      WHERE upload_id = $1
    `, [body.uploadId]);
    const serialized = assembledResult.rows[0]?.serialized;
    if (!serialized) throw createError({ statusCode: 400, statusMessage: "Uploaded state is empty" });

    let value: unknown;
    try {
      value = JSON.parse(serialized);
    } catch {
      throw createError({ statusCode: 400, statusMessage: "Uploaded state is invalid" });
    }

    const now = new Date();
    await client.query(`
      INSERT INTO app_state (key, value, updated_at, updated_by) VALUES ($1, $2::jsonb, $3, $4)
      ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by
    `, [key, JSON.stringify(value), now, user.id]);
    await client.query("DELETE FROM state_upload_chunks WHERE upload_id = $1", [body.uploadId]);

    return { ok: true, complete: true, updatedAt: now.toISOString() };
  });
});
