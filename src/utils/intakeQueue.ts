import type { Ticket } from '../types/scrap';
export const MAX_ACTIVE_INTAKES = 10;
export function openIntakeIds(canonical: Ticket[], legacy: Ticket[]) {
  const known = new Set(canonical.map(ticket => ticket.id));
  return [...new Set([...canonical.filter(ticket => ticket.buying?.stage === 'DRAFT').map(ticket => ticket.id),
    ...legacy.filter(ticket => !known.has(ticket.id) && ticket.ticketType === 'SCRAP_METAL' && ticket.status === 'PENDING').map(ticket => ticket.id)])];
}
export interface IntakeQueueMembership { id: string; revision: number; status: Ticket['status'] }
export interface IntakeQueueCapacity { openCount: number; openIds: string[]; limit: number }
