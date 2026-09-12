import { randomUUID } from "node:crypto";
import { query } from "./db";
import type { PublicUser } from "./auth";

export interface AuditEntry {
  /** Authenticated user performing the action (null for anonymous attempts). */
  userId?: string | null;
  userName: string;
  action: string;
  entity: string;
  entityId?: string | null;
  detail?: Record<string, unknown> | null;
}

/**
 * Records one audit-trail row. Never throws — an audit write must not break
 * the request it is attached to.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log (id, user_id, user_name, action, entity, entity_id, detail, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [
        `audit-${randomUUID()}`,
        entry.userId ?? null,
        entry.userName,
        entry.action,
        entry.entity,
        entry.entityId ?? null,
        JSON.stringify(entry.detail ?? {}),
        new Date(),
      ],
    );
  } catch (error) {
    console.warn("[audit] failed to record entry:", error instanceof Error ? error.message : error);
  }
}

/** Convenience: attribute an audit entry to the authenticated user. */
export function auditFor(user: PublicUser | null | undefined, entry: Omit<AuditEntry, "userId" | "userName">): AuditEntry {
  return {
    ...entry,
    userId: user?.id ?? null,
    userName: user?.fullName || user?.username || "Unknown user",
  };
}
