import { defineHandler } from 'nitro';
import { setResponseHeader } from 'nitro/h3';
import { buyingUser, currentBuyingPolicy } from '../../../utils/scrapBuying';
import { withTransaction } from '../../../utils/db';
import { lockFinancialState, stateValue } from '../../../utils/financialState';
import { MAX_ACTIVE_INTAKES, openIntakeIds } from '../../../../src/utils/intakeQueue';
import type { Ticket } from '../../../../src/types/scrap';

export default defineHandler(async (event) => {
  await buyingUser(event);
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  return withTransaction(async client => {
    await lockFinancialState(client);
    const all = (await client.query('SELECT document FROM scrap_buying_tickets ORDER BY updated_at DESC')).rows.map(row => row.document as Ticket);
    const legacy = await stateValue<Ticket[]>(client, 'mahaffeys_tickets', []);
    const known = new Set(all.map(ticket => ticket.id));
    const pendingLegacy = legacy.filter(ticket => !known.has(ticket.id) && ticket.ticketType === 'SCRAP_METAL' && ticket.status === 'PENDING');
    const openIds = openIntakeIds(all, legacy);
    const tickets = [...all.filter(ticket => ['DRAFT','FINALIZED'].includes(ticket.buying!.stage)), ...pendingLegacy,
      ...all.filter(ticket => !['DRAFT','FINALIZED'].includes(ticket.buying!.stage)).slice(0,500)];
    const reviews = await client.query('SELECT DISTINCT ON(ticket_id) document FROM scrap_buying_legacy_reviews ORDER BY ticket_id,revision DESC');
    return { tickets, capacity: { openCount: openIds.length, openIds, limit: MAX_ACTIVE_INTAKES },
      membership: all.map(ticket => ({ id: ticket.id, revision: ticket.buying!.revision, status: ticket.status })),
      policy: await currentBuyingPolicy(client), legacyReviews: reviews.rows.map(row => row.document) };
  });
});
