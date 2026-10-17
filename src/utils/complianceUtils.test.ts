import { describe, expect, it } from 'vitest';
import { getNmvtisStatus, isNmvtisBannerActive } from './complianceUtils';
import { NMVTISReportLog, YardSettings } from '@/types/scrap';

const settings = (over: Partial<YardSettings> = {}): YardSettings => ({
  yardName: 'Test Yard',
  address: '',
  cityStateZip: '',
  phone: '',
  email: '',
  licenseNumber: '',
  receiptHeader: '',
  receiptFooter: '',
  defaultWeightUnit: 'LBS',
  serialBaudRate: 9600,
  webSocketUrl: '',
  operatorName: 'Op',
  scales: [],
  currentScaleId: null,
  ...over,
});

const log = (exportedAt: string): NMVTISReportLog => ({
  id: `log-${exportedAt}`,
  batchId: 'B',
  exportedAt,
  ticketCount: 1,
  ticketIds: [],
  status: 'EXPORTED',
  exportedBy: 'Op',
});

describe('getNmvtisStatus', () => {
  it('uses the current month due day when no batch has ever been exported', () => {
    const status = getNmvtisStatus([], settings({ nmvtisReportingDayOfMonth: 1 }), new Date('2026-03-15T10:00:00'));
    expect(status.dueDate.getFullYear()).toBe(2026);
    expect(status.dueDate.getMonth()).toBe(2); // March
    expect(status.dueDate.getDate()).toBe(1);
    expect(status.daysUntilDue).toBe(-14);
    expect(status.isOverdue).toBe(true);
    expect(status.lastBatchDate).toBeNull();
  });

  it('schedules one cadence month after the last batch, on the due day', () => {
    const status = getNmvtisStatus(
      [log('2026-01-01T09:00:00')],
      settings({ nmvtisReportingDayOfMonth: 1, nmvtisCadenceMonths: 1 }),
      new Date('2026-01-15T10:00:00')
    );
    expect(status.dueDate.toISOString().startsWith('2026-02-01')).toBe(true);
    expect(status.daysUntilDue).toBe(17);
    expect(status.isOverdue).toBe(false);
  });

  it('supports quarterly cadence (3 months)', () => {
    const status = getNmvtisStatus(
      [log('2026-01-01T09:00:00')],
      settings({ nmvtisReportingDayOfMonth: 1, nmvtisCadenceMonths: 3 }),
      new Date('2026-02-01T10:00:00')
    );
    expect(status.dueDate.toISOString().startsWith('2026-04-01')).toBe(true);
    expect(status.daysUntilDue).toBe(59);
  });

  it('pushes the slot forward when the last batch was exported after its slot (late report)', () => {
    // Reported on the 20th for the 1st-of-month cadence → next due is the following cycle.
    const status = getNmvtisStatus(
      [log('2026-01-20T09:00:00')],
      settings({ nmvtisReportingDayOfMonth: 1, nmvtisCadenceMonths: 1 }),
      new Date('2026-01-21T10:00:00')
    );
    expect(status.dueDate.toISOString().startsWith('2026-03-01')).toBe(true);
  });

  it('handles year rollover across the due slot', () => {
    const status = getNmvtisStatus(
      [log('2025-12-01T09:00:00')],
      settings({ nmvtisReportingDayOfMonth: 1, nmvtisCadenceMonths: 1 }),
      new Date('2025-12-15T10:00:00')
    );
    expect(status.dueDate.toISOString().startsWith('2026-01-01')).toBe(true);
  });

  it('uses the most recent batch when several exist', () => {
    const status = getNmvtisStatus(
      [log('2026-01-01T09:00:00'), log('2026-02-01T09:00:00')],
      settings({ nmvtisReportingDayOfMonth: 1 }),
      new Date('2026-02-02T10:00:00')
    );
    expect(status.lastBatchDate).toBe('2026-02-01T09:00:00');
    expect(status.dueDate.toISOString().startsWith('2026-03-01')).toBe(true);
  });

  it('flags overdue on the day after the due date', () => {
    const status = getNmvtisStatus(
      [log('2025-12-01T09:00:00')],
      settings({ nmvtisReportingDayOfMonth: 1 }),
      new Date('2026-01-02T10:00:00')
    );
    expect(status.isOverdue).toBe(true);
    expect(status.daysUntilDue).toBe(-1);
    expect(isNmvtisBannerActive(status)).toBe(true);
  });

  it('banner inactive when far from due', () => {
    const status = getNmvtisStatus(
      [log('2026-01-01T09:00:00')],
      settings({ nmvtisReportingDayOfMonth: 1 }),
      new Date('2026-01-10T10:00:00')
    );
    expect(isNmvtisBannerActive(status)).toBe(false);
  });
});
