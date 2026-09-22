import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { auditFor, recordAudit } from "../../../utils/audit";
import { createUserId, hashPassword, isRole, requireAdmin, toPublicUser, type UserRow } from "../../../utils/auth";
import { query } from "../../../utils/db";

// Admin-side account creation: the new account starts APPROVED (no
// self-registration pending queue) and, unlike /api/auth/register, this never
// creates a session — the admin stays logged in as themselves.
export default defineHandler(async (event) => {
  const admin = await requireAdmin(event);
  const body = await readBody<{ fullName?: string; username?: string; password?: string; email?: string; role?: string }>(event);
  const fullName = body.fullName?.trim();
  const username = body.username?.trim().toLowerCase();
  const email = body.email?.trim().toLowerCase() || null;
  if (!fullName || !username || !body.password || body.password.length < 8 || !isRole(body.role)) {
    throw createError({ statusCode: 400, statusMessage: "Valid account details, a role, and an 8-character password are required" });
  }

  const id = createUserId();
  const now = new Date();
  try {
    const result = await query<UserRow>(`
      INSERT INTO users (id, full_name, username, email, password_hash, role, status, created_at, approved_at, approved_by)
      VALUES ($1, $2, $3, $4, $5, $6, 'approved', $7, $7, $8)
      RETURNING *
    `, [id, fullName, username, email, hashPassword(body.password), body.role, now, admin.id]);
    const user = toPublicUser(result.rows[0]);
    await recordAudit(auditFor(admin, {
      action: "user.create",
      entity: "users",
      entityId: id,
      detail: { username, role: body.role, createdBy: admin.username },
    }));
    return { user };
  } catch (error: any) {
    if (error?.code === "23505") {
      throw createError({ statusCode: 409, statusMessage: "Username or email is already registered" });
    }
    throw error;
  }
});
