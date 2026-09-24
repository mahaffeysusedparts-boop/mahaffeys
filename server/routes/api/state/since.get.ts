import { defineHandler } from "nitro";
import { createError, getQuery } from "nitro/h3";
import { requireUser } from "../../../utils/auth";
import { query } from "../../../utils/db";

const ALLOWED_KEYS = new Set([
  "mahaffeys_metals", "mahaffeys_car_rates", "mahaffeys_customers", "mahaffeys_tickets",
  "mahaffeys_settings", "mahaffeys_nmvtis_logs", "mahaffeys_cat_codes", "mahaffeys_container_drops",
  "mahaffeys_cash_drawer", "mahaffeys_yard_bays", "mahaffeys_yard_layout", "mahaffeys_pull_parts", "mahaffeys_pull_yard_vehicles",
  "mahaffeys_removed_inventory_vehicles", "mahaffeys_core_returns", "mahaffeys_admission_passes", "mahaffeys_ip_cameras",
  "mahaffeys_shipments", "mahaffeys_mills", "mahaffeys_timeclock", "mahaffeys_checklists", "mahaffeys_tasks", "mahaffeys_equipment", "mahaffeys_maintenance_logs", "mahaffeys_rate_history",
  "mahaffeys_tools", "mahaffeys_tool_checkouts",
  "mahaffeys_operations_goals", "mahaffeys_operations_alert_rules", "mahaffeys_operations_alerts", "mahaffeys_operations_summaries",
]);

const DEFAULT_LIMIT = 2000;

interface StateRow {
  key: string;
  value: unknown;
  updated_at: Date | string;
  updated_by: string | null;
}

export default defineHandler(async (event) => {
  await requireUser(event);
  const raw = getQuery(event);
  const sinceParam = String(raw.since ?? "").trim();
  const since = sinceParam ? new Date(sinceParam) : null;
  if (since && Number.isNaN(since.getTime())) {
    throw createError({ statusCode: 400, statusMessage: "Provide a valid ISO timestamp for `since`" });
  }
  const limit = Math.min(Math.max(Number(raw.limit) || DEFAULT_LIMIT, 1), DEFAULT_LIMIT);

  const result = await query<StateRow>(`
    SELECT key, value, updated_at, updated_by
    FROM app_state
    WHERE ($1::timestamptz IS NULL OR updated_at > $1)
      AND key = ANY($2::text[])
    ORDER BY updated_at DESC
    LIMIT $3
  `, [since ? since.toISOString() : null, [...ALLOWED_KEYS], limit]);

  const entries = result.rows.map((row) => ({
    key: row.key,
    value: row.value,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    updatedBy: row.updated_by,
  }));

  return {
    entries,
    serverTime: new Date().toISOString(),
    count: entries.length,
  };
});