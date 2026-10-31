import { authService } from './authService';
import { apiRequest } from './apiClient';
import { sharedStorage } from './sharedStorage';
import { storageService } from './storageService';
import { submitIntakeCommand, retryIntakeOperation, acknowledgeIntakeOperation, commandScope } from './intakeSubmissionService';
import type { Customer } from '@/types/scrap';
import type { CustomerInput } from './customerService';
import type { IntakeQueueCapacity, IntakeQueueMembership } from '@/utils/intakeQueue';
import type { Ticket } from '@/types/scrap';
import type { PaymentEligibility, BuyingPolicy, LegacyBuyingReview } from '@/types/buyingPayments';

let sequence = 0;
let queueRequest = 0;
let appliedQueueRequest = 0;
let latestQueue: Awaited<ReturnType<typeof scrapBuyingService.queue>> | undefined;
const acknowledged = new Map<string, { ticket: Ticket; sequence: number }>();
function cacheTicket(ticket: Ticket) {
  acknowledged.set(ticket.id, { ticket, sequence: ++sequence });
  sharedStorage.applyServerValue('mahaffeys_tickets',[...storageService.getTickets().filter((row) => row.id !== ticket.id),ticket]);
  return ticket;
}
async function command(body: Record<string,unknown>) {
  const userId = authService.getCurrentUser()?.id;
  const ticket = await submitIntakeCommand(body);
  if (authService.getCurrentUser()?.id !== userId) throw new Error('Account changed; the original submission is retained for its owner.');
  cacheTicket(ticket);
  if (!['CREATE','FINALIZE_AND_PAY'].includes(String(body.action))) await acknowledgeIntakeOperation(commandScope(body)).catch(() => undefined);
  return ticket;
}
async function recordPayment(action: 'PAY'|'FINALIZE_AND_PAY', ticket: Ticket, method: 'Cash'|'Check', reference: string, permitReference: string, documentationReference: string, reviewed = false) {
  if (method === 'Check' && !reference.trim()) throw new Error('Enter the actual issued check number');
  const result = await command({action,id:ticket.id,revision:ticket.buying?.revision ?? 0,method,reference:method==='Check'?reference.trim():'',permitReference:permitReference.trim(),documentationReference:documentationReference.trim(),reviewed,disbursed:true});
  try {
    const state = await apiRequest<{state:Record<string,unknown>}>('/api/state');
    if (state.state.mahaffeys_cash_drawer) sharedStorage.applyServerValue('mahaffeys_cash_drawer',state.state.mahaffeys_cash_drawer);
  } catch (error) { console.warn('Payment was acknowledged; drawer cache refresh failed',error); }
  return result;
}
export const scrapBuyingService = {
  create: (ticket: Ticket, sellerProfile?: { input: CustomerInput; selectedId?: string; confirmedProfile?: Customer }) => command({action:'CREATE',id:ticket.id,revision:0,ticket,...(sellerProfile ? { sellerProfile } : {})}),
  retry: async (scope: string) => {
    const userId = authService.getCurrentUser()?.id;
    const ticket = await retryIntakeOperation(scope);
    if (authService.getCurrentUser()?.id !== userId) throw new Error('Account changed; reconcile from the original account.');
    return cacheTicket(ticket);
  },
  adopt: (id: string) => command({action:'ADOPT',id,revision:0}),
  save: (ticket: Ticket, binAcknowledgment?: import('@/types/binDeductions').BinReviewAcknowledgment) => command({action:'SAVE',id:ticket.id,revision:ticket.buying?.revision ?? 0,ticket,...(binAcknowledgment ? {binAcknowledgment} : {})}),
  updateSeller: (ticket: Ticket, seller: { phone: string; address: string; idNumber: string; idState: string; idType: import('@/types/scrap').Customer['idType']; plate: string; captures: import('@/types/scrap').ComplianceCaptures }) => command({ action: 'UPDATE_SELLER', id: ticket.id, revision: ticket.buying?.revision ?? 0, seller }),
  void: (ticket: Ticket,reason: string) => command({action:'VOID',id:ticket.id,revision:ticket.buying?.revision ?? 0,reason}),
  eligibility: (ticket: Ticket) => apiRequest<PaymentEligibility>(`/api/scrap-buying/eligibility?id=${encodeURIComponent(ticket.id)}&revision=${ticket.buying?.revision ?? 0}`),
  completeAndPay: (ticket: Ticket,method: 'Cash'|'Check',reference: string,permitReference: string,documentationReference: string,reviewed = false) => recordPayment('FINALIZE_AND_PAY',ticket,method,reference,permitReference,documentationReference,reviewed),
  pay: (ticket: Ticket,method: 'Cash'|'Check',reference: string,permitReference: string,documentationReference = '') => recordPayment('PAY',ticket,method,reference,permitReference,documentationReference),
  async queue(): Promise<{tickets:Ticket[];policy:BuyingPolicy|null;legacyReviews:LegacyBuyingReview[];capacity:IntakeQueueCapacity;membership:IntakeQueueMembership[]}> {
    const started = sequence;
    const request = ++queueRequest;
    const userId = authService.getCurrentUser()?.id;
    const response = await apiRequest<{tickets:Ticket[];policy:BuyingPolicy|null;legacyReviews:LegacyBuyingReview[];capacity:IntakeQueueCapacity;membership:IntakeQueueMembership[]}>('/api/scrap-buying/queue');
    if (authService.getCurrentUser()?.id !== userId) throw new Error('Account changed while loading queue');
    if (request < appliedQueueRequest && latestQueue) return latestQueue;
    appliedQueueRequest = request;
    const local = storageService.getTickets();
    response.tickets = response.tickets.map(ticket => {
      const ack = acknowledged.get(ticket.id);
      return ack && ack.sequence > started && (ack.ticket.buying?.revision ?? 0) > (ticket.buying?.revision ?? 0) ? ack.ticket : ticket;
    });
    if (response.capacity) {
      const open = new Set(response.capacity.openIds);
      for (const ack of acknowledged.values()) if (ack.sequence > started) {
        if (ack.ticket.status === 'PENDING' && ack.ticket.buying?.stage === 'DRAFT') open.add(ack.ticket.id);
        else open.delete(ack.ticket.id);
      }
      response.capacity = { ...response.capacity, openIds: [...open], openCount: open.size };
    }
    const ids = new Set(response.tickets.map(ticket => ticket.id));
    const membership = new Map((response.membership ?? []).map(row => [row.id, row]));
    const retained = local.filter(ticket => !ids.has(ticket.id)).map(ticket => {
      const evidence = membership.get(ticket.id);
      const ack = acknowledged.get(ticket.id);
      if (!evidence || (ack && ack.sequence > started)) return ticket;
      return { ...ticket, status: evidence.status, ...(ticket.buying ? { buying: { ...ticket.buying, revision: evidence.revision } } : {}) };
    });
    sharedStorage.applyServerValue('mahaffeys_tickets',[...retained,...response.tickets]);
    latestQueue = response;
    return response;
  },
  legacyReview: (review: {ticketId:string;revision:number;disbursed:boolean;method?:'Cash'|'Check';paidAt?:string;evidenceReference:string;idType:string;idState:string;idNumber:string}) => apiRequest<LegacyBuyingReview>('/api/scrap-buying/legacy-review',{method:'POST',body:JSON.stringify({...review,reviewed:true})}),
  policy: (policy: BuyingPolicy) => apiRequest<BuyingPolicy>('/api/scrap-buying/policy',{method:'POST',body:JSON.stringify(policy)}),
};
