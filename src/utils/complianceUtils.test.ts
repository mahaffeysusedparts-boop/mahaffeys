import { describe, expect, it } from 'vitest';
import {
  getNmvtisStatus,
  isNmvtisBannerActive,
  calculateReadiness,
  getReportStatus,
  validateExportBatch,
  getReportStatusLabel,
  getCurrentOperatorName,
  generateNMVTISCsv,
} from './complianceUtils';
import { Ticket, NMVTISReportLog, YardSettings, CarIntakeRecord, ComplianceCaptures } from '@/types/scrap';

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

const log = (exportedAt: string, status: NMVTISReportLog['status'] = 'EXPORTED'): NMVTISReportLog => ({
  id: `log-${exportedAt}`,
  batchId: 'B',
  exportedAt,
  ticketCount: 1,
  ticketIds: [],
  status,
  exportedBy: 'Op',
});

// ── Helpers for building test tickets ──────────────────────────────────────

const fullCaptures: ComplianceCaptures = {
  personPhotoUrl: 'data:image/jpeg;base64,aaa',
  idPhotoUrl: 'data:image/jpeg;base64,bbb',
  vehiclePhotoUrl: 'data:image/jpeg;base64,ccc',
  licensePlatePhotoUrl: 'data:image/jpeg;base64,ddd',
  loadPhotoUrl: 'data:image/jpeg;base64,eee',
};

const carRecord = (over: Partial<CarIntakeRecord> = {}): CarIntakeRecord => ({
  vin: '1HGBH41JXMN109186',
  year: 2020,
  make: 'Toyota',
  model: 'Camry',
  color: 'Silver',
  titleStatus: 'Clean Title',
  titleNumber: 'TITLE-123',
  hasCatalyticConverter: true,
  catCondition: 'Original OEM',
  hasEngineAndTrans: true,
  hasBattery: true,
  hasAluminumRims: true,
  fluidsDrained: true,
  pricingMode: 'TONNAGE',
  vehicleWeightLbs: 3500,
  ratePerTon: 100,
  flatRate: 0,
  catBonus: 0,
  engineBonus: 0,
  batteryBonus: 0,
  deductions: 0,
  totalPayout: 0,
  ...over,
});

const carTicket = (over: Partial<Ticket> = {}): Ticket => ({
  id: 'T-001',
  ticketType: 'CAR_SALVAGE',
  createdAt: '2026-01-15T10:00:00Z',
  status: 'COMPLETED',
  customerName: 'John Doe',
  customerIdNumber: 'DL-12345678',
  vehicleLicensePlate: 'GA 123ABC',
  carRecord: carRecord(),
  grossTotal: 100,
  totalDeductions: 0,
  finalPayout: 100,
  payoutMethod: 'Cash',
  operatorName: 'Op',
  ...over,
});

const scrapTicket = (over: Partial<Ticket> = {}): Ticket => ({
  id: 'T-002',
  ticketType: 'SCRAP_METAL',
  createdAt: '2026-01-15T10:00:00Z',
  status: 'COMPLETED',
  customerName: 'Jane Smith',
  customerIdNumber: 'DL-87654321',
  vehicleLicensePlate: 'GA 987XYZ',
  grossTotal: 50,
  totalDeductions: 0,
  finalPayout: 50,
  payoutMethod: 'Cash',
  operatorName: 'Op',
  ...over,
});

// ── NMVTIS status (existing tests) ─────────────────────────────────────────

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

  it('keeps the next monthly slot after a late batch without skipping a reporting month', () => {
    const status = getNmvtisStatus(
      [log('2026-01-20T09:00:00')],
      settings({ nmvtisReportingDayOfMonth: 1, nmvtisCadenceMonths: 1 }),
      new Date('2026-01-21T10:00:00')
    );
    expect(status.dueDate.getFullYear()).toBe(2026);
    expect(status.dueDate.getMonth()).toBe(1);
    expect(status.dueDate.getDate()).toBe(1);
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

// ── Readiness ──────────────────────────────────────────────────────────────

describe('calculateReadiness', () => {
  it('returns COMPLETE for a fully-evidenced CAR_SALVAGE ticket', () => {
    const ticket = carTicket({ complianceCaptures: { ...fullCaptures } });
    const result = calculateReadiness(ticket);
    expect(result.status).toBe('COMPLETE');
    expect(result.score).toBe(100);
    expect(result.missingItems).toHaveLength(0);
    expect(result.isVoided).toBe(false);
    expect(result.isExported).toBe(false);
    expect(result.isConfirmed).toBe(false);
  });

  it('returns INCOMPLETE when required photos are missing (CAR_SALVAGE)', () => {
    const ticket = carTicket({
      complianceCaptures: { personPhotoUrl: 'data:image/jpeg;base64,x', vehiclePhotoUrl: 'data:image/jpeg;base64,y' },
    });
    const result = calculateReadiness(ticket);
    expect(result.status).toBe('INCOMPLETE');
    expect(result.score).toBe(50);
    expect(result.missingItems).toEqual(['License Plate Photo', 'Scrap Cargo Photo']);
  });

  it('returns INCOMPLETE for a voided ticket even with full evidence', () => {
    const ticket = carTicket({ status: 'VOIDED', complianceCaptures: { ...fullCaptures } });
    const result = calculateReadiness(ticket);
    expect(result.status).toBe('INCOMPLETE');
    expect(result.isVoided).toBe(true);
  });

  it('returns INVALID_DATA for a CAR_SALVAGE ticket with a bad VIN', () => {
    const ticket = carTicket({
      carRecord: carRecord({ vin: 'SHORT' }),
      complianceCaptures: { ...fullCaptures },
    });
    const result = calculateReadiness(ticket);
    expect(result.status).toBe('INVALID_DATA');
    expect(result.warnings.some((w) => w.includes('VIN'))).toBe(true);
  });

  it('returns PENDING_EXPORT for a ticket already exported but not confirmed', () => {
    const ticket = carTicket({
      complianceCaptures: { ...fullCaptures, nmvtisReported: true, nmvtisReportedAt: '2026-01-20T00:00:00Z', nmvtisBatchId: 'B1' },
    });
    const result = calculateReadiness(ticket);
    expect(result.status).toBe('PENDING_EXPORT');
    expect(result.isExported).toBe(true);
    expect(result.isConfirmed).toBe(false);
  });

  it('returns PENDING_EXPORT for a ticket that is submission-confirmed', () => {
    const ticket = carTicket({
      complianceCaptures: {
        ...fullCaptures,
        nmvtisReported: true,
        nmvtisReportedAt: '2026-01-20T00:00:00Z',
        nmvtisBatchId: 'B1',
        nmvtisSubmissionConfirmedAt: '2026-01-21T00:00:00Z',
        nmvtisSubmissionConfirmedBy: 'Admin',
      },
    });
    const result = calculateReadiness(ticket);
    expect(result.status).toBe('PENDING_EXPORT');
    expect(result.isConfirmed).toBe(true);
  });

  it('uses SCRAP_METAL requirements (5 photos) instead of CAR_SALVAGE (4 photos)', () => {
    const ticket = scrapTicket({
      complianceCaptures: { personPhotoUrl: 'a', vehiclePhotoUrl: 'b', licensePlatePhotoUrl: 'c', loadPhotoUrl: 'd' },
    });
    const result = calculateReadiness(ticket);
    expect(result.status).toBe('INCOMPLETE');
    expect(result.missingItems).toEqual(['ID Scan']);
    expect(result.score).toBe(80);
  });

  it('returns COMPLETE for a fully-evidenced SCRAP_METAL ticket', () => {
    const ticket = scrapTicket({ complianceCaptures: { ...fullCaptures } });
    const result = calculateReadiness(ticket);
    expect(result.status).toBe('COMPLETE');
    expect(result.score).toBe(100);
  });

  it('flags missing jurisdictional data as warnings for CAR_SALVAGE', () => {
    const ticket = carTicket({
      carRecord: carRecord({ titleNumber: undefined }),
      customerIdNumber: undefined,
      vehicleLicensePlate: undefined,
      complianceCaptures: { ...fullCaptures },
    });
    const result = calculateReadiness(ticket);
    expect(result.status).toBe('COMPLETE');
    expect(result.warnings).toContain('Title number missing');
    expect(result.warnings).toContain('Seller ID number missing');
    expect(result.warnings).toContain('Vehicle license plate missing');
  });

  it('handles missing captures gracefully (MISSING → INCOMPLETE)', () => {
    const ticket = carTicket({ complianceCaptures: undefined });
    const result = calculateReadiness(ticket);
    expect(result.status).toBe('INCOMPLETE');
    expect(result.score).toBe(0);
    expect(result.missingItems).toHaveLength(4);
  });

  it('reads report flags from carRecord.complianceCaptures when ticket-level is absent', () => {
    const ticket = carTicket({
      complianceCaptures: undefined,
      carRecord: carRecord({
        complianceCaptures: { ...fullCaptures, nmvtisReported: true, nmvtisReportedAt: '2026-01-20T00:00:00Z', nmvtisBatchId: 'B1' },
      }),
    });
    const result = calculateReadiness(ticket);
    expect(result.status).toBe('PENDING_EXPORT');
    expect(result.isExported).toBe(true);
  });
});

// ── Report lifecycle status ────────────────────────────────────────────────

describe('getReportStatus', () => {
  it('returns READY for an unexported, valid ticket', () => {
    const ticket = carTicket({ complianceCaptures: { ...fullCaptures } });
    expect(getReportStatus(ticket)).toBe('READY');
  });

  it('returns EXPORTED for a ticket with nmvtisReported but no confirmation', () => {
    const ticket = carTicket({
      complianceCaptures: { ...fullCaptures, nmvtisReported: true, nmvtisReportedAt: '2026-01-20T00:00:00Z', nmvtisBatchId: 'B1' },
    });
    expect(getReportStatus(ticket)).toBe('EXPORTED');
  });

  it('returns SUBMISSION_CONFIRMED when confirmation metadata is present', () => {
    const ticket = carTicket({
      complianceCaptures: {
        ...fullCaptures,
        nmvtisReported: true,
        nmvtisReportedAt: '2026-01-20T00:00:00Z',
        nmvtisBatchId: 'B1',
        nmvtisSubmissionConfirmedAt: '2026-01-21T00:00:00Z',
        nmvtisSubmissionConfirmedBy: 'Admin',
      },
    });
    expect(getReportStatus(ticket)).toBe('SUBMISSION_CONFIRMED');
  });

  it('returns DISCREPANCY for a ticket with an invalid VIN', () => {
    const ticket = carTicket({
      carRecord: carRecord({ vin: 'BAD' }),
      complianceCaptures: { ...fullCaptures },
    });
    expect(getReportStatus(ticket)).toBe('DISCREPANCY');
  });
});

// ── Export batch validation ────────────────────────────────────────────────

describe('validateExportBatch', () => {
  it('excludes voided tickets from the included count', () => {
    const tickets = [
      carTicket({ id: 'T-1', complianceCaptures: { ...fullCaptures } }),
      carTicket({ id: 'T-2', status: 'VOIDED', complianceCaptures: { ...fullCaptures } }),
    ];
    const result = validateExportBatch(tickets);
    expect(result.totalTickets).toBe(2);
    expect(result.excludedVoided).toBe(1);
    expect(result.includedTickets).toBe(1);
    expect(result.canExport).toBe(true);
  });

  it('blocks export when a ticket has invalid VIN data', () => {
    const tickets = [
      carTicket({ id: 'T-1', carRecord: carRecord({ vin: 'BAD' }), complianceCaptures: { ...fullCaptures } }),
    ];
    const result = validateExportBatch(tickets);
    expect(result.canExport).toBe(false);
    expect(result.blockedRows).toHaveLength(1);
    expect(result.blockedRows[0].issues.some((i) => i.includes('VIN'))).toBe(true);
  });

  it('warns (but allows) when jurisdictional data is missing', () => {
    const tickets = [
      carTicket({
        id: 'T-1',
        carRecord: carRecord({ titleNumber: undefined }),
        customerIdNumber: undefined,
        vehicleLicensePlate: undefined,
        complianceCaptures: { ...fullCaptures },
      }),
    ];
    const result = validateExportBatch(tickets);
    expect(result.canExport).toBe(true);
    expect(result.warnedRows).toHaveLength(1);
    expect(result.includedTickets).toBe(1);
  });

  it('blocks export when required evidence is missing', () => {
    const tickets = [
      carTicket({ id: 'T-1', complianceCaptures: { personPhotoUrl: 'a' } }),
    ];
    const result = validateExportBatch(tickets);
    expect(result.canExport).toBe(false);
    expect(result.blockedRows).toHaveLength(1);
    expect(result.blockedRows[0].issues.some((i) => i.includes('Missing evidence'))).toBe(true);
  });

  it('matches included count to actual exportable rows', () => {
    const tickets = [
      carTicket({ id: 'T-1', complianceCaptures: { ...fullCaptures } }),
      carTicket({ id: 'T-2', complianceCaptures: { ...fullCaptures } }),
      carTicket({ id: 'T-3', status: 'VOIDED', complianceCaptures: { ...fullCaptures } }),
    ];
    const result = validateExportBatch(tickets);
    expect(result.includedTickets).toBe(2);
    expect(result.excludedVoided).toBe(1);
  });
});

// ── Report status label ────────────────────────────────────────────────────

describe('getReportStatusLabel', () => {
  it('labels legacy logs as unverified', () => {
    const legacyLog: NMVTISReportLog = { ...log('2026-01-01T00:00:00Z'), legacyExported: true };
    expect(getReportStatusLabel(legacyLog)).toBe('Exported (legacy — submission unverified)');
  });

  it('labels SUBMISSION_CONFIRMED logs', () => {
    const confirmedLog: NMVTISReportLog = { ...log('2026-01-01T00:00:00Z', 'SUBMISSION_CONFIRMED') };
    expect(getReportStatusLabel(confirmedLog)).toBe('Submission Confirmed');
  });

  it('labels EXPORTED logs', () => {
    expect(getReportStatusLabel(log('2026-01-01T00:00:00Z', 'EXPORTED'))).toBe('Exported');
  });

  it('labels DISCREPANCY logs', () => {
    expect(getReportStatusLabel(log('2026-01-01T00:00:00Z', 'DISCREPANCY'))).toBe('Discrepancy');
  });

  it('labels PENDING logs', () => {
    expect(getReportStatusLabel(log('2026-01-01T00:00:00Z', 'PENDING'))).toBe('Pending Export');
  });
});

// ── Operator attribution ───────────────────────────────────────────────────

describe('getCurrentOperatorName', () => {
  it('prefers the authenticated user full name', () => {
    expect(getCurrentOperatorName(settings(), { fullName: 'Alice', username: 'alice' })).toBe('Alice');
  });

  it('falls back to username when full name is absent', () => {
    expect(getCurrentOperatorName(settings(), { username: 'bob' })).toBe('bob');
  });

  it('falls back to yard operator name when no user', () => {
    expect(getCurrentOperatorName(settings({ operatorName: 'Yard Boss' }), null)).toBe('Yard Boss');
  });
});

// ── Safe CSV generation ────────────────────────────────────────────────────

describe('generateNMVTISCsv (safe — no fabricated jurisdiction/seller data)', () => {
  it('leaves TitleState blank when license plate has no state prefix', () => {
    const ticket = carTicket({
      vehicleLicensePlate: 'ABC123',
      complianceCaptures: { ...fullCaptures },
    });
    const csv = generateNMVTISCsv([ticket], 'ENTITY-1');
    const rows = csv.split('\n');
    // TitleState is column index 10 (0-based)
    const titleState = rows[1].split(',')[10];
    expect(titleState).toBe('""');
  });

  it('extracts TitleState from license plate prefix when present', () => {
    const ticket = carTicket({
      vehicleLicensePlate: 'GA 123ABC',
      complianceCaptures: { ...fullCaptures },
    });
    const csv = generateNMVTISCsv([ticket], 'ENTITY-1');
    const rows = csv.split('\n');
    const titleState = rows[1].split(',')[10];
    expect(titleState).toBe('"GA"');
  });

  it('does not fabricate DispositionCode, SellerIDType, SellerIDState, or SellerAddress', () => {
    const ticket = carTicket({
      complianceCaptures: { ...fullCaptures },
    });
    const csv = generateNMVTISCsv([ticket], 'ENTITY-1');
    const rows = csv.split('\n');
    const fields = rows[1].split(',');
    // DispositionCode (index 11), SellerIDType (14), SellerIDState (15), SellerAddress (16)
    expect(fields[11]).toBe('""');
    expect(fields[14]).toBe('""');
    expect(fields[15]).toBe('""');
    expect(fields[16]).toBe('""');
  });

  it('leaves SellerIDNumber blank when customerIdNumber is absent', () => {
    const ticket = carTicket({
      customerIdNumber: undefined,
      complianceCaptures: { ...fullCaptures },
    });
    const csv = generateNMVTISCsv([ticket], 'ENTITY-1');
    const rows = csv.split('\n');
    const fields = rows[1].split(',');
    // SellerIDNumber is index 13
    expect(fields[13]).toBe('""');
  });

  it('leaves TitleNumber blank when absent', () => {
    const ticket = carTicket({
      carRecord: carRecord({ titleNumber: undefined }),
      complianceCaptures: { ...fullCaptures },
    });
    const csv = generateNMVTISCsv([ticket], 'ENTITY-1');
    const rows = csv.split('\n');
    const fields = rows[1].split(',');
    // TitleNumber is index 9
    expect(fields[9]).toBe('""');
  });

  it('only includes CAR_SALVAGE tickets with a carRecord', () => {
    const tickets = [
      carTicket({ id: 'T-1', complianceCaptures: { ...fullCaptures } }),
      scrapTicket({ id: 'T-2', complianceCaptures: { ...fullCaptures } }),
    ];
    const csv = generateNMVTISCsv(tickets, 'ENTITY-1');
    const rows = csv.split('\n');
    // header + 1 data row (scrap ticket filtered out)
    expect(rows).toHaveLength(2);
  });
});