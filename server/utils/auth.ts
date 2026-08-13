import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { createError, deleteCookie, getCookie, setCookie } from "nitro/h3";
import type { H3Event } from "nitro/h3";
import { query } from "./db";

export type UserRole = "admin" | "yard_manager" | "scale_operator" | "yard_employee";
export type AccountStatus = "pending" | "approved" | "rejected" | "disabled";

export interface PublicUser {
  id: string;
  fullName: string;
  username: string;
  email?: string;
  role: UserRole;
  status: AccountStatus;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  updatedAt?: string;
}

export interface UserRow {
  id: string;
  full_name: string;
  username: string;
  email: string | null;
  password_hash: string;
  role: UserRole;
  status: AccountStatus;
  created_at: Date | string;
  approved_at: Date | string | null;
  approved_by: string | null;
  updated_at: Date | string | null;
}

const SESSION_COOKIE = "mahaffeys_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 14;
const asIso = (value: Date | string) => value instanceof Date ? value.toISOString() : value;

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    email: row.email || undefined,
    role: row.role,
    status: row.status,
    createdAt: asIso(row.created_at),
    approvedAt: row.approved_at ? asIso(row.approved_at) : undefined,
    approvedBy: row.approved_by || undefined,
    updatedAt: row.updated_at ? asIso(row.updated_at) : undefined,
  };
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(event: H3Event, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_SECONDS * 1000);
  await query("DELETE FROM sessions WHERE expires_at <= NOW()");
  await query(
    "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES ($1, $2, $3, $4)",
    [tokenHash(token), userId, expiresAt, now],
  );
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NITRO_COOKIE_SECURE === "true",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_LIFETIME_SECONDS,
  });
}

export async function clearSession(event: H3Event) {
  const token = getCookie(event, SESSION_COOKIE);
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash(token)]);
  deleteCookie(event, SESSION_COOKIE, { path: "/" });
}

export async function getSessionUser(event: H3Event): Promise<PublicUser | null> {
  const token = getCookie(event, SESSION_COOKIE);
  if (!token) return null;
  const result = await query<UserRow>(`
    SELECT u.* FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1 AND s.expires_at > NOW()
  `, [tokenHash(token)]);
  return result.rows[0] ? toPublicUser(result.rows[0]) : null;
}

export async function requireUser(event: H3Event) {
  const user = await getSessionUser(event);
  if (!user || user.status !== "approved") {
    throw createError({ statusCode: 401, statusMessage: "Authentication required" });
  }
  return user;
}

export async function requireAdmin(event: H3Event) {
  const user = await requireUser(event);
  if (user.role !== "admin") {
    throw createError({ statusCode: 403, statusMessage: "Administrator access required" });
  }
  return user;
}

export function createUserId() {
  return `usr-${randomUUID()}`;
}

export function isRole(value: unknown): value is UserRole {
  return value === "admin" || value === "yard_manager" || value === "scale_operator" || value === "yard_employee";
}

export function isStatus(value: unknown): value is AccountStatus {
  return value === "pending" || value === "approved" || value === "rejected" || value === "disabled";
}
