import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { createError, deleteCookie, getCookie, setCookie } from "nitro/h3";
import type { H3Event } from "nitro/h3";
import { getDatabase } from "./db";

export type UserRole = "admin" | "yard_manager" | "scale_operator";
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

interface UserRow {
  id: string;
  full_name: string;
  username: string;
  email: string | null;
  password_hash: string;
  role: UserRole;
  status: AccountStatus;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  updated_at: string | null;
}

const SESSION_COOKIE = "scrapflow_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 14;

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    email: row.email || undefined,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    approvedAt: row.approved_at || undefined,
    approvedBy: row.approved_by || undefined,
    updatedAt: row.updated_at || undefined,
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

export function createSession(event: H3Event, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_SECONDS * 1000);
  const db = getDatabase();
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now.toISOString());
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .run(tokenHash(token), userId, expiresAt.toISOString(), now.toISOString());
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_LIFETIME_SECONDS,
  });
}

export function clearSession(event: H3Event) {
  const token = getCookie(event, SESSION_COOKIE);
  if (token) getDatabase().prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
  deleteCookie(event, SESSION_COOKIE, { path: "/" });
}

export function getSessionUser(event: H3Event): PublicUser | null {
  const token = getCookie(event, SESSION_COOKIE);
  if (!token) return null;
  const row = getDatabase().prepare(`
    SELECT u.* FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(tokenHash(token), new Date().toISOString()) as UserRow | undefined;
  return row ? toPublicUser(row) : null;
}

export function requireUser(event: H3Event) {
  const user = getSessionUser(event);
  if (!user || user.status !== "approved") {
    throw createError({ statusCode: 401, statusMessage: "Authentication required" });
  }
  return user;
}

export function requireAdmin(event: H3Event) {
  const user = requireUser(event);
  if (user.role !== "admin") {
    throw createError({ statusCode: 403, statusMessage: "Administrator access required" });
  }
  return user;
}

export function createUserId() {
  return `usr-${randomUUID()}`;
}

export function isRole(value: unknown): value is UserRole {
  return value === "admin" || value === "yard_manager" || value === "scale_operator";
}

export function isStatus(value: unknown): value is AccountStatus {
  return value === "pending" || value === "approved" || value === "rejected" || value === "disabled";
}
