import type { Route } from '@playwright/test';
import type { Ticket } from '../../src/types/scrap';

// Focused synthetic flows need actual verified leases, not an {ok:true} placeholder.
export type FixtureOwner = { ticketId: string; userId: string; operatorName: string; clientId: string; expiresAt: string };
export function ownershipFixture(user: { id: string; fullName: string }, owners = new Map<string, FixtureOwner>()) {
  return async (route: Route) => {
    if (new URL(route.request().url()).pathname !== '/api/scrap-buying/ownership') return false;
    for (const [id, owner] of owners) if (Date.parse(owner.expiresAt) <= Date.now()) owners.delete(id);
    if (route.request().method() === 'GET') await route.fulfill({ json: [...owners.values()] });
    else {
      const body = route.request().postDataJSON();
      const existing = owners.get(body.ticketId);
      const mine = existing?.userId === user.id && existing?.clientId === body.clientId;
      if (body.action === 'RELEASE') {
        if (mine) owners.delete(body.ticketId);
        await route.fulfill({ json: { claimed: false, owner: mine ? null : existing ?? null } });
      } else if ((body.action === 'RENEW' && !mine) || (existing && !mine && body.replaceClientId !== existing.clientId)) {
        await route.fulfill({ json: { claimed: false, owner: existing ?? null } });
      } else {
        const owner = { ticketId: body.ticketId, userId: user.id, operatorName: user.fullName, clientId: body.clientId, expiresAt: new Date(Date.now() + 90000).toISOString() };
        owners.set(body.ticketId, owner); await route.fulfill({ json: { claimed: true, owner } });
      }
    }
    return true;
  };
}
export function queueEnvelope(tickets: Ticket[]) {
  const openIds = tickets.filter(ticket => ticket.status === 'PENDING').map(ticket => ticket.id);
  return { tickets, policy: null, legacyReviews: [], capacity: { openCount: openIds.length, openIds, limit: 10 },
    membership: tickets.map(ticket => ({ id: ticket.id, status: ticket.status, revision: ticket.buying?.revision ?? 0 })) };
}
