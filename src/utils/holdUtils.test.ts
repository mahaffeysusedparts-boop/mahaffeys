import { describe, expect, it } from "vitest";
import { computeHoldUntil, holdStatus, resolveHoldUntil } from "./holdUtils";

const settings = { crushHoldDays: 30, crushHoldEnabled: true };
const intake = "2025-03-01T10:00:00.000Z";

describe("holdStatus", () => {
  it("is active with days left during the window", () => {
    const status = holdStatus({ intakeDate: intake, holdUntil: "2025-03-31T10:00:00.000Z" }, settings, new Date("2025-03-16T10:00:00.000Z"));
    expect(status).toEqual({ status: "HOLD_ACTIVE", daysLeft: 15, holdUntil: "2025-03-31T10:00:00.000Z" });
  });

  it("reports one day left on the final partial day", () => {
    const status = holdStatus({ intakeDate: intake, holdUntil: "2025-03-31T10:00:00.000Z" }, settings, new Date("2025-03-31T09:59:59.000Z"));
    expect(status.status).toBe("HOLD_ACTIVE");
    if (status.status === "HOLD_ACTIVE") expect(status.daysLeft).toBe(1);
  });

  it("expires exactly at the deadline (boundary)", () => {
    const status = holdStatus({ intakeDate: intake, holdUntil: "2025-03-31T10:00:00.000Z" }, settings, new Date("2025-03-31T10:00:00.000Z"));
    expect(status).toEqual({ status: "HOLD_EXPIRED", holdUntil: "2025-03-31T10:00:00.000Z" });
  });

  it("stays expired afterwards", () => {
    const status = holdStatus({ intakeDate: intake, holdUntil: "2025-03-31T10:00:00.000Z" }, settings, new Date("2025-06-01T00:00:00.000Z"));
    expect(status.status).toBe("HOLD_EXPIRED");
  });

  it("backfills legacy records from the intake date", () => {
    const backfilled = resolveHoldUntil({ intakeDate: intake }, settings);
    expect(backfilled).toBe("2025-03-31T10:00:00.000Z");

    const status = holdStatus({ intakeDate: intake }, settings, new Date("2025-03-05T10:00:00.000Z"));
    expect(status.status).toBe("HOLD_ACTIVE");
    if (status.status === "HOLD_ACTIVE") expect(status.daysLeft).toBe(26);
  });

  it("returns NO_HOLD when the feature is switched off", () => {
    const off = { crushHoldDays: 30, crushHoldEnabled: false };
    expect(holdStatus({ intakeDate: intake, holdUntil: "2099-01-01T00:00:00.000Z" }, off)).toEqual({ status: "NO_HOLD" });
    expect(resolveHoldUntil({ intakeDate: intake }, off)).toBeNull();
  });

  it("falls back to a 30-day default when the setting is missing", () => {
    expect(resolveHoldUntil({ intakeDate: intake }, {})).toBe("2025-03-31T10:00:00.000Z");
  });

  it("treats a corrupt holdUntil as no hold", () => {
    expect(holdStatus({ intakeDate: intake, holdUntil: "not-a-date" }, settings).status).toBe("NO_HOLD");
  });
});

describe("computeHoldUntil", () => {
  it("stamps intake + hold days", () => {
    expect(computeHoldUntil(intake, settings)).toBe("2025-03-31T10:00:00.000Z");
  });

  it("stamps nothing when the hold is disabled", () => {
    expect(computeHoldUntil(intake, { crushHoldDays: 30, crushHoldEnabled: false })).toBeUndefined();
  });
});
