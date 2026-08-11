import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { createSession, toPublicUser, verifyPassword } from "../../../utils/auth";
import { getDatabase } from "../../../utils/db";

export default defineHandler(async (event) => {
  const body = await readBody<{ username?: string; password?: string }>(event);
  const identifier = body.username?.trim().toLowerCase();
  if (!identifier || !body.password) throw createError({ statusCode: 400, statusMessage: "Username and password are required" });

  const row = getDatabase().prepare("SELECT * FROM users WHERE username = ? OR email = ?").get(identifier, identifier) as (Parameters<typeof toPublicUser>[0] & { password_hash: string }) | undefined;
  if (!row || !verifyPassword(body.password, row.password_hash)) {
    throw createError({ statusCode: 401, statusMessage: "Invalid username or password" });
  }
  if (row.status === "disabled" || row.status === "rejected") {
    throw createError({ statusCode: 403, statusMessage: "Account access is disabled or rejected" });
  }
  createSession(event, row.id);
  return { user: toPublicUser(row) };
});
