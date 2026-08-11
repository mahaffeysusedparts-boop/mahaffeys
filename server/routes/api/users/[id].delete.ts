import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { requireAdmin } from "../../../utils/auth";
import { query } from "../../../utils/db";

export default defineHandler(async (event) => {
  const admin = await requireAdmin(event);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "User id is required" });
  if (id === admin.id) throw createError({ statusCode: 400, statusMessage: "You cannot delete your own administrator account" });
  const result = await query("DELETE FROM users WHERE id = $1", [id]);
  if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: "User not found" });
  return { ok: true };
});
