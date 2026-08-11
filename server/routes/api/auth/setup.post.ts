import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { createSession, createUserId, hashPassword, toPublicUser } from "../../../utils/auth";
import { getDatabase } from "../../../utils/db";

export default defineHandler(async (event) => {
  const body = await readBody<{ fullName?: string; username?: string; password?: string; email?: string }>(event);
  const fullName = body.fullName?.trim();
  const username = body.username?.trim().toLowerCase();
  if (!fullName || !username || !body.password || body.password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: "Name, username, and an 8-character password are required" });
  }

  const db = getDatabase();
  const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' AND status = 'approved'").get();
  if (admin) throw createError({ statusCode: 409, statusMessage: "Administrator setup is already complete" });

  const now = new Date().toISOString();
  const id = createUserId();
  try {
    db.prepare(`INSERT INTO users
      (id, full_name, username, email, password_hash, role, status, created_at, approved_at)
      VALUES (?, ?, ?, ?, ?, 'admin', 'approved', ?, ?)`)
      .run(id, fullName, username, body.email?.trim().toLowerCase() || null, hashPassword(body.password), now, now);
  } catch {
    throw createError({ statusCode: 409, statusMessage: "Username or email is already registered" });
  }
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Parameters<typeof toPublicUser>[0];
  createSession(event, id);
  return { user: toPublicUser(row) };
});
