import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ticket } from '../types/scrap';
const mocks = vi.hoisted(() => ({ request: vi.fn(), submit: vi.fn(), tickets: [] as Ticket[] }));
vi.mock('./apiClient', () => ({ apiRequest: mocks.request }));
vi.mock('./intakeSubmissionService', () => ({ submitIntakeCommand: mocks.submit, acknowledgeIntakeOperation: vi.fn().mockResolvedValue(undefined), retryIntakeOperation: vi.fn(), commandScope: (body: {id:string}) => body.id }));
vi.mock('./storageService', () => ({ storageService: { getTickets: () => mocks.tickets } }));
vi.mock('./sharedStorage', () => ({ sharedStorage: { applyServerValue: (_key: string, tickets: Ticket[]) => { mocks.tickets = tickets; } } }));
const ticket = (revision: number) => ({ id: 'TEST', status: 'PENDING', ticketType: 'SCRAP_METAL', buying: { version: 1, revision, stage: 'DRAFT' } } as Ticket);
beforeEach(() => { vi.resetModules(); mocks.request.mockReset(); mocks.submit.mockReset(); mocks.tickets = []; });
describe('authoritative queue reconciliation', () => {
  it('does not trust an arbitrary higher cached revision', async () => {
    mocks.tickets = [ticket(90)]; mocks.request.mockResolvedValue({ tickets: [ticket(2)], membership: [] });
    const { scrapBuyingService } = await import('./scrapBuyingService');
    expect((await scrapBuyingService.queue()).tickets[0].buying?.revision).toBe(2);
  });
  it('an in-flight older GET cannot roll back a newly acknowledged SAVE', async () => {
    let resolve!: (value: unknown) => void;
    mocks.request.mockImplementation(() => new Promise(done => { resolve = done; }));
    const { scrapBuyingService } = await import('./scrapBuyingService');
    const queue = scrapBuyingService.queue();
    mocks.submit.mockResolvedValue(ticket(3));
    await scrapBuyingService.save(ticket(2));
    resolve({ tickets: [ticket(2)], membership: [] });
    expect((await queue).tickets[0].buying?.revision).toBe(3);
    expect(mocks.tickets[0].buying?.revision).toBe(3);
  });
  it('uses explicit closed membership but does not infer deletion from omission', async () => {
    mocks.tickets = [ticket(1), { ...ticket(1), id: 'OMITTED' }];
    mocks.request.mockResolvedValue({ tickets: [], membership: [{ id: 'TEST', revision: 2, status: 'COMPLETED' }] });
    const { scrapBuyingService } = await import('./scrapBuyingService');
    await scrapBuyingService.queue();
    expect(mocks.tickets.find(row => row.id === 'TEST')?.status).toBe('COMPLETED');
    expect(mocks.tickets.find(row => row.id === 'OMITTED')?.status).toBe('PENDING');
  });
});
