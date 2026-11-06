import type { Ticket } from '../types/scrap';

export function intakeAge(timestamp: string | undefined, now: number): string {
  const start = timestamp ? Date.parse(timestamp) : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(now) || start > now) return 'unavailable';
  const minutes = Math.floor((now - start) / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} d ${hours % 24} hr`;
}
export function queueStage(ticket: Ticket): string {
  if (ticket.pendingPlatformCapture) return 'Review platform batch';
  if (ticket.scaleGrossInWeight != null && ticket.scaleTareOutWeight != null) return 'Confirm material grade';
  if (ticket.scaleGrossInWeight != null) return 'On yard · awaiting OUT';
  if (ticket.buying?.activeCycleId) return 'Active cycle · verification needed';
  if (ticket.scrapLines?.length) return 'Review ticket / add load';
  if (!ticket.selectedWeighingType) return 'Choose weighing type';
  return ticket.selectedWeighingType === 'PLATFORM' ? 'Awaiting platform batch' : ticket.selectedWeighingType === 'SPLIT_GROUPS' ? 'Split commercial flow disabled' : 'Awaiting IN';
}
export function queueWeighingType(ticket: Ticket): string {
  return ticket.pendingPlatformCapture || ticket.selectedWeighingType === 'PLATFORM' ? 'Platform' : ticket.scaleGrossInWeight != null || ticket.selectedWeighingType === 'VEHICLE_IN_OUT' ? 'Truck IN/OUT' : ticket.selectedWeighingType === 'SPLIT_GROUPS' ? 'Split groups (disabled)' : 'Weighing type not selected';
}
export function presentIntakeQueue(tickets: Ticket[], options: { search: string; needsDetails: boolean; oldestFirst: boolean; attention: (ticket: Ticket) => boolean }): Ticket[] {
  const search = options.search.trim().toLowerCase();
  const rows = tickets.map((ticket, index) => ({ ticket, index })).filter(({ ticket }) =>
    (!options.needsDetails || options.attention(ticket)) && (!search || [ticket.id, ticket.customerName, ticket.customerPhone, ticket.vehicleLicensePlate].some(value => value?.toLowerCase().includes(search))));
  if (options.oldestFirst) rows.sort((a, b) => {
    const aDate = Date.parse(a.ticket.createdAt), bDate = Date.parse(b.ticket.createdAt);
    const difference = (Number.isFinite(aDate) ? aDate : Infinity) - (Number.isFinite(bDate) ? bDate : Infinity);
    return (Number.isNaN(difference) ? 0 : difference) || a.index - b.index;
  });
  return rows.map(row => row.ticket);
}
