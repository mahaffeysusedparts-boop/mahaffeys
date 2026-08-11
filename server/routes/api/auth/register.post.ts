import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { createSession, createUserId, hashPassword, isRole, toPublicUser, type UserRow } from "../../../utils/auth";
import { query } from "../../../utils/db";

export default defineHandler(async (event) => {
  const body = await readBody<{ fullName?: string; username?: string; password?: string; email?: string; role?: string }>(event);
  const fullName = body.fullName?.trim();
  const username = body.username?.trim().toLowerCase();
  const email = body.email?.trim().toLowerCase() || null;
  if (!fullName || !username || !body.password || body.password.length < 8 || !isRole(body.role) || body.role === "admin") {
    throw createError({ statusCode: 400, statusMessage: "Valid account details, a staff role, and an 8-character password are required" });
  }

  const id = createUserId();
  try {
    const result = await query<UserRow>(`
      INSERT INTO users (id, full_name, username, email, password_hash, role, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
      RETURNING *
    `, [id, fullName, username, email, hashPassword(body.password), body.role, new Date()]);
    await createSession(event, id);
    return { user: toPublicUser(result.rows[0]) };
  } catch (error: any) {
    if (error?.code === "23505") {
      throw createError({ statusCode: 409, statusMessage: "Username or email is already registered" });
    }
    throw error;
  }
});
