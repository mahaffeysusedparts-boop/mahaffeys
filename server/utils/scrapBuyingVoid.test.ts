import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ticket } from '../../src/types/scrap';
import type { PublicUser } from './auth';

const mocks = vi.hoisted(() => ({ query: vi.fn(), putState: vi.fn(), ticket: null as Ticket | null, events: new Map<string, { request_hash: string; result: Ticket }>() }));
vi.mock('nitro/h3', () => ({ createError: ({ statusCode, statusMessage }: { statusCode: number; statusMessage: string }) => Object.assign(new Error(statusMessage), { statusCode }) }));
vi.mock('./db', () => ({ query: mocks.query, withTransaction: async (run: (client: unknown) => unknown) => run({ query: mocks.query }) }));
vi.mock('./auth', () => ({ requireUser: vi.fn() }));
vi.mock('./intakeOwnership', () => ({ ensureIntakeOwnership: vi.fn(), lockIntakeOwnership: vi.fn() }));
vi.mock('./financialState', () => ({ lockFinancialState: vi.fn(), stateValue: async () => [mocks.ticket], putState: mocks.putState }));
vi.mock('./scale', () => ({ serverScale: {} }));
vi.mock('./binInspections', () => ({ consumeBinReview: vi.fn() }));
vi.mock('./intakeCreation', async () => {
  const { z } = await import('zod');
  return { intakeSellerProfileSchema: z.object({}), persistIntakeSeller: vi.fn() };
});
import { executeBuyingCommand } from './scrapBuying';

const actor = { id: 'admin', fullName: 'Void Administrator', username: 'admin', role: 'admin', status: 'approved' } as PublicUser;
const request = (revision = 5) => ({ action: 'VOID' as const, id: 'PAID-VOID', revision, idempotencyKey: crypto.randomUUID(), reason: 'Entry error — wrong seller' });

beforeEach(() => {
  mocks.events.clear(); mocks.query.mockReset(); mocks.putState.mockReset();
  mocks.ticket = {
    id: 'PAID-VOID', ticketType: 'SCRAP_METAL', customerName: 'Synthetic Seller', createdAt: '2026-01-01T12:00:00Z', status: 'COMPLETED',
    grossTotal: 20, totalDeductions: 0, finalPayout: 20, payoutMethod: 'Cash', operatorName: actor.fullName, scrapLines: [],
    buying: { version: 1, revision: 5, stage: 'PAID', payment: { id: 'original-payment', amount: 20, method: 'Cash', paidAt: '2026-01-01T12:05:00Z', paidBy: actor.fullName } },
  };
  mocks.query.mockImplementation(async (sql: string, params: unknown[]) => {
    if (sql.startsWith('SELECT request_hash')) return { rows: mocks.events.has(params[1] as string) ? [mocks.events.get(params[1] as string)] : [] };
    if (sql.startsWith('SELECT document FROM scrap_buying_tickets')) return { rows: [{ document: mocks.ticket }] };
    if (sql.includes('FROM intake_ownership')) return { rows: [] };
    if (sql.startsWith('UPDATE scrap_buying_tickets')) { mocks.ticket = JSON.parse(params[3] as string); return { rows: [] }; }
    if (sql.startsWith('INSERT INTO scrap_buying_events')) { mocks.events.set(params[4] as string, { request_hash: params[5] as string, result: JSON.parse(params[7] as string) }); return { rows: [] }; }
    throw new Error(`Unexpected financial SQL: ${sql}`);
  });
});

describe('paid purchase voiding', () => {
  it.each(['admin', 'yard_manager'] as const)('allows %s to void without modifying payout records and replays the same audit', async role => {
    const original = structuredClone(mocks.ticket!);
    const command = request();
    const voided = await executeBuyingCommand(command, { ...actor, role });
    expect(voided).toMatchObject({ status: 'VOIDED', voidedBy: actor.fullName, voidReason: command.reason, finalPayout: 20, buying: { stage: 'VOIDED', revision: 6, payment: original.buying!.payment } });
    expect(voided.voidedAt).toBeTruthy();
    expect(mocks.putState).toHaveBeenCalledWith(expect.anything(), 'mahaffeys_tickets', [voided], actor.id);
    expect(await executeBuyingCommand(command, { ...actor, role })).toEqual(voided);
    expect(mocks.events.size).toBe(1);
    expect(mocks.query.mock.calls.some(([sql]) => /(?:INSERT|UPDATE|DELETE).*scrap_buying_payments/i.test(sql))).toBe(false);
    expect(mocks.putState.mock.calls.some(([, key]) => key === 'mahaffeys_cash_drawer')).toBe(false);
    await expect(executeBuyingCommand({ ...request(6), action: 'PAY', method: 'Cash', disbursed: true }, actor)).rejects.toThrow('Finalize');
    await expect(executeBuyingCommand(request(6), actor)).rejects.toThrow('already voided');
  });
  it('preserves the exact issued check number', async () => {
    mocks.ticket!.payoutMethod = 'Check'; mocks.ticket!.checkNumber = '000123-Ab';
    mocks.ticket!.buying!.payment = { ...mocks.ticket!.buying!.payment!, method: 'Check', checkReference: '000123-Ab' };
    const voided = await executeBuyingCommand(request(), actor);
    expect(voided.checkNumber).toBe('000123-Ab');
    expect(voided.buying!.payment!.checkReference).toBe('000123-Ab');
  });
  it('rejects scale operators, missing reasons, and stale revisions without writes', async () => {
    await expect(executeBuyingCommand(request(), { ...actor, role: 'scale_operator' })).rejects.toMatchObject({ statusCode: 403 });
    await expect(executeBuyingCommand({ ...request(), reason: ' ' }, actor)).rejects.toThrow('Void reason');
    await expect(executeBuyingCommand(request(4), actor)).rejects.toThrow('changed');
    expect(mocks.ticket!.buying!.stage).toBe('PAID'); expect(mocks.putState).not.toHaveBeenCalled(); expect(mocks.events.size).toBe(0);
  });
});
