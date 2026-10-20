import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { protectFinancialState } from './financialState';

const historical = {
  id: 'historical', ticketType: 'SCRAP_METAL', status: 'COMPLETED', finalPayout: 150,
  payoutMethod: 'Check', checkNumber: '00123', scrapLines: [{ id: 'line-1', amount: 150 }],
};

function clientWithHistory(): PoolClient {
  return { query: vi.fn(async (sql: string) => {
    if (sql.includes('FROM scrap_buying_tickets')) return { rows: [] };
    if (sql.includes('SELECT value FROM app_state')) return { rows: [{ value: [historical] }] };
    return { rows: [] };
  }) } as unknown as PoolClient;
}

describe('historical financial server safeguards', () => {
  it.each([
    { finalPayout: 0 }, { checkNumber: 'replacement' }, { scrapLines: [] },
  ])('continues to reject protected field changes %j', async changes => {
    await expect(protectFinancialState(clientWithHistory(), 'mahaffeys_tickets', [{ ...historical, ...changes }], 'admin', 'Administrator'))
      .rejects.toThrow('Historical financial meaning cannot be replaced by generic state writes');
  });

  it('permits a financially unchanged history snapshot', async () => {
    expect(await protectFinancialState(clientWithHistory(), 'mahaffeys_tickets', [historical], 'admin', 'Administrator')).toEqual([historical]);
  });
});
