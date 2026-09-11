/**
 * Title / crush-hold tracking for salvage vehicles.
 *
 * At intake the car record is stamped with `holdUntil` = intake + crushHoldDays.
 * Legacy records stamped before holds existed are backfilled lazily from their
 * set-in-yard / intake date. Crushing inside the hold window requires an admin
 * override whose reason is recorded on the vehicle record.
 */

export type HoldStatusResult =
  | { status: 'NO_HOLD' }
  | { status: 'HOLD_ACTIVE'; daysLeft: number; holdUntil: string }
  | { status: 'HOLD_EXPIRED'; holdUntil: string };

export interface HoldSubject {
  /** Explicit hold expiry stamped at intake. */
  holdUntil?: string;
  /** Lazy backfill source for legacy records: dateSetInYard / ticket createdAt. */
  startDateFallback?: string;
}

export interface HoldOptions {
  enabled: boolean;
  crushHoldDays: number;
}

const DAY_MS = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Returns the effective hold expiry for a subject, or null when none applies. */
export function resolveHoldUntil(subject: HoldSubject, opts: HoldOptions): string | null {
  if (!opts.enabled) return null;
  if (subject.holdUntil) return subject.holdUntil;
  if (subject.startDateFallback) {
    const start = new Date(subject.startDateFallback);
    if (!Number.isNaN(start.getTime())) {
      return new Date(start.getTime() + opts.crushHoldDays * DAY_MS).toISOString();
    }
  }
  return null;
}

/** Hold expiry to stamp on a freshly-intaked salvage vehicle (null when holds are off). */
export function computeHoldUntilForIntake(intakeDate: Date, opts: HoldOptions): string | null {
  if (!opts.enabled) return null;
  return new Date(intakeDate.getTime() + opts.crushHoldDays * DAY_MS).toISOString();
}

export function holdStatus(subject: HoldSubject, now: Date, opts: HoldOptions): HoldStatusResult {
  const holdUntil = resolveHoldUntil(subject, opts);
  if (!holdUntil) return { status: 'NO_HOLD' };

  const end = new Date(holdUntil);
  if (Number.isNaN(end.getTime())) return { status: 'NO_HOLD' };

  const daysLeft = Math.round((startOfDay(end).getTime() - startOfDay(now).getTime()) / DAY_MS);
  if (daysLeft > 0) {
    return { status: 'HOLD_ACTIVE', daysLeft, holdUntil };
  }
  return { status: 'HOLD_EXPIRED', holdUntil };
}

/** True when crushing requires an admin override right now. */
export function isCrushLocked(subject: HoldSubject, now: Date, opts: HoldOptions, override?: { at: string; reason: string } | null): boolean {
  if (override?.reason) return false; // already overridden — the reason is on file
  const status = holdStatus(subject, now, opts);
  return status.status === 'HOLD_ACTIVE';
}
