import { storageService } from '@/services/storageService';
import { deriveOperationsMetrics, goalProgress, minutesSince } from '@/services/operationsMetrics';
import { AlertRule, DailyManagerSummary, OperationsAlert, OperationsHealth, OperationsQueueEntry, OperationsQueueType, OperationsSnapshot } from '@/types/operations';
import { OutboundShipment, PullYardVehicle, Ticket } from '@/types/scrap';

const queueEntry = (entry: Omit<OperationsQueueEntry, 'elapsedMinutes'>): OperationsQueueEntry => ({ ...entry, elapsedMinutes: minutesSince(entry.createdAt) });
const ruleFor = (rules: AlertRule[], key: AlertRule['key']) => rules.find((rule) => rule.key === key && rule.enabled);

function upsertAlert(candidate: Omit<OperationsAlert, 'id' | 'createdAt' | 'updatedAt' | 'status'>, alerts: OperationsAlert[]) {
  const now = new Date().toISOString();
  const existing = alerts.find((alert) => alert.fingerprint === candidate.fingerprint);
  if (existing) {
    if (existing.status === 'RESOLVED') return existing;
    if (existing.status === 'SNOOZED' && existing.snoozedUntil && new Date(existing.snoozedUntil) > new Date()) return existing;
    return { ...existing, ...candidate, updatedAt: now, status: existing.status === 'SNOOZED' ? 'OPEN' : existing.status };
  }
  return { ...candidate, id: `op-alert-${Date.now()}-${alerts.length}`, createdAt: now, updatedAt: now, status: 'OPEN' as const };
}

const vehicleQueue = (vehicle: PullYardVehicle) => queueEntry({
  id: vehicle.id, type: 'VEHICLE', title: `${vehicle.year} ${vehicle.make} ${vehicle.model}`, detail: `${vehicle.section} · ${vehicle.status.toLowerCase()}`, status: vehicle.status,
  priority: minutesSince(vehicle.dateSetInYard) >= 4320 ? 'URGENT' : vehicle.status === 'PENDING' ? 'ATTENTION' : 'NORMAL', createdAt: vehicle.dateSetInYard, link: '/pull-a-part',
});

export const operationsService = {
  getSnapshot(): OperationsSnapshot {
    const tickets = storageService.getTickets(); const vehicles = storageService.getPullYardVehicles(); const shipments = storageService.getShipments(); const containers = storageService.getContainerDrops(); const bays = storageService.getYardBays();
    const rules = storageService.getOperationsAlertRules(); const goals = storageService.getOperationsGoals();
    const intake = tickets.filter((ticket) => ['PENDING', 'DRAFT'].includes(ticket.status)).map((ticket) => queueEntry({ id: ticket.id, type: 'INTAKE', title: `Ticket #${ticket.id}`, detail: `${ticket.customerName} · ${ticket.ticketType.replace('_', ' ')}`, status: ticket.status, priority: minutesSince(ticket.createdAt) >= (ruleFor(rules, 'TICKET_AGE')?.threshold ?? 45) ? 'URGENT' : 'ATTENTION', owner: ticket.operatorName, createdAt: ticket.createdAt, link: '/tickets' }));
    const shipmentEntries = shipments.filter((shipment) => shipment.status !== 'SETTLED').map((shipment) => queueEntry({ id: shipment.id, type: 'SHIPMENT', title: `Load ${shipment.loadNumber}`, detail: `${shipment.millName} · ${shipment.materialCategory}`, status: shipment.status, priority: shipment.status === 'DISCREPANCY' ? 'URGENT' : shipment.status === 'DELIVERED' ? 'ATTENTION' : 'NORMAL', owner: shipment.driverName, createdAt: shipment.createdAt, link: '/shipments' }));
    const containerEntries = containers.filter((drop) => drop.status !== 'PROCESSED').map((drop) => queueEntry({ id: drop.id, type: 'CONTAINER', title: `Container ${drop.containerNumber}`, detail: `${drop.clientName} · ${drop.status.split('_').join(' ')}`, status: drop.status, priority: new Date(drop.pickupDueDate) < new Date() ? 'URGENT' : drop.status === 'PICKUP_REQUESTED' ? 'ATTENTION' : 'NORMAL', owner: drop.assignedDriver, createdAt: drop.dropDate, link: '/containers' }));
    const compliance = tickets.filter((ticket) => ticket.ticketType === 'CAR_SALVAGE' && ticket.status === 'COMPLETED' && !ticket.complianceCaptures?.nmvtisReported).map((ticket) => queueEntry({ id: `compliance-${ticket.id}`, type: 'COMPLIANCE', title: `NMVTIS review · #${ticket.id}`, detail: ticket.customerName, status: 'PENDING', priority: 'ATTENTION', createdAt: ticket.createdAt, link: '/compliance' }));
    const queues: Record<OperationsQueueType, OperationsQueueEntry[]> = { INTAKE: intake, VEHICLE: vehicles.filter((vehicle) => vehicle.status !== 'CRUSHED').map(vehicleQueue), SHIPMENT: shipmentEntries, CONTAINER: containerEntries, COMPLIANCE: compliance };
    const metrics = deriveOperationsMetrics({ tickets, shipments, vehicles, openQueueCount: intake.length + shipmentEntries.length + containerEntries.length + compliance.length, delayedTaskCount: storageService.getYardTasks().filter((task) => task.status !== 'DONE' && task.dueDate && new Date(task.dueDate) < new Date()).length });
    const candidates: Array<Omit<OperationsAlert, 'id' | 'createdAt' | 'updatedAt' | 'status'>> = [];
    const add = (ruleKey: AlertRule['key'], active: boolean, fingerprint: string, source: OperationsAlert['source'], severity: OperationsAlert['severity'], title: string, message: string, action: string, link: string) => { if (active && ruleFor(rules, ruleKey)) candidates.push({ fingerprint, source, severity, title, message, recommendedAction: action, link }); };
    add('QUEUE_BACKLOG', intake.length > (ruleFor(rules, 'QUEUE_BACKLOG')?.threshold ?? 8), 'queue-backlog', 'INTAKE', 'ATTENTION', 'Intake queue exceeds target', `${intake.length} pending tickets are waiting.`, 'Assign the oldest open intake ticket.', '/tickets');
    intake.filter((entry) => entry.elapsedMinutes >= (ruleFor(rules, 'TICKET_AGE')?.threshold ?? 45)).forEach((entry) => add('TICKET_AGE', true, `ticket-age-${entry.id}`, 'INTAKE', 'URGENT', `Ticket #${entry.id} is waiting too long`, `${entry.elapsedMinutes} minutes open.`, 'Complete or void the ticket, then document the exception.', entry.link));
    queues.VEHICLE.filter((entry) => entry.elapsedMinutes >= (ruleFor(rules, 'VEHICLE_AGE')?.threshold ?? 4320)).forEach((entry) => add('VEHICLE_AGE', true, `vehicle-age-${entry.id}`, 'VEHICLE', 'ATTENTION', `${entry.title} is aging in the yard`, `${Math.floor(entry.elapsedMinutes / 1440)} days since intake.`, 'Stage, publish, or schedule processing.', entry.link));
    bays.forEach((bay) => add('BAY_CAPACITY', bay.capacityLbs > 0 && bay.currentLbs / bay.capacityLbs * 100 >= (ruleFor(rules, 'BAY_CAPACITY')?.threshold ?? 85), `bay-${bay.id}`, 'CONTAINER', bay.status === 'CRITICAL_FULL' ? 'URGENT' : 'ATTENTION', `${bay.bayName} is near capacity`, `${Math.round(bay.currentLbs / bay.capacityLbs * 100)}% full.`, 'Schedule material movement before the bay blocks intake.', '/yard-map'));
    compliance.forEach((entry) => add('COMPLIANCE_GAP', true, `compliance-${entry.id}`, 'COMPLIANCE', 'ATTENTION', `Compliance review needed for ${entry.title.replace('NMVTIS review · ', '')}`, 'Required NMVTIS reporting has not been recorded.', 'Review and export the compliance record.', entry.link));
    shipmentEntries.filter((entry) => entry.status === 'DISCREPANCY').forEach((entry) => add('SHIPMENT_EXCEPTION', true, `shipment-${entry.id}`, 'SHIPMENT', 'URGENT', `${entry.title} has a settlement exception`, 'Shipment status is marked discrepancy.', 'Review weights, settlement, and mill documentation.', entry.link));
    const saved = storageService.getOperationsAlerts(); const nextAlerts = candidates.map((candidate) => upsertAlert(candidate, saved));
    nextAlerts.forEach((alert) => storageService.saveOperationsAlert(alert));
    const alerts = [...saved.filter((alert) => !nextAlerts.some((next) => next.id === alert.id)), ...nextAlerts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const health: OperationsHealth = alerts.some((alert) => alert.status === 'OPEN' && alert.severity === 'URGENT') ? 'CRITICAL' : alerts.some((alert) => alert.status === 'OPEN') ? 'ATTENTION' : 'ON_TARGET';
    const progress = goalProgress(goals, metrics); const activeAlerts = alerts.filter((alert) => alert.status !== 'RESOLVED');
    const bottlenecks = [intake.length ? `${intake.length} intake ticket${intake.length === 1 ? '' : 's'} open` : '', metrics.agingVehicleCount ? `${metrics.agingVehicleCount} vehicle${metrics.agingVehicleCount === 1 ? '' : 's'} aging` : '', compliance.length ? `${compliance.length} compliance review${compliance.length === 1 ? '' : 's'} waiting` : ''].filter(Boolean);
    const summary: DailyManagerSummary = { id: `summary-${new Date().toISOString().slice(0, 10)}`, date: new Date().toISOString().slice(0, 10), generatedAt: new Date().toISOString(), health, narrative: `${metrics.completedTickets} completed tickets and ${metrics.inboundLbs.toLocaleString()} inbound lbs recorded today. ${activeAlerts.length ? `${activeAlerts.length} operational alert${activeAlerts.length === 1 ? '' : 's'} need attention.` : 'No active operational exceptions.'}`, majorBottlenecks: bottlenecks.length ? bottlenecks : ['No material bottlenecks identified.'], suggestedActions: activeAlerts.slice(0, 3).map((alert) => alert.recommendedAction).concat(activeAlerts.length ? [] : ['Maintain current pacing and close out shift records.']), alertsRaised: nextAlerts.filter((alert) => alert.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10)).length, alertsResolved: alerts.filter((alert) => alert.status === 'RESOLVED' && alert.resolvedAt?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length, metrics, goals: progress };
    storageService.saveDailyManagerSummary(summary);
    return { generatedAt: new Date().toISOString(), health, metrics, goals: progress, queues, alerts, summary };
  },
  updateAlert(alert: OperationsAlert, action: 'ACKNOWLEDGED' | 'RESOLVED' | 'SNOOZED', userName: string, note?: string) {
    const now = new Date().toISOString(); const updated: OperationsAlert = { ...alert, status: action, updatedAt: now, note, ...(action === 'ACKNOWLEDGED' ? { acknowledgedBy: userName, acknowledgedAt: now } : {}), ...(action === 'RESOLVED' ? { resolvedBy: userName, resolvedAt: now } : {}), ...(action === 'SNOOZED' ? { snoozedUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString() } : {}) };
    return storageService.saveOperationsAlert(updated);
  },
};
