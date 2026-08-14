import { OutboundShipment, PullYardVehicle, Ticket } from '@/types/scrap';
import { GoalProgress, OperationsMetrics, ShiftGoals } from '@/types/operations';

export const startOfDay = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
export const isSameDay = (value: string, day = new Date()) => new Date(value).toDateString() === day.toDateString();
export const minutesSince = (value: string, now = new Date()) => Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 60000));
export const ticketWeight = (ticket: Ticket) => ticket.ticketType === 'CAR_SALVAGE'
  ? ticket.carRecord?.vehicleWeightLbs ?? 0
  : ticket.scrapLines?.reduce((total, line) => total + line.billableWeight, 0) ?? 0;

export const deriveOperationsMetrics = ({ tickets, shipments, vehicles, openQueueCount, delayedTaskCount, now = new Date() }: {
  tickets: Ticket[]; shipments: OutboundShipment[]; vehicles: PullYardVehicle[]; openQueueCount: number; delayedTaskCount: number; now?: Date;
}): OperationsMetrics => {
  const todaysCompleted = tickets.filter((ticket) => ticket.status === 'COMPLETED' && isSameDay(ticket.createdAt, now));
  const settledToday = shipments.filter((shipment) => shipment.settlement && isSameDay(shipment.settlement.settledAt, now));
  const intakeCycles = todaysCompleted.map((ticket) => minutesSince(ticket.createdAt, now));
  const payouts = todaysCompleted.reduce((total, ticket) => total + ticket.finalPayout, 0);
  const shipmentRevenue = settledToday.reduce((total, shipment) => total + (shipment.settlement?.amountPaid ?? 0), 0);
  const availableVehicles = vehicles.filter((vehicle) => vehicle.status === 'AVAILABLE').length;
  return {
    completedTickets: todaysCompleted.length,
    inboundLbs: todaysCompleted.reduce((total, ticket) => total + ticketWeight(ticket), 0),
    vehiclesProcessed: todaysCompleted.filter((ticket) => ticket.ticketType === 'CAR_SALVAGE').length,
    openQueueCount,
    averageIntakeCycleMinutes: intakeCycles.length ? Math.round(intakeCycles.reduce((a, b) => a + b, 0) / intakeCycles.length) : null,
    agingVehicleCount: vehicles.filter((vehicle) => vehicle.status !== 'CRUSHED' && minutesSince(vehicle.dateSetInYard, now) >= 4320).length,
    delayedTaskCount,
    payouts,
    shipmentRevenue,
    grossMargin: shipmentRevenue - payouts,
    sellThrough: vehicles.length ? Math.round((vehicles.length - availableVehicles) / vehicles.length * 100) : null,
  };
};

export const goalProgress = (goals: ShiftGoals, metrics: OperationsMetrics): GoalProgress[] => {
  const items = [
    ['tickets', 'Completed tickets', metrics.completedTickets, goals.ticketTarget, 'tickets'],
    ['pounds', 'Inbound pounds', metrics.inboundLbs, goals.inboundLbsTarget, 'lbs'],
    ['vehicles', 'Vehicles processed', metrics.vehiclesProcessed, goals.vehicleTarget, 'vehicles'],
    ['turnaround', 'Avg. intake turnaround', metrics.averageIntakeCycleMinutes ?? 0, goals.averageTurnaroundMinutesTarget, 'min'],
    ['margin', 'Gross margin', metrics.grossMargin, goals.grossMarginTarget, 'USD'],
  ] as const;
  return items.map(([key, label, actual, target, unit]) => {
    const lowerIsBetter = key === 'turnaround';
    const progress = target > 0 ? Math.min(100, Math.round((lowerIsBetter ? target / Math.max(actual, 1) : actual / target) * 100)) : 0;
    const state = (lowerIsBetter ? actual <= target : actual >= target) ? 'ACHIEVED' : progress >= 70 ? 'AT_RISK' : 'MISSED';
    return { key, label, actual, target, unit, progress, state };
  });
};
