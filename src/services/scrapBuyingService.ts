import { apiRequest } from './apiClient';
import { sharedStorage } from './sharedStorage';
import { storageService } from './storageService';
import type { Ticket } from '@/types/scrap';
import type { BuyingPolicy, LegacyBuyingReview } from '@/types/buyingPayments';

const pendingKeys = new Map<string,string>();
function cacheTicket(ticket: Ticket) {
  sharedStorage.applyServerValue('mahaffeys_tickets',[...storageService.getTickets().filter((row) => row.id !== ticket.id),ticket]);
  return ticket;
}
async function command(body: Record<string,unknown>) {
  const signature = JSON.stringify(body);
  let idempotencyKey = pendingKeys.get(signature);
  if (!idempotencyKey) { idempotencyKey = crypto.randomUUID(); pendingKeys.set(signature,idempotencyKey); }
  const ticket = await apiRequest<Ticket>('/api/scrap-buying/commands',{method:'POST',body:JSON.stringify({...body,idempotencyKey})});
  pendingKeys.delete(signature);
  return cacheTicket(ticket);
}
export const scrapBuyingService = {
  create: (ticket: Ticket) => command({action:'CREATE',id:ticket.id,revision:0,ticket}),
  adopt: (id: string) => command({action:'ADOPT',id,revision:0}),
  save: (ticket: Ticket) => command({action:'SAVE',id:ticket.id,revision:ticket.buying?.revision ?? 0,ticket}),
  finalize: (ticket: Ticket) => command({action:'FINALIZE',id:ticket.id,revision:ticket.buying?.revision ?? 0,reviewed:true}),
  void: (ticket: Ticket,reason: string) => command({action:'VOID',id:ticket.id,revision:ticket.buying?.revision ?? 0,reason}),
  async pay(ticket: Ticket,method: 'Cash'|'Check',reference: string,permitReference: string) {
    const result = await command({action:'PAY',id:ticket.id,revision:ticket.buying?.revision ?? 0,method,reference,permitReference,reviewed:true});
    try {
      const state = await apiRequest<{state:Record<string,unknown>}>('/api/state');
      if (state.state.mahaffeys_cash_drawer) sharedStorage.applyServerValue('mahaffeys_cash_drawer',state.state.mahaffeys_cash_drawer);
    } catch (error) { console.warn('Payment was acknowledged; drawer cache refresh failed',error); }
    return result;
  },
  async queue() {
    const response = await apiRequest<{tickets:Ticket[];policy:BuyingPolicy|null;legacyReviews:LegacyBuyingReview[]}>('/api/scrap-buying/queue');
    const local = storageService.getTickets();
    response.tickets = response.tickets.map((ticket) => {
      const acknowledged = local.find((row) => row.id === ticket.id);
      return (acknowledged?.buying?.revision ?? 0) > (ticket.buying?.revision ?? 0) ? acknowledged! : ticket;
    });
    const ids = new Set(response.tickets.map((ticket) => ticket.id));
    sharedStorage.applyServerValue('mahaffeys_tickets',[...local.filter((ticket) => !ids.has(ticket.id)),...response.tickets]);
    return response;
  },
  legacyReview: (review: {ticketId:string;revision:number;disbursed:boolean;method?:'Cash'|'Check';paidAt?:string;evidenceReference:string;idType:string;idState:string;idNumber:string}) => apiRequest<LegacyBuyingReview>('/api/scrap-buying/legacy-review',{method:'POST',body:JSON.stringify({...review,reviewed:true})}),
  policy: (policy: BuyingPolicy) => apiRequest<BuyingPolicy>('/api/scrap-buying/policy',{method:'POST',body:JSON.stringify(policy)}),
};
