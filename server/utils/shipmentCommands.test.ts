import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OutboundShipment } from '../../src/types/scrap';
import { shipmentSnapshot } from '../../src/utils/shipments';

const mocks = vi.hoisted(() => ({
  body: vi.fn(), user: vi.fn(), query: vi.fn(), transaction: vi.fn(),
}));
vi.mock('nitro', () => ({ defineHandler: (handler: unknown) => handler }));
vi.mock('nitro/h3', () => ({
  readBody: mocks.body,
  createError: ({ statusCode, statusMessage }: { statusCode: number; statusMessage: string }) => Object.assign(new Error(statusMessage), { statusCode }),
}));
vi.mock('./auth', () => ({ requireUser: mocks.user }));
vi.mock('./db', () => ({ withTransaction: mocks.transaction }));
import handler from '../routes/api/shipments/commands.post';
import { protectFinancialState } from './financialState';

const base: OutboundShipment = {
  id: 'mill-test', loadNumber: 'LD-TEST', millName: 'Test Mill', materialCategory: 'Steel',
  grossWeightLbs: 12000, tareWeightLbs: 2000, netWeightLbs: 10000,
  expectedRatePerLb: 0.1, expectedRevenue: 1000, status: 'DELIVERED',
  createdAt: '2026-01-01T00:00:00Z', deliveredAt: '2026-01-02T00:00:00Z',
};
const settlement = { scaleTicketNumber: 'MILL-001', actualNetWeightLbs: 10000, amountPaid: 1000, deductions: 0 };
let stored: OutboundShipment[];
const invoke = () => (handler as unknown as (event: unknown) => Promise<OutboundShipment>)({});

beforeEach(() => {
  vi.clearAllMocks();
  stored = [structuredClone(base)];
  mocks.user.mockResolvedValue({ id: 'manager', fullName: 'Test Manager', role: 'yard_manager', status: 'approved' });
  mocks.transaction.mockImplementation(async callback => callback({ query: mocks.query }));
  mocks.query.mockImplementation(async (sql: string, args?: unknown[]) => {
    if (sql.startsWith('SELECT value FROM app_state')) return { rows: [{ value: args?.[0] === 'mahaffeys_shipments' ? stored : {} }] };
    if (sql.startsWith('INSERT INTO app_state')) stored = JSON.parse(args?.[1] as string);
    return { rows: [] };
  });
});

describe('server shipment commands', () => {
  it('settles a legacy delivered shipment despite JSONB key reordering', async () => {
    stored = [Object.fromEntries(Object.entries(base).reverse()) as unknown as OutboundShipment];
    mocks.body.mockResolvedValue({ action: 'SETTLE', id: base.id, expectedSnapshot: shipmentSnapshot(base), settlement });
    const result = await invoke();
    expect(result.status).toBe('SETTLED');
    expect(result.settlement).toMatchObject({ ...settlement, actualRatePerLb: 0.1 });
    expect(stored[0]).toEqual(result);
    expect(mocks.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO audit_log'))).toBe(true);
  });
  it('rejects actual concurrent changes without replacing them', async () => {
    stored[0].expectedRevenue = 1500;
    mocks.body.mockResolvedValue({ action: 'SETTLE', id: base.id, expectedSnapshot: shipmentSnapshot(base), settlement });
    await expect(invoke()).rejects.toMatchObject({ statusCode: 409 });
    expect(stored[0].settlement).toBeUndefined();
    expect(stored[0].expectedRevenue).toBe(1500);
  });
  it('voids a past settlement, retains original payment, and does not duplicate audit on retry', async () => {
    const historical = { ...base, status: 'SETTLED' as const, settlement: { ...settlement, actualRatePerLb: 0.1, settledAt: '2026-01-02T00:00:00Z' } };
    stored = [historical];
    mocks.body.mockResolvedValue({ action: 'VOID', id: base.id, expectedSnapshot: shipmentSnapshot(historical), reason: 'Duplicate historical shipment' });
    const result = await invoke();
    expect(result.settlement).toEqual(historical.settlement);
    expect(result.voidRecord).toMatchObject({ reason: 'Duplicate historical shipment', previousStatus: 'SETTLED', voidedBy: 'Test Manager', voidedById: 'manager' });
    expect(result.status).toBe('VOIDED');
    expect(await invoke()).toEqual(result);
    expect(mocks.query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO audit_log'))).toHaveLength(1);
    mocks.body.mockResolvedValue({ action: 'SETTLE', id: base.id, expectedSnapshot: shipmentSnapshot(result), settlement });
    await expect(invoke()).rejects.toMatchObject({ statusCode: 409 });
  });
  it('requires manager authority and a nonblank void reason', async () => {
    mocks.user.mockResolvedValueOnce({ id: 'operator', role: 'scale_operator' });
    await expect(invoke()).rejects.toMatchObject({ statusCode: 403 });
    mocks.body.mockResolvedValue({ action: 'VOID', id: base.id, expectedSnapshot: shipmentSnapshot(base), reason: '  ' });
    await expect(invoke()).rejects.toMatchObject({ statusCode: 400 });
  });
  it('requires delivery and validates grade breakdown before settlement', async () => {
    stored[0].status = 'STAGED';
    mocks.body.mockResolvedValue({ action: 'SETTLE', id: base.id, expectedSnapshot: shipmentSnapshot(stored[0]), settlement });
    await expect(invoke()).rejects.toMatchObject({ statusCode: 409 });
    stored[0].status = 'DELIVERED';
    mocks.body.mockResolvedValue({ action: 'SETTLE', id: base.id, expectedSnapshot: shipmentSnapshot(stored[0]), settlement: { ...settlement, gradeLines: [{ gradeLineId: base.id, gradeName: 'Steel', actualNetWeightLbs: 10000, actualRatePerLb: 0.1, priceUnit: 'LB', deductions: 2000 }] } });
    await expect(invoke()).rejects.toMatchObject({ statusCode: 400 });
  });
  it('stale generic sync cannot reopen or omit a voided shipment', async () => {
    stored[0] = { ...base, status: 'VOIDED', voidRecord: { reason: 'Duplicate', voidedAt: new Date().toISOString(), voidedBy: 'Manager', voidedById: 'manager', previousStatus: 'DELIVERED' } };
    const client = { query: mocks.query } as unknown as Parameters<typeof protectFinancialState>[0];
    expect(await protectFinancialState(client, 'mahaffeys_shipments', [base], 'admin', 'Admin')).toEqual(stored);
    expect(await protectFinancialState(client, 'mahaffeys_shipments', [], 'admin', 'Admin')).toEqual(stored);
  });
});
