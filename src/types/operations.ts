export type OperationsHealth = 'ON_TARGET' | 'ATTENTION' | 'CRITICAL';
export type OperationsAlertSeverity = 'INFO' | 'ATTENTION' | 'URGENT';
export type OperationsAlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'SNOOZED' | 'RESOLVED';
export type OperationsQueueType = 'INTAKE' | 'VEHICLE' | 'SHIPMENT' | 'CONTAINER' | 'COMPLIANCE' | 'FLEET';

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
  key: 'QUEUE_BACKLOG' | 'TICKET_AGE' | 'VEHICLE_AGE' | 'BAY_CAPACITY' | 'COMPLIANCE_GAP' | 'SHIPMENT_EXCEPTION' | 'MARGIN_LOW' | 'EQUIPMENT_SERVICE_DUE' | 'TOOL_CHECKOUT_OVERDUE';
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

// ── Reconciliation ──────────────────────────────────────────────────────────

export type ReconciliationStatus = 'OPEN' | 'RESOLVED' | 'ADJUSTED' | 'VOIDED';
export type ReconciliationType = 'PAYOUT' | 'CASH_DRAWER' | 'SHIPMENT_SETTLEMENT';

export interface ReconciliationEntry {
  id: string;
  type: ReconciliationType;
  status: ReconciliationStatus;
  referenceId: string;
  expectedAmount: number;
  actualAmount: number;
  variance: number;
  varianceReason?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  adjustmentEntry?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Operational Hiccups ─────────────────────────────────────────────────────

export type HiccupSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type HiccupStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'ESCALATED';
export type HiccupCategory =
  | 'PAYOUT_DISCREPANCY'
  | 'CASH_DRAWER_MISMATCH'
  | 'WEIGHT_DISCREPANCY'
  | 'SETTLEMENT_VARIANCE'
  | 'COMPLIANCE_GAP'
  | 'EQUIPMENT_ISSUE'
  | 'TOOL_OVERDUE'
  | 'PROCESSING_DELAY';

export interface OperationalHiccup {
  id: string;
  fingerprint: string;
  category: HiccupCategory;
  severity: HiccupSeverity;
  title: string;
  detail: string;
  recommendedAction: string;
  link: string;
  createdAt: string;
  updatedAt: string;
  status: HiccupStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  escalatedTo?: string;
  escalatedAt?: string;
  snoozedUntil?: string;
  note?: string;
}

export interface HiccupRule {
  id: string;
  category: HiccupCategory;
  enabled: boolean;
  severityThreshold: HiccupSeverity;
  escalationMinutes: number;
}

export interface HiccupSummary {
  id: string;
  date: string;
  generatedAt: string;
  totalOpen: number;
  totalResolved: number;
  totalEscalated: number;
  criticalOpen: number;
  byCategory: Record<HiccupCategory, number>;
  narrative: string;
}