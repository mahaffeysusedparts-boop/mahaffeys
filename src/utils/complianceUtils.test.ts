import { describe, expect, it } from 'vitest';
import {
  getNmvtisStatus,
  isNmvtisBannerActive,
  calculateReadiness,
  validateExportBatch,
  getReportStatus,
  getReportStatusLabel,
  generateNMVTISCsv,
} from './complianceUtils';
import { Ticket, NMVTISReportLog, YardSettings } from '@/types/scrap';

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

// ── Ticket fixtures ─────────────────────────────────────────────────────────

const FULL_CAPS = {
  personPhotoUrl: 'data:image/jpeg;base64,abc',
  vehiclePhotoUrl: 'data:image/jpeg;base64,def',
  licensePlatePhotoUrl: 'data:image/jpeg;base64,ghi',
  loadPhotoUrl: 'data:image/jpeg;base64,jkl',
};

const makeCarTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: 'T-001',
  ticketType: 'CAR_SALVAGE',
  createdAt: '2026-01-15T10:00:00Z',
  status: 'COMPLETED',
  customerName: 'John Doe',
  customerIdNumber: 'D12345678',
  vehicleLicensePlate: 'GA 123ABC',
  grossTotal: 500,
  totalDeductions: 0,
  finalPayout: 500,
  payoutMethod: 'Cash',
  operatorName: 'Op',
  carRecord: {
    vin: '1HGBH41JXMN109186',
    year: 2020,
    make: 'Honda',
    model: 'Civic',
    color: 'Blue',
    titleStatus: 'Clean Title',
    titleNumber: 'T12345',
    hasCatalyticConverter: true,
    catCondition: 'Original OEM',
    hasEngineAndTrans: true,
    hasBattery: true,
    hasAluminumRims: true,
    fluidsDrained: true,
    pricingMode: 'TONNAGE',
    vehicleWeightLbs: 3000,
    ratePerTon: 100,
    flatRate: 0,
    catBonus: 0,
    engineBonus: 0,
    batteryBonus: 0,
    deductions: 0,
    totalPayout: 500,
  },
  complianceCaptures: { ...FULL_CAPS },
  ...overrides,
});

const makeScrapTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: 'S-001',
  ticketType: 'SCRAP_METAL',
  createdAt: '2026-01-15T10:00:00Z',
  status: 'COMPLETED',
  customerName: 'Jane Smith',
  customerIdNumber: 'S87654321',
  vehicleLicensePlate: 'GA 456DEF',
  grossTotal: 200,
  totalDeductions: 0,
  finalPayout: 200,
  payoutMethod: 'Cash',
  operatorName: 'Op',
  complianceCaptures: {
    personPhotoUrl: 'data:image/jpeg;base64,abc',
    idPhotoUrl: 'data:image/jpeg;base64,id',
    vehiclePhotoUrl: 'data:image/jpeg;base64,def',
    licensePlatePhotoUrl: 'data:image/jpeg;base64,ghi',
    loadPhotoUrl: 'data:image/jpeg;base64,jkl',
  },
  ...overrides,
});

// ── getNmvtisStatus (existing tests) ─────────────────────────────────────────

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

// ── calculateReadiness ──────────────────────────────────────────────────────

describe('calculateReadiness', () => {
  it('returns COMPLETE for a fully-evidenced CAR_SALVAGE ticket', () => {
    const result = calculateReadiness(makeCarTicket());
    expect(result.status).toBe('COMPLETE');
    expect(result.score).toBe(100);
    expect(result.missingItems).toHaveLength(0);
    expect(result.isVoided).toBe(false);
    expect(result.isExported).toBe(false);
    expect(result.isConfirmed).toBe(false);
  });

  it('returns INCOMPLETE for a CAR_SALVAGE ticket missing evidence', () => {
    const ticket = makeCarTicket({
      complianceCaptures: { personPhotoUrl: 'data:image/jpeg;base64,abc' },
    });
    const result = calculateReadiness(ticket);
    expect(result.status).toBe('INCOMPLETE');
    expect(result.score).toBe(25);
    expect(result.missingItems).toEqual(['Vehicle Photo', 'License Plate Photo', 'Scrap Cargo Photo']);
  });

  it('returns INCOMPLETE for a CAR_SALVAGE ticket with no captures at all', () => {
    const ticket = makeCarTicket({ complianceCaptures: undefined });
    const result = calculateReadiness(ticket);
    expect(result.status).toBe('INCOMPLETE');
    expect(result.score).toBe(0);
    expect(result.missingItems).toHaveLength(4);
  });

  it('returns INVALID_DATA for a CAR_SALVAGE ticket with a bad VIN', () => {
    const ticket = makeCarTicket({
      carRecord: { vin: 'SHORT', year: 2020, make: 'Honda', model: 'Civic', color: 'Blue', titleStatus: 'Clean Title', hasCatalyticConverter: true, catCondition: 'Original OEM', hasEngineAndTrans: true, hasBattery: true, hasAluminumRims: true, fluidsDrained: true, pricingMode: 'TONNAGE', vehicleWeightLbs: 3000, ratePerTon: 100, flatRate: 0, catBonus: 0, engineBonus: 0, batteryBonus: 0, deductions: 0, totalPayout: 500 },
    });
    const result = calculateReadiness(ticket);
    expect(result.status).toBe('INVALID_DATA');
    expect(result.warnings.some((w) => w.includes('VIN'))).toBe(true);
  });

  it('returns COMPLETE for a fully-evidenced SCRAP_METAL ticket', () => {
    const result = calculateReadiness(makeScrapTicket());
    expect(result.status).toBe('COMPLETE');
    expect(result.score).toBe(100);
    expect(result.missingItems).toHaveLength(0);
  });

  it('returns INCOMPLETE for a SCRAP_METAL ticket missing the ID scan', () => {
    const ticket = makeScrapTicket({
      complianceCaptures: {
        personPhotoUrl: 'data:image/jpeg;base64,abc',
        vehiclePhotoUrl: 'data:image/jpeg;base64,def',
        licensePlatePhotoUrl: 'data:image/jpeg;base64,ghi',
        loadPhotoUrl: 'data:image/jpeg;base64,jkl',
      },
    });
    const result = calculateReadiness(ticket);
    expect(result.status).toBe('INCOMPLETE');
    expect(result.missingItems).toEqual(['ID Scan']);
  });

  it('returns PENDING_EXPORT for an already-exported ticket', () => {
    const ticket = makeCarTicket({
      complianceCaptures: { ...FULL_CAPS, nmvtisReported: true, nmvtisReportedAt: '2026-01-20T10:00:00Z', nmvtisBatchId: 'BATCH-1' },
    });
    const result = calculateReadiness(ticket);
    expect(result.status).toBe('PENDING_EXPORT');
    expect(result.isExported).toBe(true);
  });

  it('returns PENDING_EXPORT for a confirmed ticket', () => {
    const ticket = makeCarTicket({
      complianceCaptures: {
        ...FULL_CAPS,
        nmvtisReported: true,
        nmvtisReportedAt: '2026-01-20T10:00:00Z',
        nmvtisBatchId: 'BATCH-1',
        nmvtisSubmissionConfirmedAt: '2026-01-21T10:00:00Z',
        nmvtisSubmissionConfirmedBy: 'Op',
      },
    });
    const result = calculateReadiness(ticket);
    expect(result.status).toBe('PENDING_EXPORT');
    expect(result.isConfirmed).toBe(true);
  });

  it('returns INCOMPLETE for a voided ticket even with full evidence', () => {
    const ticket = makeCarTicket({ status: 'VOIDED' });
    const result = calculateReadiness(ticket);
    expect(result.status).toBe('INCOMPLETE');
    expect(result.isVoided).toBe(true);
  });

  it('warns about missing jurisdictional data on CAR_SALVAGE tickets', () => {
    const ticket = makeCarTicket({
      carRecord: { vin: '1HGBH41JXMN109186', year: 2020, make: 'Honda', model: 'Civic', color: 'Blue', titleStatus: 'Clean Title', hasCatalyticConverter: true, catCondition: 'Original OEM', hasEngineAndTrans: true, hasBattery: true, hasAluminumRims: true, fluidsDrained: true, pricingMode: 'TONNAGE', vehicleWeightLbs: 3000, ratePerTon: 100, flatRate: 0, catBonus: 0, engineBonus: 0, batteryBonus: 0, deductions: 0, totalPayout: 500 },
      customerIdNumber: undefined,
      vehicleLicensePlate: undefined,
    });
    const result = calculateReadiness(ticket);
    expect(result.warnings).toContain('Title number missing');
    expect(result.warnings).toContain('Seller ID number missing');
    expect(result.warnings).toContain('Vehicle license plate missing');
  });

  it('warns about missing seller ID on SCRAP_METAL tickets', () => {
    const ticket = makeScrapTicket({ customerIdNumber: undefined });
    const result = calculateReadiness(ticket);
    expect(result.warnings).toContain('Seller ID number missing');
  });
});

// ── getReportStatus ─────────────────────────────────────────────────────────

describe('getReportStatus', () => {
  it('returns READY for an unexported, valid ticket', () => {
    expect(getReportStatus(makeCarTicket())).toBe('READY');
  });

  it('returns EXPORTED for a ticket with nmvtisReported but no confirmation', () => {
    const ticket = makeCarTicket({
      complianceCaptures: { ...FULL_CAPS, nmvtisReported: true, nmvtisReportedAt: '2026-01-20T10:00:00Z', nmvtisBatchId: 'B1' },
    });
    expect(getReportStatus(ticket)).toBe('EXPORTED');
  });

  it('returns SUBMISSION_CONFIRMED for a ticket with confirmation', () => {
    const ticket = makeCarTicket({
      complianceCaptures: {
        ...FULL_CAPS,
        nmvtisReported: true,
        nmvtisReportedAt: '2026-01-20T10:00:00Z',
        nmvtisBatchId: 'B1',
        nmvtisSubmissionConfirmedAt: '2026-01-21T10:00:00Z',
        nmvtisSubmissionConfirmedBy: 'Op',
      },
    });
    expect(getReportStatus(ticket)).toBe('SUBMISSION_CONFIRMED');
  });

  it('returns DISCREPANCY for a ticket with an invalid VIN', () => {
    const ticket = makeCarTicket({
      carRecord: { vin: 'BAD', year: 2020, make: 'Honda', model: 'Civic', color: 'Blue', titleStatus: 'Clean Title', hasCatalyticConverter: true, catCondition: 'Original OEM', hasEngineAndTrans: true, hasBattery: true, hasAluminumRims: true, fluidsDrained: true, pricingMode: 'TONNAGE', vehicleWeightLbs: 3000, ratePerTon: 100, flatRate: 0, catBonus: 0, engineBonus: 0, batteryBonus: 0, deductions: 0, totalPayout: 500 },
    });
    expect(getReportStatus(ticket)).toBe('DISCREPANCY');
  });
});

// ── getReportStatusLabel ────────────────────────────────────────────────────

describe('getReportStatusLabel', () => {
  it('labels legacy exported logs as unverified', () => {
    const legacyLog: NMVTISReportLog = {
      id: 'log-1',
      batchId: 'B1',
      exportedAt: '2026-01-20T10:00:00Z',
      ticketCount: 1,
      ticketIds: ['T-001'],
      status: 'EXPORTED',
      exportedBy: 'Op',
      legacyExported: true,
    };
    expect(getReportStatusLabel(legacyLog)).toBe('Exported (legacy — submission unverified)');
  });

  it('labels confirmed logs correctly', () => {
    const confirmedLog: NMVTISReportLog = {
      id: 'log-2',
      batchId: 'B2',
      exportedAt: '2026-01-20T10:00:00Z',
      ticketCount: 1,
      ticketIds: ['T-001'],
      status: 'SUBMISSION_CONFIRMED',
      exportedBy: 'Op',
      submissionConfirmedBy: 'Op',
      submissionConfirmedAt: '2026-01-21T10:00:00Z',
    };
    expect(getReportStatusLabel(confirmedLog)).toBe('Submission Confirmed');
  });

  it('labels exported logs correctly', () => {
    const exportedLog: NMVTISReportLog = {
      id: 'log-3',
      batchId: 'B3',
      exportedAt: '2026-01-20T10:00:00Z',
      ticketCount: 1,
      ticketIds: ['T-001'],
      status: 'EXPORTED',
      exportedBy: 'Op',
    };
    expect(getReportStatusLabel(exportedLog)).toBe('Exported');
  });

  it('labels pending logs correctly', () => {
    const pendingLog: NMVTISReportLog = {
      id: 'log-4',
      batchId: 'B4',
      exportedAt: '2026-01-20T10:00:00Z',
      ticketCount: 1,
      ticketIds: ['T-001'],
      status: 'PENDING',
      exportedBy: 'Op',
    };
    expect(getReportStatusLabel(pendingLog)).toBe('Pending Export');
  });
});

// ── validateExportBatch ─────────────────────────────────────────────────────

describe('validateExportBatch', () => {
  it('excludes voided tickets from the included count', () => {
    const tickets = [
      makeCarTicket({ id: 'T-1' }),
      makeCarTicket({ id: 'T-2', status: 'VOIDED' }),
      makeCarTicket({ id: 'T-3' }),
    ];
    const result = validateExportBatch(tickets);
    expect(result.totalTickets).toBe(3);
    expect(result.excludedVoided).toBe(1);
    expect(result.includedTickets).toBe(2);
    expect(result.blockedRows).toHaveLength(0);
    expect(result.canExport).toBe(true);
  });

  it('blocks tickets with invalid VINs', () => {
    const tickets = [
      makeCarTicket({ id: 'T-1' }),
      makeCarTicket({
        id: 'T-2',
        carRecord: { vin: 'BAD', year: 2020, make: 'Honda', model: 'Civic', color: 'Blue', titleStatus: 'Clean Title', hasCatalyticConverter: true, catCondition: 'Original OEM', hasEngineAndTrans: true, hasBattery: true, hasAluminumRims: true, fluidsDrained: true, pricingMode: 'TONNAGE', vehicleWeightLbs: 3000, ratePerTon: 100, flatRate: 0, catBonus: 0, engineBonus: 0, batteryBonus: 0, deductions: 0, totalPayout: 500 },
      }),
    ];
    const result = validateExportBatch(tickets);
    expect(result.blockedRows).toHaveLength(1);
    expect(result.blockedRows[0].ticketId).toBe('T-2');
    expect(result.canExport).toBe(false);
  });

  it('blocks tickets missing required evidence', () => {
    const tickets = [
      makeCarTicket({
        id: 'T-1',
        complianceCaptures: { personPhotoUrl: 'data:image/jpeg;base64,abc' },
      }),
    ];
    const result = validateExportBatch(tickets);
    expect(result.blockedRows).toHaveLength(1);
    expect(result.blockedRows[0].issues.some((i) => i.includes('Missing evidence'))).toBe(true);
    expect(result.canExport).toBe(false);
  });

  it('warns (but does not block) on missing jurisdictional data', () => {
    const tickets = [
      makeCarTicket({
        id: 'T-1',
        customerIdNumber: undefined,
        vehicleLicensePlate: undefined,
        carRecord: { vin: '1HGBH41JXMN109186', year: 2020, make: 'Honda', model: 'Civic', color: 'Blue', titleStatus: 'Clean Title', hasCatalyticConverter: true, catCondition: 'Original OEM', hasEngineAndTrans: true, hasBattery: true, hasAluminumRims: true, fluidsDrained: true, pricingMode: 'TONNAGE', vehicleWeightLbs: 3000, ratePerTon: 100, flatRate: 0, catBonus: 0, engineBonus: 0, batteryBonus: 0, deductions: 0, totalPayout: 500 },
      }),
    ];
    const result = validateExportBatch(tickets);
    expect(result.blockedRows).toHaveLength(0);
    expect(result.warnedRows).toHaveLength(1);
    expect(result.canExport).toBe(true);
    expect(result.includedTickets).toBe(1);
  });

  it('matches batch totals to included rows', () => {
    const tickets = [
      makeCarTicket({ id: 'T-1' }),
      makeCarTicket({ id: 'T-2' }),
      makeCarTicket({ id: 'T-3', status: 'VOIDED' }),
    ];
    const result = validateExportBatch(tickets);
    expect(result.includedTickets).toBe(2);
    expect(result.excludedVoided).toBe(1);
  });
});

// ── generateNMVTISCsv (safe — no fabricated data) ───────────────────────────

describe('generateNMVTISCsv', () => {
  it('does not fabricate jurisdiction or seller data', () => {
    const ticket = makeCarTicket({
      customerIdNumber: undefined,
      vehicleLicensePlate: undefined,
      carRecord: { vin: '1HGBH41JXMN109186', year: 2020, make: 'Honda', model: 'Civic', color: 'Blue', titleStatus: 'Clean Title', hasCatalyticConverter: true, catCondition: 'Original OEM', hasEngineAndTrans: true, hasBattery: true, hasAluminumRims: true, fluidsDrained: true, pricingMode: 'TONNAGE', vehicleWeightLbs: 3000, ratePerTon: 100, flatRate: 0, catBonus: 0, engineBonus: 0, batteryBonus: 0, deductions: 0, totalPayout: 500 },
    });
    const csv = generateNMVTISCsv([ticket], 'ENTITY-1');
    const lines = csv.split('\n');
    const dataRow = lines[1];
    // TitleState, DispositionCode, SellerIDType, SellerIDState, SellerAddress, VehiclePlateState
    // should all be empty (not "GA", "S", "Driver License", "Address On File")
    expect(dataRow).not.toContain('GA');
    expect(dataRow).not.toContain('Driver License');
    expect(dataRow).not.toContain('Address On File');
    expect(dataRow).not.toContain('"S"');
  });

  it('emits actual data when available', () => {
    const ticket = makeCarTicket();
    const csv = generateNMVTISCsv([ticket], 'ENTITY-1');
    const lines = csv.split('\n');
    const dataRow = lines[1];
    expect(dataRow).toContain('John Doe');
    expect(dataRow).toContain('D12345678');
    expect(dataRow).toContain('GA 123ABC');
    expect(dataRow).toContain('T12345');
  });

  it('only includes CAR_SALVAGE tickets', () => {
    const tickets = [makeCarTicket(), makeScrapTicket()];
    const csv = generateNMVTISCsv(tickets, 'ENTITY-1');
    const lines = csv.split('\n');
    // header + 1 data row (only the car ticket)
    expect(lines).toHaveLength(2);
  });
});
