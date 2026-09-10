import type { YardSettings } from "@/types/scrap";

export type HoldStatus =
  | { status: "HOLD_ACTIVE"; daysLeft: number; holdUntil: string }
  | { status: "HOLD_EXPIRED"; holdUntil: string }
  | { status: "NO_HOLD" };

export interface HoldRecord {
  /** ISO date the vehicle entered the yard (ticket createdAt / dateSetInYard). */
  intakeDate: string;
  /** ISO deadline stamped at intake. Legacy records may not have it. */
  holdUntil?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function effectiveHoldDays(settings: Pick<YardSettings, "crushHoldDays" | "crushHoldEnabled">): number {
  if (settings.crushHoldEnabled === false) return 0;
  const days = Number(settings.crushHoldDays);
  return Number.isFinite(days) && days > 0 ? Math.round(days) : 30;
}

/**
 * Lazy backfill: legacy records never got a holdUntil stamped. Derive it from
 * the intake date + the currently configured hold length.
 */
export function resolveHoldUntil(record: HoldRecord, settings: Pick<YardSettings, "crushHoldDays" | "crushHoldEnabled">): string | null {
  const days = effectiveHoldDays(settings);
  if (days <= 0) return null;
  if (record.holdUntil) return record.holdUntil;
  if (!record.intakeDate) return null;
  const intake = new Date(record.intakeDate).getTime();
  if (!Number.isFinite(intake)) return null;
  return new Date(intake + days * DAY_MS).toISOString();
}

/**
 * HOLD_ACTIVE while now < holdUntil (days left counted in whole days),
 * HOLD_EXPIRED once the deadline has passed, NO_HOLD when the feature is off.
 */
export function holdStatus(
  record: HoldRecord,
  settings: Pick<YardSettings, "crushHoldDays" | "crushHoldEnabled">,
  now: Date = new Date(),
): HoldStatus {
  if (settings.crushHoldEnabled === false) return { status: "NO_HOLD" };

  const holdUntil = resolveHoldUntil(record, settings);
  if (!holdUntil) return { status: "NO_HOLD" };

  const deadline = new Date(holdUntil).getTime();
  if (!Number.isFinite(deadline)) return { status: "NO_HOLD" };

  const remainingMs = deadline - now.getTime();
  if (remainingMs <= 0) {
    return { status: "HOLD_EXPIRED", holdUntil };
  }
  return {
    status: "HOLD_ACTIVE",
    daysLeft: Math.max(1, Math.ceil(remainingMs / DAY_MS)),
    holdUntil,
  };
}

/** Stamp applied at salvage intake: intakeDate + crushHoldDays. */
export function computeHoldUntil(intakeDate: string, settings: Pick<YardSettings, "crushHoldDays" | "crushHoldEnabled">): string | undefined {
  const days = effectiveHoldDays(settings);
  if (days <= 0) return undefined;
  const intake = new Date(intakeDate).getTime();
  if (!Number.isFinite(intake)) return undefined;
  return new Date(intake + days * DAY_MS).toISOString();
}
