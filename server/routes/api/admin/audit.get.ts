import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";
import { requireAdmin } from "../../../utils/auth";
import { query } from "../../../utils/db";

interface AuditRow {
  id: string;
  user_id: string | null;
  user_name: string;
  action: string;
  entity: string;
  entity_id: string | null;
  detail: unknown;
  created_at: Date | string;
}

const PAGE_SIZE = 50;

/** Paginated audit trail with user / action / entity / date-range filters. */
export default defineHandler(async (event) => {
  await requireAdmin(event);
  const params = getQuery(event);
  const page = Math.max(1, Number.parseInt(String(params.page || "1"), 10) || 1);
  const user = String(params.user || "").trim();
  const action = String(params.action || "").trim();
  const entity = String(params.entity || "").trim();
  const from = String(params.from || "").trim();
  const to = String(params.to || "").trim();

  const conditions: string[] = [];
  const values: unknown[] = [];
  if (user) {
    values.push(`%${user.toLowerCase()}%`);
    conditions.push(`(LOWER(user_name) LIKE $${values.length} OR LOWER(user_id) LIKE $${values.length})`);
  }
  if (action) {
    values.push(`%${action.toLowerCase()}%`);
    conditions.push(`LOWER(action) LIKE $${values.length}`);
  }
  if (entity) {
    values.push(`%${entity.toLowerCase()}%`);
    conditions.push(`LOWER(entity) LIKE $${values.length}`);
  }
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    values.push(`${from}T00:00:00`);
    conditions.push(`created_at >= $${values.length}::timestamptz`);
  }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    values.push(`${to}T23:59:59.999`);
    conditions.push(`created_at <= $${values.length}::timestamptz`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const totalResult = await query<{ count: string }>(`SELECT COUNT(*) AS count FROM audit_log ${where}`, values);
  const total = Number(totalResult.rows[0]?.count || 0);

  const offset = (page - 1) * PAGE_SIZE;
  const rows = await query<AuditRow>(
    `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    values,
  );

  return {
    entries: rows.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      action: row.action,
      entity: row.entity,
      entityId: row.entity_id,
      detail: row.detail ?? null,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    })),
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
});
