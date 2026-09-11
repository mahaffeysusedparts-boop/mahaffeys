import { describe, expect, it } from 'vitest';
import { holdStatus, resolveHoldUntil, computeHoldUntilForIntake, isCrushLocked } from './holdUtils';

const opts = { enabled: true, crushHoldDays: 30 };
const disabled = { enabled: false, crushHoldDays: 30 };

describe('holdStatus', () => {
  it('returns NO_HOLD when holds are disabled', () => {
    expect(holdStatus({ holdUntil: '2026-06-01T00:00:00Z' }, new Date('2026-01-01T00:00:00Z'), disabled)).toEqual({
      status: 'NO_HOLD',
    });
  });

  it('active hold counts remaining days', () => {
    const result = holdStatus({ holdUntil: '2026-01-31T00:00:00Z' }, new Date('2026-01-16T18:00:00Z'), opts);
    expect(result).toEqual({ status: 'HOLD_ACTIVE', daysLeft: 15, holdUntil: '2026-01-31T00:00:00Z' });
  });

  it('expires exactly on the hold-until day', () => {
    const result = holdStatus({ holdUntil: '2026-01-31T00:00:00Z' }, new Date('2026-01-31T09:00:00Z'), opts);
    expect(result.status).toBe('HOLD_EXPIRED');
  });

  it('is expired the day after hold-until', () => {
    const result = holdStatus({ holdUntil: '2026-01-31T00:00:00Z' }, new Date('2026-02-01T09:00:00Z'), opts);
    expect(result.status).toBe('HOLD_EXPIRED');
  });

  it('backfills legacy records from the intake/set-in-yard date', () => {
    // No holdUntil stamped — derive from startDateFallback + 30 days.
    const result = holdStatus({ startDateFallback: '2026-01-01T10:00:00Z' }, new Date('2026-01-16T10:00:00Z'), opts);
    expect(result.status).toBe('HOLD_ACTIVE');
    if (result.status === 'HOLD_ACTIVE') expect(result.daysLeft).toBe(15);
  });

  it('NO_HOLD when nothing is stamped and no fallback exists', () => {
    expect(holdStatus({}, new Date(), opts)).toEqual({ status: 'NO_HOLD' });
  });
});

describe('resolveHoldUntil / computeHoldUntilForIntake', () => {
  it('prefers the explicit stamp', () => {
    expect(resolveHoldUntil({ holdUntil: '2026-05-01T00:00:00Z', startDateFallback: '2026-01-01T00:00:00Z' }, opts)).toBe(
      '2026-05-01T00:00:00Z'
    );
  });

  it('stamps intake + crushHoldDays', () => {
    expect(computeHoldUntilForIntake(new Date('2026-01-01T00:00:00Z'), opts)).toBe('2026-01-31T00:00:00.000Z');
  });

  it('returns null when disabled', () => {
    expect(computeHoldUntilForIntake(new Date('2026-01-01T00:00:00Z'), disabled)).toBeNull();
  });
});

describe('isCrushLocked', () => {
  const subject = { holdUntil: '2026-01-31T00:00:00Z' };
  const now = new Date('2026-01-15T10:00:00Z');

  it('locks while the hold is active', () => {
    expect(isCrushLocked(subject, now, opts)).toBe(true);
  });

  it('unlocks once expired', () => {
    expect(isCrushLocked(subject, new Date('2026-02-05T10:00:00Z'), opts)).toBe(false);
  });

  it('unlocks when an override reason is already on file', () => {
    expect(isCrushLocked(subject, now, opts, { at: now.toISOString(), reason: 'Title verified with state' })).toBe(false);
  });
});
