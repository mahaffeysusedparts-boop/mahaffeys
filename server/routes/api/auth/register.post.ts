import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { createSession, createUserId, hashPassword, isRole, toPublicUser } from "../../../utils/auth";
import { getDatabase } from "../../../utils/db";

export default defineHandler(async (event) => {
  const body = await readBody<{ fullName?: string; username?: string; password?: string; email?: string; role?: string }>(event);
  const fullName = body.fullName?.trim();
  const username = body.username?.trim().toLowerCase();
  if (!fullName || !username || !body.password || body.password.length < 8 || !isRole(body.role)) {
    throw createError({ statusCode: 400, statusMessage: "Valid account details and an 8-character password are required" });
  }
  const id = createUserId();
  const now = new Date().toISOString();
  const db = getDatabase();
  try {
    db.prepare(`INSERT INTO users
      (id, full_name, username, email, password_hash, role, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`)
      .run(id, fullName, username, body.email?.trim().toLowerCase() || null, hashPassword(body.password), body.role, now);
  } catch {
    throw createError({ statusCode: 409, statusMessage: "Username or email is already registered" });
  }
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Parameters<typeof toPublicUser>[0];
  createSession(event, id);
  return { user: toPublicUser(row) };
});
