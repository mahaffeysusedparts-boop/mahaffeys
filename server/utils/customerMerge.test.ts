import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUser, readBody, withTransaction, recordAudit, queries, transactionQueries } = vi.hoisted(() => ({
  requireUser: vi.fn(), readBody: vi.fn(), withTransaction: vi.fn(), recordAudit: vi.fn(),
  queries: [] as Array<{ sql: string; values: unknown[] }>,
  transactionQueries: [] as Array<{ sql: string; values: unknown[] }>,
}));
vi.mock('nitro', () => ({ defineHandler: (handler: unknown) => handler }));
vi.mock('nitro/h3', () => ({ readBody, createError: (error: object) => Object.assign(new Error(), error) }));
vi.mock('./auth', () => ({ requireUser }));
vi.mock('./db', () => ({
  query: async (sql: string, values: unknown[] = []) => { queries.push({ sql, values }); return { rows: [] }; },
  withTransaction,
}));
vi.mock('./audit', () => ({ auditFor: vi.fn((user, entry) => ({ ...entry, userId: user.id, userName: user.fullName })), recordAudit }));

import mergeRoute from '../routes/api/customers/merge.post';

const merge = mergeRoute as unknown as (event: object) => Promise<unknown>;
const user = { id: 'manager', fullName: 'Yard Manager', role: 'yard_manager' };
const rows = [
  { id: 'old', full_name: 'Sam Seller', phone: '', id_type: 'Driver License', id_number: '', id_state: 'SC', address: '', vehicle_license_plate: null, vehicle_state: null, notes: null, created_at: '2025-01-01T00:00:00Z', total_payouts: 30, total_weight_lbs: 100, id_photo_url: null, captured_plates: [], is_commercial: false, company_name: null, business_address: null },
  { id: 'complete', full_name: 'Sam Seller', phone: '5551234567', id_type: 'Driver License', id_number: 'DL-1', id_state: 'GA', address: '1 Main', vehicle_license_plate: 'ABC', vehicle_state: 'GA', notes: 'seller notes', created_at: '2026-02-01T00:00:00Z', total_payouts: 20, total_weight_lbs: 50, id_photo_url: '/api/uploads/id', captured_plates: ['ABC'], is_commercial: false, company_name: null, business_address: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  queries.length = 0;
  transactionQueries.length = 0;
  requireUser.mockResolvedValue(user);
  readBody.mockResolvedValue({ customerIds: ['old', 'complete'] });
  withTransaction.mockImplementation(async (callback: (client: { query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }> }) => Promise<unknown>) => callback({
    query: async (sql: string, values: unknown[] = []) => {
      transactionQueries.push({ sql, values });
      if (sql.startsWith('SELECT * FROM customers WHERE id = ANY')) return { rows };
      if (sql.startsWith('SELECT * FROM customers WHERE id=$1')) return { rows: [rows[1]] };
      if (sql.includes('SELECT value FROM app_state')) return { rows: [{ value: [{ id: 'ticket-1', customerId: 'old' }, { id: 'ticket-2', customerId: 'complete' }, { id: 'other' }] }] };
      return { rows: [] };
    },
  }));
});
afterEach(() => vi.restoreAllMocks());

describe('customer profile merge', () => {
  it('chooses the most complete profile and repoints all ticket stores before removing duplicate rows', async () => {
    const result = await merge({});
    expect((result as { id: string }).id).toBe('complete');
    expect(transactionQueries.find(row => row.sql.includes('UPDATE customers SET'))?.values).toEqual([
      'complete', 'Sam Seller', '5551234567', 'Driver License', 'DL-1', 'GA', '1 Main', 'ABC', 'GA', 'seller notes', '/api/uploads/id', '["ABC"]', false, null, null, 50, 150,
    ]);
    expect(transactionQueries.find(row => row.sql.startsWith('UPDATE scrap_buying_tickets'))?.values).toEqual(['complete', ['old', 'complete']]);
    const deleteIndex = transactionQueries.findIndex(row => row.sql.startsWith('DELETE FROM customers'));
    const appStateUpdateIndex = transactionQueries.findIndex(row => row.sql.includes("INSERT INTO app_state"));
    expect(deleteIndex).toBeGreaterThan(appStateUpdateIndex);
    expect(recordAudit).toHaveBeenCalledTimes(1);
  });

  it('restricts merge to managers and administrators', async () => {
    requireUser.mockResolvedValue({ ...user, role: 'scale_operator' });
    await expect(merge({})).rejects.toMatchObject({ statusCode: 403 });
    expect(withTransaction).not.toHaveBeenCalled();
  });
});
