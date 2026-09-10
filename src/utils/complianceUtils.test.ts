import { describe, expect, it } from "vitest";
import { getNmvtisStatus, isNmvtisDueSoon } from "./complianceUtils";

const settings = { nmvtisReportingDayOfMonth: 1, nmvtisCadenceMonths: 1 };

describe("getNmvtisStatus", () => {
  it("uses the upcoming reporting day when no batches exist", () => {
    const status = getNmvtisStatus([], settings, new Date("2025-04-05T15:00:00.000Z"));
    // May 1st is the next 1st-of-month after April 5.
    expect(status.dueDate).toBe("2025-05-01T12:00:00.000Z");
    expect(status.daysUntilDue).toBe(26);
    expect(status.isOverdue).toBe(false);
    expect(status.lastBatchDate).toBeNull();
  });

  it("keeps this month's deadline when it has not passed yet", () => {
    const status = getNmvtisStatus([], settings, new Date("2025-04-01T00:00:00.000Z"));
    expect(status.dueDate).toBe("2025-04-01T12:00:00.000Z");
    expect(status.isOverdue).toBe(false);
  });

  it("schedules one cadence month after the last batch", () => {
    const status = getNmvtisStatus(
      [{ exportedAt: "2025-03-01T14:20:00.000Z" }],
      settings,
      new Date("2025-03-20T10:00:00.000Z"),
    );
    expect(status.dueDate).toBe("2025-04-01T12:00:00.000Z");
    expect(status.daysUntilDue).toBe(13);
    expect(status.isOverdue).toBe(false);
    expect(status.lastBatchDate).toBe("2025-03-01T14:20:00.000Z");
  });

  it("flags overdue when the deadline has passed", () => {
    const status = getNmvtisStatus(
      [{ exportedAt: "2025-03-01T14:20:00.000Z" }],
      settings,
      new Date("2025-04-10T10:00:00.000Z"),
    );
    expect(status.dueDate).toBe("2025-04-01T12:00:00.000Z");
    expect(status.isOverdue).toBe(true);
    expect(status.daysUntilDue).toBeLessThan(0);
  });

  it("supports quarterly cadences", () => {
    const status = getNmvtisStatus(
      [{ exportedAt: "2025-01-01T14:00:00.000Z" }],
      { nmvtisReportingDayOfMonth: 1, nmvtisCadenceMonths: 3 },
      new Date("2025-02-01T00:00:00.000Z"),
    );
    expect(status.dueDate).toBe("2025-04-01T12:00:00.000Z");
  });

  it("honours a mid-month reporting day", () => {
    const status = getNmvtisStatus(
      [{ exportedAt: "2025-03-15T09:00:00.000Z" }],
      { nmvtisReportingDayOfMonth: 15, nmvtisCadenceMonths: 1 },
      new Date("2025-03-16T09:00:00.000Z"),
    );
    expect(status.dueDate).toBe("2025-04-15T12:00:00.000Z");
  });

  it("clamps the reporting day into short months", () => {
    const status = getNmvtisStatus(
      [{ exportedAt: "2025-01-31T09:00:00.000Z" }],
      { nmvtisReportingDayOfMonth: 31, nmvtisCadenceMonths: 1 },
      new Date("2025-02-01T00:00:00.000Z"),
    );
    // February 2025 has 28 days.
    expect(status.dueDate).toBe("2025-02-28T12:00:00.000Z");
  });

  it("ignores invalid cadence settings and falls back to monthly", () => {
    const status = getNmvtisStatus(
      [{ exportedAt: "2025-03-01T09:00:00.000Z" }],
      {},
      new Date("2025-03-02T00:00:00.000Z"),
    );
    expect(status.dueDate).toBe("2025-04-01T12:00:00.000Z");
  });
});

describe("isNmvtisDueSoon", () => {
  it("is true when overdue or within the window", () => {
    expect(isNmvtisDueSoon({ dueDate: "", isOverdue: true, daysUntilDue: -3, lastBatchDate: null })).toBe(true);
    expect(isNmvtisDueSoon({ dueDate: "", isOverdue: false, daysUntilDue: 7, lastBatchDate: null })).toBe(true);
  });

  it("is false outside the window", () => {
    expect(isNmvtisDueSoon({ dueDate: "", isOverdue: false, daysUntilDue: 8, lastBatchDate: null })).toBe(false);
  });
});
