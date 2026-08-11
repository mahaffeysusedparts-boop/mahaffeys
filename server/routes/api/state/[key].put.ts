import { defineHandler } from "nitro";
import { createError, getRouterParam, readBody } from "nitro/h3";
import { requireUser } from "../../../utils/auth";
import { query } from "../../../utils/db";

const ALLOWED_KEYS = new Set([
  "scrapflow_metals", "scrapflow_car_rates", "scrapflow_customers", "scrapflow_tickets",
  "scrapflow_settings", "scrapflow_nmvtis_logs", "scrapflow_cat_codes", "scrapflow_container_drops",
  "scrapflow_cash_drawer", "scrapflow_yard_bays", "scrapflow_pull_parts", "scrapflow_pull_yard_vehicles",
  "scrapflow_core_returns", "scrapflow_admission_passes",
]);

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  const key = getRouterParam(event, "key");
  if (!key || !ALLOWED_KEYS.has(key)) throw createError({ statusCode: 400, statusMessage: "Invalid shared data key" });
  const body = await readBody<{ value?: unknown }>(event);
  if (!("value" in body)) throw createError({ statusCode: 400, statusMessage: "A value is required" });
  const now = new Date();
  await query(`
    INSERT INTO app_state (key, value, updated_at, updated_by) VALUES ($1, $2::jsonb, $3, $4)
    ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by
  `, [key, JSON.stringify(body.value), now, user.id]);
  return { ok: true, updatedAt: now.toISOString() };
});
