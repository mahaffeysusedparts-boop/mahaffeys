import { describe, expect, it } from 'vitest';
import { preserveServerFinancialFields } from './financialSync';

describe('protected ticket synchronization', () => {
  it('preserves every historical financial field and terminal status while retaining nonfinancial notes', () => {
    const server = {
      id: 'historical', ticketType: 'SCRAP_METAL', createdAt: '2025-01-01', customerId: 'customer-1',
      customerIdNumber: 'ID-1', grossTotal: 200, totalDeductions: 50, finalPayout: 150,
      payoutMethod: 'Check', checkNumber: '00123', scrapLines: [{ id: 'line-1', amount: 200 }], status: 'VOIDED',
    };
    const merged = Object.fromEntries(Object.keys(server).map(key => [key, 'stale']));
    merged.notes = 'Local nonfinancial note';
    expect(preserveServerFinancialFields(merged, server)).toEqual({ ...server, id: 'stale', notes: 'Local nonfinancial note' });
  });

  it('does not introduce financial fields absent from the server history', () => {
    const server = { id: 'history', ticketType: 'AUTO_SALVAGE', status: 'COMPLETED' };
    const result = preserveServerFinancialFields({ ...server, finalPayout: 0, checkNumber: 'invented', buying: { revision: 99 } }, server);
    expect(result).toEqual(server);
  });

  it('always takes canonical buying records from the server, regardless of local revision', () => {
    const server = { id: 'canonical', buying: { revision: 2, stage: 'PAID' }, finalPayout: 150 };
    expect(preserveServerFinancialFields({ ...server, buying: { revision: 99 }, finalPayout: 0 }, server)).toBe(server);
  });

  it('keeps open legacy scrap unchanged and leaves ordinary draft merges alone', () => {
    const pending = { id: 'pending', ticketType: 'SCRAP_METAL', status: 'PENDING' };
    expect(preserveServerFinancialFields({ ...pending, finalPayout: 500 }, pending)).toBe(pending);
    const draft = { id: 'draft', ticketType: 'AUTO_SALVAGE', status: 'DRAFT' };
    const updated = { ...draft, notes: 'Local edit' };
    expect(preserveServerFinancialFields(updated, draft)).toBe(updated);
  });
});
