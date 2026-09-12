import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { createSession, toPublicUser, verifyPassword, type UserRow } from "../../../utils/auth";
import { recordAudit } from "../../../utils/audit";
import { query } from "../../../utils/db";

export default defineHandler(async (event) => {
  const body = await readBody<{ username?: string; password?: string }>(event);
  const identifier = body.username?.trim().toLowerCase();
  if (!identifier || !body.password) {
    throw createError({ statusCode: 400, statusMessage: "Username and password are required" });
  }

  const result = await query<UserRow>("SELECT * FROM users WHERE LOWER(username) = $1 OR LOWER(email) = $1 LIMIT 1", [identifier]);
  const row = result.rows[0];
  if (!row || !verifyPassword(body.password, row.password_hash)) {
    await recordAudit({
      userId: row?.id ?? null,
      userName: identifier,
      action: "auth.login_failed",
      entity: "auth",
      entityId: row?.id ?? null,
      detail: { reason: !row ? "unknown_user" : "bad_password" },
    });
    throw createError({ statusCode: 401, statusMessage: "Invalid username or password" });
  }
  if (row.status === "disabled" || row.status === "rejected") {
    await recordAudit({
      userId: row.id,
      userName: row.full_name,
      action: "auth.login_failed",
      entity: "auth",
      entityId: row.id,
      detail: { reason: `account_${row.status}` },
    });
    throw createError({ statusCode: 403, statusMessage: "Account access is disabled or rejected" });
  }
  await createSession(event, row.id);
  await recordAudit({
    userId: row.id,
    userName: row.full_name,
    action: "auth.login",
    entity: "auth",
    entityId: row.id,
    detail: { username: row.username },
  });
  return { user: toPublicUser(row) };
});
