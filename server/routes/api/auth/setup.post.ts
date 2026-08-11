import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { createSession, createUserId, hashPassword, toPublicUser, type UserRow } from "../../../utils/auth";
import { withTransaction } from "../../../utils/db";

export default defineHandler(async (event) => {
  const body = await readBody<{ fullName?: string; username?: string; password?: string; email?: string }>(event);
  const fullName = body.fullName?.trim();
  const username = body.username?.trim().toLowerCase();
  const email = body.email?.trim().toLowerCase() || null;
  if (!fullName || !username || !body.password || body.password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: "Name, username, and an 8-character password are required" });
  }

  const id = createUserId();
  const now = new Date();
  let row: UserRow;
  try {
    row = await withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('scrapflow_initial_admin'))");
      const existing = await client.query("SELECT id FROM users WHERE role = 'admin' AND status = 'approved' LIMIT 1");
      if (existing.rowCount) {
        throw createError({ statusCode: 409, statusMessage: "Administrator setup is already complete" });
      }
      const result = await client.query<UserRow>(`
        INSERT INTO users (id, full_name, username, email, password_hash, role, status, created_at, approved_at)
        VALUES ($1, $2, $3, $4, $5, 'admin', 'approved', $6, $6)
        RETURNING *
      `, [id, fullName, username, email, hashPassword(body.password), now]);
      return result.rows[0];
    });
  } catch (error: any) {
    if (error?.statusCode === 409) throw error;
    if (error?.code === "23505") {
      throw createError({ statusCode: 409, statusMessage: "Username or email is already registered" });
    }
    throw error;
  }

  await createSession(event, id);
  return { user: toPublicUser(row) };
});
