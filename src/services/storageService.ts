import { sharedStorage } from "./sharedStorage";
import type {
  MetalGrade,
  AutoSalvageCategoryRate,
  CatalyticConverterCode,
  PullPartItem,
  PullYardVehicle,
  CoreReturnLog,
  AdmissionPass,
  ContainerDrop,
  CashDrawerLog,
  YardBayLocation,
  Customer,
  ComplianceCaptures,
  Ticket,
  CarIntakeRecord,
  NMVTISReportLog,
  YardSettings,
  IpCamera,
  OutboundShipment,
  MillShipper,
  TimeClockEntry,
  ChecklistRun,
  YardTask,
  EquipmentItem,
  MaintenanceLogEntry,
  MetalRateChangeLog,
  ScaleWeightEvent,
  YardMapItem,
} from "@/types/scrap";
import type {
  AlertRule,
  OperationsAlert,
  ShiftGoals,
  DailyManagerSummary,
} from "@/types/operations";

// ---------------------------------------------------------------------------
// Per-key in-memory cache + subscriber pub/sub
// ---------------------------------------------------------------------------
// Rationale: Every component that calls getTickets() was re-parsing the JSON
// blob on every render (30+ times/sec on a busy dashboard). Instead we parse
// once, cache the result, and only re-parse when sharedStorage writes.
// Subscribers are notified so React components re-render automatically.

type Subscribers = Map<string, Set<() => void>>;

const cache = new Map<string, unknown>();
const subscribers = new Map<string, Set<() => void>>();

function readCached<T>(key: string, fallback: T): T {
  if (cache.has(key)) return cache.get(key) as T;
  const raw = sharedStorage.getItem(key);
  if (raw !== null) {
    try { cache.set(key, JSON.parse(raw)); } catch { /* ignore corrupt JSON */ }
  }
  return cache.get(key) as T ?? fallback;
}

const selfWrites = new Set<string>();

function writeCached<T>(key: string, value: T): void {
  cache.set(key, value);
  selfWrites.add(key);
  try {
    sharedStorage.setItem(key, JSON.stringify(value));
  } finally {
    selfWrites.delete(key);
  }
  subscribers.get(key)?.forEach((fn) => fn());
}

// External writes (login hydrate, background workstation sync) update
// localStorage directly — drop stale in-memory snapshots for those keys so
// the next read picks up the fresh data.
sharedStorage.subscribeKey((key: string) => {
  if (!selfWrites.has(key)) cache.delete(key);
});

function patchCached<T>(key: string, value: T): void {
  writeCached(key, value);
}

function subscribe(key: string, fn: () => void): () => void {
  if (!subscribers.has(key)) subscribers.set(key, new Set());
  subscribers.get(key)!.add(fn);
  // Also subscribe to remote sync events so cross-workstation changes trigger re-render.
  const handler = () => fn();
  window.addEventListener("mahaffeys:remote-sync", handler);
  return () => {
    subscribers.get(key)?.delete(fn);
    window.removeEventListener("mahaffeys:remote-sync", handler);
  };
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------
function upsertItem<T extends { id: string }>(key: string, item: T, existing?: T[]): T[] {
  const list = existing ?? readCached<T[]>(key, []);
  const idx = list.findIndex((i) => i.id === item.id);
  if (idx >= 0) { list[idx] = item; return [...list]; }
  return [...list, item];
}

function removeItem<T extends { id: string }>(key: string, id: string, existing?: T[]): T[] {
  const list = existing ?? readCached<T[]>(key, []);
  return list.filter((i) => i.id !== id);
}

// Drop keys from storage + cache so the next read falls back to defaults,
// then notify subscribers so mounted components re-render.
function clearKeys(keys: string[]): void {
  keys.forEach((key) => {
    cache.delete(key);
    sharedStorage.removeItem(key);
    subscribers.get(key)?.forEach((fn) => fn());
  });
}

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------
const MAX_SCALE_EVENTS = 500;

const DEFAULT_SETTINGS: YardSettings = {
  yardName: "My Recycling Yard",
  address: "",
  cityStateZip: "",
  phone: "",
  email: "",
  licenseNumber: "",
  receiptHeader: "Thank you for recycling with us.",
  receiptFooter: "All transactions are final.",
  defaultWeightUnit: "LBS",
  serialBaudRate: 9600,
  webSocketUrl: "",
  operatorName: "Operator",
  admissionFeeUsd: 0,
  cashDrawerFloatLimit: 0,
  scales: [],
  currentScaleId: null,
};

const DEFAULT_GOALS: ShiftGoals = {
  id: "default",
  name: "Default Shift",
  ticketTarget: 20,
  inboundLbsTarget: 10000,
  vehicleTarget: 5,
  averageTurnaroundMinutesTarget: 15,
  grossMarginTarget: 500,
  updatedAt: new Date().toISOString(),
};

const DEFAULT_ALERT_RULES: AlertRule[] = [
  { id: "r1", key: "QUEUE_BACKLOG", enabled: true, threshold: 8, escalationMinutes: 30 },
  { id: "r2", key: "TICKET_AGE", enabled: true, threshold: 45, escalationMinutes: 60 },
  { id: "r3", key: "VEHICLE_AGE", enabled: true, threshold: 4320, escalationMinutes: 1440 },
  { id: "r4", key: "BAY_CAPACITY", enabled: true, threshold: 85, escalationMinutes: 120 },
  { id: "r5", key: "COMPLIANCE_GAP", enabled: true, threshold: 1, escalationMinutes: 60 },
  { id: "r6", key: "SHIPMENT_EXCEPTION", enabled: true, threshold: 1, escalationMinutes: 30 },
  { id: "r7", key: "MARGIN_LOW", enabled: true, threshold: 0, escalationMinutes: 120 },
];

// ---------------------------------------------------------------------------
// The exported service
// ---------------------------------------------------------------------------
export const storageService = {
  // ── Metals / Pricing ──────────────────────────────────────────────────────
  getMetals: (): MetalGrade[] => readCached("mahaffeys_metals", []),
  saveMetals: (metals: MetalGrade[]) => patchCached("mahaffeys_metals", metals),

  getCarRates: (): AutoSalvageCategoryRate[] => readCached("mahaffeys_car_rates", []),
  saveCarRates: (rates: AutoSalvageCategoryRate[]) => patchCached("mahaffeys_car_rates", rates),

  getCatCodes: (): CatalyticConverterCode[] => readCached("mahaffeys_cat_codes", []),
  saveCatCodes: (codes: CatalyticConverterCode[]) => patchCached("mahaffeys_cat_codes", codes),

  /** Clears the pricing catalog back to seed defaults (metals, car rates, cat codes). */
  resetPricingToDefaults: (): void => {
    clearKeys(["mahaffeys_metals", "mahaffeys_car_rates", "mahaffeys_cat_codes"]);
  },

  // ── Customers ─────────────────────────────────────────────────────────────
  getCustomers: (): Customer[] => readCached("mahaffeys_customers", []),
  saveCustomer: (customer: Customer) => {
    const existing = storageService.getCustomers();
    patchCached("mahaffeys_customers", upsertItem("mahaffeys_customers", customer, existing));
  },
  removeCustomer: (id: string) => {
    patchCached("mahaffeys_customers", removeItem("mahaffeys_customers", id, storageService.getCustomers()));
  },

  // ── Tickets ───────────────────────────────────────────────────────────────
  getTickets: (): Ticket[] => readCached("mahaffeys_tickets", []),
  saveTicket: (ticket: Ticket) => {
    const existing = storageService.getTickets();
    patchCached("mahaffeys_tickets", upsertItem("mahaffeys_tickets", ticket, existing));
  },
  removeTicket: (id: string) => {
    patchCached("mahaffeys_tickets", removeItem("mahaffeys_tickets", id, storageService.getTickets()));
  },

  /**
   * Sequential scrap-only receipt numbers: 2026-30, 2026-31, 2026-32, ...
   * Only scrap metal tickets are counted, so numbering stays reserved for
   * scrap receipts regardless of what other intake types create.
   */
  generateScrapReceiptNumber: (): string => {
    const year = new Date().getFullYear();
    let maxSequence = 29; // sequence starts at 30
    storageService.getTickets().forEach((ticket) => {
      if (ticket.ticketType !== "SCRAP_METAL") return;
      const match = ticket.id.match(/^(\d{4})-(\d+)$/);
      if (match && match[1] === String(year)) {
        const sequence = parseInt(match[2], 10);
        if (Number.isFinite(sequence) && sequence > maxSequence) {
          maxSequence = sequence;
        }
      }
    });
    return `${year}-${maxSequence + 1}`;
  },

  /** Renames a ticket id after validating the new number is unique. */
  updateTicketId: (oldId: string, newId: string): { success: boolean; message?: string } => {
    const cleanNewId = newId.trim();
    if (!cleanNewId) {
      return { success: false, message: "Receipt / Ticket number cannot be empty" };
    }
    const tickets = storageService.getTickets();
    if (cleanNewId !== oldId && tickets.some((t) => t.id === cleanNewId)) {
      return { success: false, message: `Receipt number "${cleanNewId}" is already used by another ticket` };
    }
    const ticketIndex = tickets.findIndex((t) => t.id === oldId);
    if (ticketIndex === -1) {
      return { success: false, message: "Original ticket not found" };
    }
    tickets[ticketIndex] = { ...tickets[ticketIndex], id: cleanNewId };
    patchCached("mahaffeys_tickets", tickets);

    // Keep cash drawer ledger references pointing at the renamed ticket.
    const cashLogs = storageService.getCashDrawerLogs();
    let updatedCashLogs = false;
    cashLogs.forEach((log) => {
      if (log.ticketId === oldId) {
        log.ticketId = cleanNewId;
        log.notes = log.notes?.replace(oldId, cleanNewId);
        updatedCashLogs = true;
      }
    });
    if (updatedCashLogs) patchCached("mahaffeys_cash_drawer", cashLogs);

    return { success: true };
  },

  // ── Pull-Apart / Yard Vehicles ────────────────────────────────────────────
  getPullYardVehicles: (): PullYardVehicle[] => readCached("mahaffeys_pull_yard_vehicles", []),
  savePullYardVehicle: (vehicle: PullYardVehicle) => {
    const existing = storageService.getPullYardVehicles();
    patchCached("mahaffeys_pull_yard_vehicles", upsertItem("mahaffeys_pull_yard_vehicles", vehicle, existing));
  },
  removePullYardVehicle: (id: string) => {
    patchCached("mahaffeys_pull_yard_vehicles", removeItem("mahaffeys_pull_yard_vehicles", id, storageService.getPullYardVehicles()));
  },

  getPullParts: (): PullPartItem[] => readCached("mahaffeys_pull_parts", []),
  savePullPart: (part: PullPartItem) => {
    const existing = storageService.getPullParts();
    patchCached("mahaffeys_pull_parts", upsertItem("mahaffeys_pull_parts", part, existing));
  },

  getCoreReturns: (): CoreReturnLog[] => readCached("mahaffeys_core_returns", []),
  saveCoreReturn: (entry: CoreReturnLog) => {
    const existing = storageService.getCoreReturns();
    patchCached("mahaffeys_core_returns", upsertItem("mahaffeys_core_returns", entry, existing));
  },

  getAdmissionPasses: (): AdmissionPass[] => readCached("mahaffeys_admission_passes", []),
  saveAdmissionPass: (pass: AdmissionPass) => {
    const existing = storageService.getAdmissionPasses();
    patchCached("mahaffeys_admission_passes", upsertItem("mahaffeys_admission_passes", pass, existing));
  },

  // ── Containers / Yard Bays ────────────────────────────────────────────────
  getContainerDrops: (): ContainerDrop[] => readCached("mahaffeys_container_drops", []),
  saveContainerDrop: (drop: ContainerDrop) => {
    const existing = storageService.getContainerDrops();
    patchCached("mahaffeys_container_drops", upsertItem("mahaffeys_container_drops", drop, existing));
  },

  getYardBays: (): YardBayLocation[] => readCached("mahaffeys_yard_bays", []),
  saveYardBays: (bays: YardBayLocation[]) => patchCached("mahaffeys_yard_bays", bays),

  getYardLayout: (): YardMapItem[] => readCached("mahaffeys_yard_layout", []),
  saveYardLayout: (items: YardMapItem[]) => patchCached("mahaffeys_yard_layout", items),

  // ── Cash Drawer ────────────────────────────────────────────────────────────
  getCashDrawerLogs: (): CashDrawerLog[] => readCached("mahaffeys_cash_drawer", []),
  saveCashDrawerLog: (log: CashDrawerLog) => {
    const existing = storageService.getCashDrawerLogs();
    patchCached("mahaffeys_cash_drawer", upsertItem("mahaffeys_cash_drawer", log, existing));
  },

  /** Appends a ledger entry, deriving balanceAfter from the most recent log. */
  addCashDrawerEntry: (entry: Omit<CashDrawerLog, "id" | "timestamp" | "balanceAfter">): CashDrawerLog => {
    const logs = storageService.getCashDrawerLogs();
    const latest = [...logs].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
    const currentBalance = latest ? latest.balanceAfter : 0;
    const log: CashDrawerLog = {
      id: `cd-${Date.now()}`,
      timestamp: new Date().toISOString(),
      balanceAfter: Math.round((currentBalance + entry.amount) * 100) / 100,
      ...entry,
    };
    storageService.saveCashDrawerLog(log);
    return log;
  },

  // ── NMVTIS / Compliance ───────────────────────────────────────────────────
  getNMVTISLogs: (): NMVTISReportLog[] => readCached("mahaffeys_nmvtis_logs", []),
  saveNMVTISLog: (log: NMVTISReportLog) => {
    const existing = storageService.getNMVTISLogs();
    patchCached("mahaffeys_nmvtis_logs", upsertItem("mahaffeys_nmvtis_logs", log, existing));
  },

  /** Stamps tickets (and their car records) as reported in an NMVTIS batch. */
  markTicketsAsNMVTISReported: (ticketIds: string[], batchId: string): void => {
    const now = new Date().toISOString();
    const reported = { nmvtisReported: true, nmvtisReportedAt: now, nmvtisBatchId: batchId };
    const tickets = storageService.getTickets().map((t) =>
      ticketIds.includes(t.id)
        ? {
            ...t,
            complianceCaptures: { ...t.complianceCaptures, ...reported },
            carRecord: t.carRecord
              ? { ...t.carRecord, complianceCaptures: { ...t.carRecord.complianceCaptures, ...reported } }
              : t.carRecord,
          }
        : t
    );
    patchCached("mahaffeys_tickets", tickets);
  },

  getIpCameras: (): IpCamera[] => readCached("mahaffeys_ip_cameras", []),
  saveIpCamera: (camera: IpCamera) => {
    const existing = storageService.getIpCameras();
    patchCached("mahaffeys_ip_cameras", upsertItem("mahaffeys_ip_cameras", camera, existing));
  },
  removeIpCamera: (id: string) => {
    patchCached("mahaffeys_ip_cameras", removeItem("mahaffeys_ip_cameras", id, storageService.getIpCameras()));
  },

  // ── Shipments / Mills ─────────────────────────────────────────────────────
  getShipments: (): OutboundShipment[] => readCached("mahaffeys_shipments", []),
  saveShipment: (shipment: OutboundShipment) => {
    const existing = storageService.getShipments();
    patchCached("mahaffeys_shipments", upsertItem("mahaffeys_shipments", shipment, existing));
  },

  getMills: (): MillShipper[] => readCached("mahaffeys_mills", []),
  saveMill: (mill: MillShipper) => {
    const existing = storageService.getMills();
    patchCached("mahaffeys_mills", upsertItem("mahaffeys_mills", mill, existing));
  },

  // ── Team Ops ──────────────────────────────────────────────────────────────
  getTimeClockEntries: (): TimeClockEntry[] => readCached("mahaffeys_timeclock", []),
  saveTimeClockEntry: (entry: TimeClockEntry) => {
    const existing = storageService.getTimeClockEntries();
    patchCached("mahaffeys_timeclock", upsertItem("mahaffeys_timeclock", entry, existing));
  },

  getChecklistRuns: (): ChecklistRun[] => readCached("mahaffeys_checklists", []),
  saveChecklistRun: (run: ChecklistRun) => {
    const existing = storageService.getChecklistRuns();
    patchCached("mahaffeys_checklists", upsertItem("mahaffeys_checklists", run, existing));
  },

  getYardTasks: (): YardTask[] => readCached("mahaffeys_tasks", []),
  saveYardTask: (task: YardTask) => {
    const existing = storageService.getYardTasks();
    patchCached("mahaffeys_tasks", upsertItem("mahaffeys_tasks", task, existing));
  },

  getEquipment: (): EquipmentItem[] => readCached("mahaffeys_equipment", []),
  saveEquipment: (item: EquipmentItem) => {
    const existing = storageService.getEquipment();
    patchCached("mahaffeys_equipment", upsertItem("mahaffeys_equipment", item, existing));
  },

  getMaintenanceLogs: (): MaintenanceLogEntry[] => readCached("mahaffeys_maintenance_logs", []),
  saveMaintenanceLog: (log: MaintenanceLogEntry) => {
    const existing = storageService.getMaintenanceLogs();
    patchCached("mahaffeys_maintenance_logs", upsertItem("mahaffeys_maintenance_logs", log, existing));
  },

  getRateHistory: (): MetalRateChangeLog[] => readCached("mahaffeys_rate_history", []),
  saveRateHistory: (log: MetalRateChangeLog) => {
    const existing = storageService.getRateHistory();
    patchCached("mahaffeys_rate_history", upsertItem("mahaffeys_rate_history", log, existing));
  },

  // ── Weight Activity Journal ───────────────────────────────────────────────
  // Newest-first, hard-capped so a busy platform can never grow storage
  // without bound. Events are emitted by scaleService's plateau detection.
  getScaleEvents: (): ScaleWeightEvent[] => readCached("mahaffeys_scale_events", []),

  addScaleEvent: (event: ScaleWeightEvent): ScaleWeightEvent => {
    const existing = storageService.getScaleEvents();
    patchCached("mahaffeys_scale_events", [event, ...existing].slice(0, MAX_SCALE_EVENTS));
    return event;
  },

  clearScaleEvents: (): void => patchCached("mahaffeys_scale_events", []),

  // ── Settings ──────────────────────────────────────────────────────────────
  getSettings: (): YardSettings => readCached("mahaffeys_settings", DEFAULT_SETTINGS),
  saveSettings: (settings: YardSettings) => patchCached("mahaffeys_settings", settings),

  /** Factory reset: clears every yard data key back to seed defaults. */
  resetToDefaults: (): void => {
    clearKeys([
      "mahaffeys_metals",
      "mahaffeys_car_rates",
      "mahaffeys_cat_codes",
      "mahaffeys_customers",
      "mahaffeys_tickets",
      "mahaffeys_pull_yard_vehicles",
      "mahaffeys_pull_parts",
      "mahaffeys_core_returns",
      "mahaffeys_admission_passes",
      "mahaffeys_container_drops",
      "mahaffeys_yard_bays",
      "mahaffeys_yard_layout",
      "mahaffeys_cash_drawer",
      "mahaffeys_nmvtis_logs",
      "mahaffeys_ip_cameras",
      "mahaffeys_shipments",
      "mahaffeys_mills",
      "mahaffeys_timeclock",
      "mahaffeys_checklists",
      "mahaffeys_tasks",
      "mahaffeys_equipment",
      "mahaffeys_maintenance_logs",
      "mahaffeys_rate_history",
      "mahaffeys_scale_events",
      "mahaffeys_removed_inventory_vehicles",
      "mahaffeys_operations_goals",
      "mahaffeys_operations_alert_rules",
      "mahaffeys_operations_alerts",
      "mahaffeys_operations_summaries",
      "mahaffeys_settings",
    ]);
  },

  // ── Operations ────────────────────────────────────────────────────────────
  getOperationsGoals: (): ShiftGoals => readCached("mahaffeys_operations_goals", DEFAULT_GOALS),
  saveOperationsGoals: (goals: ShiftGoals) => patchCached("mahaffeys_operations_goals", goals),

  getOperationsAlertRules: (): AlertRule[] => readCached("mahaffeys_operations_alert_rules", DEFAULT_ALERT_RULES),
  saveOperationsAlertRules: (rules: AlertRule[]) => patchCached("mahaffeys_operations_alert_rules", rules),

  getOperationsAlerts: (): OperationsAlert[] => readCached("mahaffeys_operations_alerts", []),
  saveOperationsAlert: (alert: OperationsAlert) => {
    const existing = storageService.getOperationsAlerts();
    patchCached("mahaffeys_operations_alerts", upsertItem("mahaffeys_operations_alerts", alert, existing));
  },

  getDailyManagerSummaries: (): DailyManagerSummary[] => readCached("mahaffeys_operations_summaries", []),
  saveDailyManagerSummary: (summary: DailyManagerSummary) => {
    const existing = storageService.getDailyManagerSummaries();
    // Keep only the latest per date
    const filtered = existing.filter((s) => s.date !== summary.date);
    patchCached("mahaffeys_operations_summaries", [...filtered, summary]);
  },

  // ── Removed inventory ─────────────────────────────────────────────────────
  getRemovedInventoryVehicles: (): string[] => readCached("mahaffeys_removed_inventory_vehicles", []),
  markVehicleRemoved: (id: string) => {
    const existing = storageService.getRemovedInventoryVehicles();
    if (!existing.includes(id)) patchCached("mahaffeys_removed_inventory_vehicles", [...existing, id]);
  },

  // ── React integration helper ──────────────────────────────────────────────
  // Returns a subscription fn; call it to unsubscribe.
  subscribe,

  /** Drops the in-memory snapshot for a key so the next read re-parses localStorage. */
  refreshCacheFromStorage(key: string): void {
    cache.delete(key);
    subscribers.get(key)?.forEach((fn) => fn());
  },
};
