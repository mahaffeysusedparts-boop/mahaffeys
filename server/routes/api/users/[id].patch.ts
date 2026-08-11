import { defineHandler } from "nitro";
import { createError, getRouterParam, readBody } from "nitro/h3";
import { isRole, isStatus, requireAdmin, toPublicUser, type UserRow } from "../../../utils/auth";
import { query, withTransaction } from "../../../utils/db";

export default defineHandler(async (event) => {
  const admin = await requireAdmin(event);
  const id = getRouterParam(event, "id");
  const body = await readBody<{ role?: string; status?: string }>(event);
  if (!id || (body.role !== undefined && !isRole(body.role)) || (body.status !== undefined && !isStatus(body.status))) {
    throw createError({ statusCode: 400, statusMessage: "Invalid user update" });
  }
  if (id === admin.id && body.status && body.status !== "approved") {
    throw createError({ statusCode: 400, statusMessage: "You cannot disable your own administrator account" });
  }
  if (id === admin.id && body.role && body.role !== "admin") {
    throw createError({ statusCode: 400, statusMessage: "You cannot remove your own administrator role" });
  }

  const updated = await withTransaction(async (client) => {
    const currentResult = await client.query<UserRow>("SELECT * FROM users WHERE id = $1 FOR UPDATE", [id]);
    const current = currentResult.rows[0];
    if (!current) throw createError({ statusCode: 404, statusMessage: "User not found" });

    const status = isStatus(body.status) ? body.status : current.status;
    const role = isRole(body.role) ? body.role : current.role;
    if (current.role === "admin" && (role !== "admin" || status !== "approved")) {
      const countResult = await client.query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 'approved' AND id <> $1",
        [id],
      );
      if (Number(countResult.rows[0].count) === 0) {
        throw createError({ statusCode: 400, statusMessage: "At least one approved administrator is required" });
      }
    }

    const approvedAt = status === "approved" ? current.approved_at || new Date() : current.approved_at;
    const approvedBy = status === "approved" ? current.approved_by || admin.id : current.approved_by;
    const result = await client.query<UserRow>(`
      UPDATE users SET role = $1, status = $2, approved_at = $3, approved_by = $4, updated_at = $5
      WHERE id = $6 RETURNING *
    `, [role, status, approvedAt, approvedBy, new Date(), id]);
    return result.rows[0];
  });

  if (updated.status !== "approved") await query("DELETE FROM sessions WHERE user_id = $1", [updated.id]);
  return { user: toPublicUser(updated) };
});
