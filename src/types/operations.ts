export type OperationsHealth = 'ON_TARGET' | 'ATTENTION' | 'CRITICAL';
export type OperationsAlertSeverity = 'INFO' | 'ATTENTION' | 'URGENT';
export type OperationsAlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'SNOOZED' | 'RESOLVED';
export type OperationsQueueType = 'INTAKE' | 'VEHICLE' | 'SHIPMENT' | 'CONTAINER' | 'COMPLIANCE';

export interface ShiftGoals {
  id: string;
  name: string;
  ticketTarget: number;
  inboundLbsTarget: number;
  vehicleTarget: number;
  averageTurnaroundMinutesTarget: number;
  grossMarginTarget: number;
  updatedAt: string;
}

export interface AlertRule {
  id: string;
  key: 'QUEUE_BACKLOG' | 'TICKET_AGE' | 'VEHICLE_AGE' | 'BAY_CAPACITY' | 'COMPLIANCE_GAP' | 'SHIPMENT_EXCEPTION' | 'MARGIN_LOW';
  enabled: boolean;
  threshold: number;
  escalationMinutes: number;
}

export interface OperationsAlert {
  id: string;
  fingerprint: string;
  source: OperationsQueueType | 'PROFIT';
  severity: OperationsAlertSeverity;
  title: string;
  message: string;
  recommendedAction: string;
  link: string;
  createdAt: string;
  updatedAt: string;
  status: OperationsAlertStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  snoozedUntil?: string;
  note?: string;
}

export interface OperationsQueueEntry {
  id: string;
  type: OperationsQueueType;
  title: string;
  detail: string;
  status: string;
  priority: 'NORMAL' | 'ATTENTION' | 'URGENT';
  createdAt: string;
  elapsedMinutes: number;
  owner?: string;
  link: string;
}

export interface GoalProgress {
  key: string;
  label: string;
  actual: number;
  target: number;
  unit: string;
  progress: number;
  state: 'ACHIEVED' | 'AT_RISK' | 'MISSED';
}

export interface OperationsMetrics {
  completedTickets: number;
  inboundLbs: number;
  vehiclesProcessed: number;
  openQueueCount: number;
  averageIntakeCycleMinutes: number | null;
  agingVehicleCount: number;
  delayedTaskCount: number;
  payouts: number;
  shipmentRevenue: number;
  grossMargin: number;
  sellThrough: number | null;
}

export interface DailyManagerSummary {
  id: string;
  date: string;
  generatedAt: string;
  health: OperationsHealth;
  narrative: string;
  majorBottlenecks: string[];
  suggestedActions: string[];
  alertsRaised: number;
  alertsResolved: number;
  metrics: OperationsMetrics;
  goals: GoalProgress[];
}

export interface OperationsSnapshot {
  generatedAt: string;
  health: OperationsHealth;
  metrics: OperationsMetrics;
  goals: GoalProgress[];
  queues: Record<OperationsQueueType, OperationsQueueEntry[]>;
  alerts: OperationsAlert[];
  summary: DailyManagerSummary;
}
