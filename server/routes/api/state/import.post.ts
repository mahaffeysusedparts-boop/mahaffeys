import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { requireAdmin } from "../../../utils/auth";
import { getDatabase } from "../../../utils/db";

const ALLOWED_KEYS = new Set([
  "scrapflow_metals", "scrapflow_car_rates", "scrapflow_customers", "scrapflow_tickets",
  "scrapflow_settings", "scrapflow_nmvtis_logs", "scrapflow_cat_codes", "scrapflow_container_drops",
  "scrapflow_cash_drawer", "scrapflow_yard_bays", "scrapflow_pull_parts", "scrapflow_pull_yard_vehicles",
  "scrapflow_core_returns", "scrapflow_admission_passes",
]);

export default defineHandler(async (event) => {
  const admin = requireAdmin(event);
  const body = await readBody<{ state?: Record<string, unknown> }>(event);
  if (!body.state || typeof body.state !== "object") throw createError({ statusCode: 400, statusMessage: "Shared state is required" });
  const db = getDatabase();
  const now = new Date().toISOString();
  const upsert = db.prepare(`
    INSERT INTO app_state (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by
  `);
  db.exec("BEGIN");
  try {
    for (const [key, value] of Object.entries(body.state)) {
      if (ALLOWED_KEYS.has(key)) upsert.run(key, JSON.stringify(value), now, admin.id);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { ok: true, updatedAt: now };
});
