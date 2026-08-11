import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { requireAdmin } from "../../../utils/auth";
import { getDatabase } from "../../../utils/db";

export default defineHandler((event) => {
  const admin = requireAdmin(event);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "User id is required" });
  if (id === admin.id) throw createError({ statusCode: 400, statusMessage: "You cannot delete your own administrator account" });
  const result = getDatabase().prepare("DELETE FROM users WHERE id = ?").run(id);
  if (!result.changes) throw createError({ statusCode: 404, statusMessage: "User not found" });
  return { ok: true };
});
