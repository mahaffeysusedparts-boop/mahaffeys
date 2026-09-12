import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { requireAdmin, type UserRow } from "../../../utils/auth";
import { auditFor, recordAudit } from "../../../utils/audit";
import { query } from "../../../utils/db";

export default defineHandler(async (event) => {
  const admin = await requireAdmin(event);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "User id is required" });
  if (id === admin.id) throw createError({ statusCode: 400, statusMessage: "You cannot delete your own administrator account" });
  const existing = await query<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
  const result = await query("DELETE FROM users WHERE id = $1", [id]);
  if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: "User not found" });
  await recordAudit(auditFor(admin, {
    action: "user.delete",
    entity: "users",
    entityId: id,
    detail: { deletedUser: existing.rows[0]?.username || id, deletedRole: existing.rows[0]?.role },
  }));
  return { ok: true };
});
