import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { requireAdmin } from "../../../utils/auth";
import { withTransaction } from "../../../utils/db";

const ALLOWED_KEYS = new Set([
  "mahaffeys_metals", "mahaffeys_car_rates", "mahaffeys_customers", "mahaffeys_tickets",
  "mahaffeys_settings", "mahaffeys_nmvtis_logs", "mahaffeys_cat_codes", "mahaffeys_container_drops",
  "mahaffeys_cash_drawer", "mahaffeys_yard_bays", "mahaffeys_pull_parts", "mahaffeys_pull_yard_vehicles",
  "mahaffeys_core_returns", "mahaffeys_admission_passes",
]);

export default defineHandler(async (event) => {
  const admin = await requireAdmin(event);
  const body = await readBody<{ state?: Record<string, unknown> }>(event);
  if (!body.state || typeof body.state !== "object") throw createError({ statusCode: 400, statusMessage: "Shared state is required" });
  const now = new Date();
  await withTransaction(async (client) => {
    for (const [key, value] of Object.entries(body.state!)) {
      if (!ALLOWED_KEYS.has(key)) continue;
      await client.query(`
        INSERT INTO app_state (key, value, updated_at, updated_by) VALUES ($1, $2::jsonb, $3, $4)
        ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by
      `, [key, JSON.stringify(value), now, admin.id]);
    }
  });
  return { ok: true, updatedAt: now.toISOString() };
});
