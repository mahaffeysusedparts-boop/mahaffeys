import { defineHandler } from "nitro";
import { requireAdmin } from "../../../utils/auth";
import { query } from "../../../utils/db";

// Photo integrity audit: compares every /api/uploads/<uuid> referenced by the
// shared records (app_state) against the media_uploads table of the database
// this server is currently connected to. Records sync between databases, but
// photo bytes do not — this makes mismatches visible in one request.
const UPLOAD_URL_PATTERN = /\/api\/uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi;
const MAX_MISSING_REPORTED = 50;

function collectUploadIds(value: unknown, ids: Set<string>) {
  if (typeof value === "string") {
    for (const match of value.matchAll(UPLOAD_URL_PATTERN)) ids.add(match[1]);
  } else if (Array.isArray(value)) {
    for (const item of value) collectUploadIds(item, ids);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectUploadIds(item, ids);
  }
}

export default defineHandler(async (event) => {
  await requireAdmin(event);

  const state = await query<{ key: string; value: unknown }>("SELECT key, value FROM app_state");
  const referenced = new Set<string>();
  for (const row of state.rows) collectUploadIds(row.value, referenced);
  const referencedIds = [...referenced];

  const present = new Set<string>();
  if (referencedIds.length > 0) {
    const found = await query<{ id: string }>(
      "SELECT id FROM media_uploads WHERE id = ANY($1::uuid[])",
      [referencedIds],
    );
    for (const row of found.rows) present.add(row.id);
  }
  const missing = referencedIds.filter((id) => !present.has(id));

  const totals = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM media_uploads");

  // Report only host + database name — never credentials.
  let connectedHost = "unknown";
  let connectedDatabase = "unknown";
  try {
    const url = new URL(process.env.NITRO_DATABASE_URL || process.env.DATABASE_URL || "");
    connectedHost = url.host || "unknown";
    connectedDatabase = url.pathname.replace(/^\//, "") || "postgres";
  } catch { /* keep defaults */ }

  return {
    connectedHost,
    connectedDatabase,
    referencedCount: referencedIds.length,
    missingCount: missing.length,
    missingIds: missing.slice(0, MAX_MISSING_REPORTED),
    mediaInDatabase: Number(totals.rows[0]?.count || 0),
  };
});
