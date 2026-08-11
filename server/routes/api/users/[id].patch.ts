import { defineHandler } from "nitro";
import { createError, getRouterParam, readBody } from "nitro/h3";
import { isRole, isStatus, requireAdmin, toPublicUser } from "../../../utils/auth";
import { getDatabase } from "../../../utils/db";

export default defineHandler(async (event) => {
  const admin = requireAdmin(event);
  const id = getRouterParam(event, "id");
  const body = await readBody<{ role?: string; status?: string }>(event);
  if (!id || (body.role !== undefined && !isRole(body.role)) || (body.status !== undefined && !isStatus(body.status))) {
    throw createError({ statusCode: 400, statusMessage: "Invalid user update" });
  }
  if (id === admin.id && body.status && body.status !== "approved") {
    throw createError({ statusCode: 400, statusMessage: "You cannot disable your own administrator account" });
  }

  const db = getDatabase();
  const current = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Parameters<typeof toPublicUser>[0] | undefined;
  if (!current) throw createError({ statusCode: 404, statusMessage: "User not found" });
  const status = body.status || current.status;
  const role = body.role || current.role;
  const now = new Date().toISOString();
  const approvedAt = status === "approved" ? current.approved_at || now : current.approved_at;
  const approvedBy = status === "approved" ? current.approved_by || admin.id : current.approved_by;
  db.prepare("UPDATE users SET role = ?, status = ?, approved_at = ?, approved_by = ?, updated_at = ? WHERE id = ?")
    .run(role, status, approvedAt, approvedBy, now, id);
  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Parameters<typeof toPublicUser>[0];
  return { user: toPublicUser(updated) };
});
