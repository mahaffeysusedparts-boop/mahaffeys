import { defineHandler } from "nitro";
import { createError, getRouterParam, readBody } from "nitro/h3";
import { requireUser } from "../../../utils/auth";
import { query } from "../../../utils/db";

const ALLOWED_KEYS = new Set([
  "mahaffeys_metals", "mahaffeys_car_rates", "mahaffeys_customers", "mahaffeys_tickets",
  "mahaffeys_settings", "mahaffeys_nmvtis_logs", "mahaffeys_cat_codes", "mahaffeys_container_drops",
  "mahaffeys_cash_drawer", "mahaffeys_yard_bays", "mahaffeys_pull_parts", "mahaffeys_pull_yard_vehicles",
  "mahaffeys_core_returns", "mahaffeys_admission_passes", "mahaffeys_ip_cameras",
]);

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  const key = getRouterParam(event, "key");
  if (!key || !ALLOWED_KEYS.has(key)) throw createError({ statusCode: 400, statusMessage: "Invalid shared data key" });
  const body = await readBody<{ value?: unknown }>(event, { limit: 25 * 1024 * 1024 });
  if (!("value" in body)) throw createError({ statusCode: 400, statusMessage: "A value is required" });
  const now = new Date();
  await query(`
    INSERT INTO app_state (key, value, updated_at, updated_by) VALUES ($1, $2::jsonb, $3, $4)
    ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by
  `, [key, JSON.stringify(body.value), now, user.id]);
  return { ok: true, updatedAt: now.toISOString() };
});
