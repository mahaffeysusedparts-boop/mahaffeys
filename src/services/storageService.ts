import {
  Customer,
  MetalGrade,
  AutoSalvageCategoryRate,
  Ticket,
  YardSettings,
  NMVTISReportLog,
  CatalyticConverterCode,
  ContainerDrop,
  CashDrawerLog,
  YardBayLocation,
  PullPartItem,
  PullYardVehicle,
  CoreReturnLog,
  AdmissionPass,
  IpCamera,
  OutboundShipment,
  MillShipper,
  TimeClockEntry,
  ChecklistRun,
  YardTask,
  EquipmentItem,
  MaintenanceLogEntry,
  MetalRateChangeLog,
} from "@/types/scrap";
import { AlertRule, DailyManagerSummary, OperationsAlert, ShiftGoals } from "@/types/operations";
import { sharedStorage } from "@/services/sharedStorage";

const STORAGE_KEYS = {
  METALS: 'mahaffeys_metals',
  CAR_RATES: 'mahaffeys_car_rates',
  CUSTOMERS: 'mahaffeys_customers',
  TICKETS: 'mahaffeys_tickets',
  SETTINGS: 'mahaffeys_settings',
  NMVTIS_LOGS: 'mahaffeys_nmvtis_logs',
  CATALYTIC_CODES: 'mahaffeys_cat_codes',
  CONTAINER_DROPS: 'mahaffeys_container_drops',
  CASH_DRAWER: 'mahaffeys_cash_drawer',
  YARD_BAYS: 'mahaffeys_yard_bays',
  PULL_PARTS: 'mahaffeys_pull_parts',
  PULL_YARD_VEHICLES: 'mahaffeys_pull_yard_vehicles',
  REMOVED_INVENTORY_VEHICLES: 'mahaffeys_removed_inventory_vehicles',
  CORE_RETURNS: 'mahaffeys_core_returns',
  ADMISSION_PASSES: 'mahaffeys_admission_passes',
  IP_CAMERAS: 'mahaffeys_ip_cameras',
  SHIPMENTS: 'mahaffeys_shipments',
  MILLS: 'mahaffeys_mills',
  TIMECLOCK: 'mahaffeys_timeclock',
  CHECKLISTS: 'mahaffeys_checklists',
  TASKS: 'mahaffeys_tasks',
  EQUIPMENT: 'mahaffeys_equipment',
  MAINTENANCE: 'mahaffeys_maintenance_logs',
  RATE_HISTORY: 'mahaffeys_rate_history',
  OPERATIONS_GOALS: 'mahaffeys_operations_goals',
  OPERATIONS_ALERT_RULES: 'mahaffeys_operations_alert_rules',
  OPERATIONS_ALERTS: 'mahaffeys_operations_alerts',
  OPERATIONS_SUMMARIES: 'mahaffeys_operations_summaries',
};

// ---------------------------------------------------------------------------
// In-memory cache layer
// ---------------------------------------------------------------------------
// Why: storageService.getX() used to JSON.parse the whole blob on every call.
// Many pages call it 5–10 times per render (e.g. Dashboard). The previous
// "cache" only covered PullYardVehicles — everything else parsed every time.
// We now cache every key with an mtime stamp; writes update the cache
// synchronously, reads just hand back the cached array/object.
// ---------------------------------------------------------------------------

type CacheEntry = { source: string; value: unknown };

const cache = new Map<string, CacheEntry>();

function readCached<T>(key: string, fallback: T): T {
  const raw = sharedStorage.getItem(key);
  if (raw === null || raw === undefined) {
    cache.set(key, { source: "", value: fallback });
    sharedStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
  const hit = cache.get(key);
  if (hit && hit.source === raw) return hit.value as T;
  const parsed = JSON.parse(raw) as T;
  cache.set(key, { source: raw, value: parsed });
  return parsed;
}

function writeCached<T>(key: string, value: T): void {
  const serialized = JSON.stringify(value);
  sharedStorage.setItem(key, serialized);
  cache.set(key, { source: serialized, value });
}

function appendCached<T extends { id: string }>(key: string, item: T): T {
  const items = readCached<T[]>(key, []);
  const idx = items.findIndex((candidate) => candidate.id === item.id);
  if (idx >= 0) items[idx] = item; else items.unshift(item);
  writeCached(key, items);
  return item;
}

function patchCached<T>(key: string, items: T[]): void {
  writeCached(key, items);
}

function deleteByIdCached<T extends { id: string }>(key: string, id: string): void {
  const items = readCached<T[]>(key, []).filter((item) => item.id !== id);
  writeCached(key, items);
}

// Subscribers for cross-component notifications (replaces repeated JSON.parse
// followed by manual setState in dozens of pages).
type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

export function subscribeKey(key: string, listener: Listener): () => void {
  let bucket = listeners.get(key);
  if (!bucket) {
    bucket = new Set();
    listeners.set(key, bucket);
  }
  bucket.add(listener);
  return () => {
    bucket.delete(listener);
  };
}

function notify(key: string): void {
  const bucket = listeners.get(key);
  if (!bucket) return;
  bucket.forEach((listener) => {
    try { listener(); } catch { /* ignore listener errors */ }
  });
}

export function refreshCacheFromStorage(key: string): void {
  // Drop the in-memory snapshot so the next read re-parses whatever just
  // landed from the server.
  cache.delete(key);
  notify(key);
}

// ---------------------------------------------------------------------------
// Pull vehicle cache (existing, but re-wired through the generic layer)
// ---------------------------------------------------------------------------

let pullVehicleCacheSource: string | null = null;
let pullVehicleCache: PullYardVehicle[] | null = null;

const getRemovedInventoryVehicleIds = (): Set<string> => {
  const ids = readCached<string[]>(STORAGE_KEYS.REMOVED_INVENTORY_VEHICLES, []);
  return new Set(ids);
};

const saveRemovedInventoryVehicleIds = (ids: Set<string>): void => {
  writeCached(STORAGE_KEYS.REMOVED_INVENTORY_VEHICLES, [...ids]);
};

const sectionForMake = (make: string): PullYardVehicle['section'] => {
  const normalized = make.toLowerCase();
  if (normalized.includes('ford') || normalized.includes('lincoln') || normalized.includes('mercury')) return 'Ford & Lincoln';
  if (normalized.includes('chevrolet') || normalized.includes('chevy') || normalized.includes('gmc') || normalized.includes('buick') || normalized.includes('cadillac')) return 'GM & Chevrolet';
  if (normalized.includes('chrysler') || normalized.includes('dodge') || normalized.includes('jeep') || normalized.includes('ram')) return 'Chrysler & Dodge';
  if (['toyota', 'nissan', 'honda', 'subaru', 'mazda', 'mitsubishi', 'hyundai', 'kia', 'lexus', 'acura', 'infiniti'].some((brand) => normalized.includes(brand))) return 'Asian Imports';
  if (['bmw', 'mercedes', 'audi', 'volkswagen', 'volvo', 'porsche', 'mini', 'jaguar', 'land rover'].some((brand) => normalized.includes(brand))) return 'European';
  return 'Domestic Trucks & SUVs';
};

const vehicleFromTicket = (ticket: Ticket): PullYardVehicle | null => {
  const car = ticket.carRecord;
  if (ticket.ticketType !== 'CAR_SALVAGE' || ticket.status === 'VOIDED' || !car) return null;
  return {
    id: `veh-ticket-${ticket.id}`,
    sourceTicketId: ticket.id,
    section: sectionForMake(car.make),
    year: car.year,
    make: car.make,
    model: car.model,
    trim: car.trim,
    color: car.color,
    vin: car.vin,
    engineSizeLiters: car.engineSizeLiters,
    engineCylinders: car.engineCylinders,
    engineModel: car.engineModel,
    fuelType: car.fuelType,
    dateSetInYard: ticket.createdAt,
    status: car.yardStatus || 'PENDING',
    partsRemaining: ['Engine Assembly', 'Transmission', 'Doors', 'Wheels', 'Headlights', 'Fenders'],
    photoUrl: car.photoUrl || ticket.complianceCaptures?.vehiclePhotoUrl,
    purchasePrice: car.purchasePrice ?? ticket.finalPayout,
    originSource: car.originSource || 'Tow Intake',
    notes: car.notes || ticket.notes,
    dismantlingLog: {
      catalyticConvertersRemoved: 0,
      wheelsRemoved: 0,
      gasDrained: car.fluidsDrained,
      oilDrained: car.fluidsDrained,
    },
  };
};

export const INITIAL_IP_CAMERAS: IpCamera[] = [];

export const INITIAL_PULL_PARTS: PullPartItem[] = [];

export const INITIAL_PULL_VEHICLES: PullYardVehicle[] = [];

export const INITIAL_CORE_RETURNS: CoreReturnLog[] = [];

export const INITIAL_ADMISSION_PASSES: AdmissionPass[] = [];

export const INITIAL_CAT_CODES: CatalyticConverterCode[] = [];

export const INITIAL_CONTAINER_DROPS: ContainerDrop[] = [];

export const INITIAL_CASH_DRAWER: CashDrawerLog[] = [];

export const INITIAL_YARD_BAYS: YardBayLocation[] = [];

export const INITIAL_METALS: MetalGrade[] = [];

export const INITIAL_CAR_RATES: AutoSalvageCategoryRate[] = [];

export const INITIAL_CUSTOMERS: Customer[] = [];

export const INITIAL_SETTINGS: YardSettings = {
  yardName: 'My Recycling Yard',
  address: '',
  cityStateZip: '',
  phone: '',
  email: '',
  licenseNumber: '',
  nmvtisReportingId: '',
  receiptHeader: 'Thank you for recycling with us.',
  receiptFooter: 'All transactions are final.',
  defaultWeightUnit: 'LBS',
  serialBaudRate: 9600,
  webSocketUrl: 'ws://localhost:8080/scale',
  operatorName: 'Operator',
  cashDrawerFloatLimit: 0,
  admissionFeeUsd: 0,
  publicHours: 'Monday–Saturday, 8:00 AM–5:00 PM',
  safetyRequirements: 'Closed-toe boots and safety glasses are required. Jacks, torches, and power cutting saws are prohibited.',
  customDomain: '',
};

export const INITIAL_TICKETS: Ticket[] = [];

export const storageService = {
  getIpCameras(): IpCamera[] {
    return readCached(STORAGE_KEYS.IP_CAMERAS, INITIAL_IP_CAMERAS);
  },

  saveIpCamera(camera: IpCamera): IpCamera {
    appendCached(STORAGE_KEYS.IP_CAMERAS, camera);
    notify(STORAGE_KEYS.IP_CAMERAS);
    return camera;
  },

  deleteIpCamera(cameraId: string): void {
    deleteByIdCached<IpCamera>(STORAGE_KEYS.IP_CAMERAS, cameraId);
    notify(STORAGE_KEYS.IP_CAMERAS);
  },

  getMetals(): MetalGrade[] {
    return readCached(STORAGE_KEYS.METALS, INITIAL_METALS);
  },

  saveMetals(metals: MetalGrade[]): void {
    patchCached(STORAGE_KEYS.METALS, metals);
    notify(STORAGE_KEYS.METALS);
  },

  getCarRates(): AutoSalvageCategoryRate[] {
    return readCached(STORAGE_KEYS.CAR_RATES, INITIAL_CAR_RATES);
  },

  saveCarRates(rates: AutoSalvageCategoryRate[]): void {
    patchCached(STORAGE_KEYS.CAR_RATES, rates);
    notify(STORAGE_KEYS.CAR_RATES);
  },

  getPullParts(): PullPartItem[] {
    return readCached(STORAGE_KEYS.PULL_PARTS, INITIAL_PULL_PARTS);
  },

  savePullParts(parts: PullPartItem[]): void {
    patchCached(STORAGE_KEYS.PULL_PARTS, parts);
    notify(STORAGE_KEYS.PULL_PARTS);
  },

  getPullYardVehicles(): PullYardVehicle[] {
    const data = sharedStorage.getItem(STORAGE_KEYS.PULL_YARD_VEHICLES);
    if (!data) {
      const serialized = JSON.stringify(INITIAL_PULL_VEHICLES);
      sharedStorage.setItem(STORAGE_KEYS.PULL_YARD_VEHICLES, serialized);
      pullVehicleCacheSource = serialized;
      pullVehicleCache = INITIAL_PULL_VEHICLES;
      return INITIAL_PULL_VEHICLES;
    }

    if (data === pullVehicleCacheSource && pullVehicleCache) {
      return pullVehicleCache;
    }

    const vehicles = JSON.parse(data) as Array<Omit<PullYardVehicle, 'status' | 'dismantlingLog'> & {
      status: string;
      dismantlingLog?: PullYardVehicle['dismantlingLog'];
    }>;

    pullVehicleCacheSource = data;
    pullVehicleCache = vehicles.map((vehicle) => ({
      ...vehicle,
      status:
        vehicle.status === 'CRUSHED' || vehicle.status === 'STRIPPED_SHELL' || vehicle.status === 'READY_FOR_CRUSHER'
          ? 'CRUSHED'
          : vehicle.status === 'PENDING'
            ? 'PENDING'
            : 'AVAILABLE',
      dismantlingLog: vehicle.dismantlingLog || {
        catalyticConvertersRemoved: 0,
        wheelsRemoved: 0,
        gasDrained: false,
        oilDrained: false,
      },
    }));
    return pullVehicleCache;
  },

  savePullYardVehicle(veh: PullYardVehicle): PullYardVehicle {
    const vehicles = this.getPullYardVehicles();
    const idx = vehicles.findIndex((v) => v.id === veh.id);
    if (idx >= 0) {
      vehicles[idx] = veh;
    } else {
      vehicles.unshift(veh);
    }
    const serialized = JSON.stringify(vehicles);
    sharedStorage.setItem(STORAGE_KEYS.PULL_YARD_VEHICLES, serialized);
    pullVehicleCacheSource = serialized;
    pullVehicleCache = vehicles;

    const removedIds = getRemovedInventoryVehicleIds();
    if (removedIds.delete(veh.id)) saveRemovedInventoryVehicleIds(removedIds);
    notify(STORAGE_KEYS.PULL_YARD_VEHICLES);
    return veh;
  },

  deletePullYardVehicle(vehicleId: string): void {
    const inventoryVehicle = this.getPullYardVehicles().find((vehicle) => vehicle.id === vehicleId);
    if (inventoryVehicle?.sourceTicketId) {
      const removedIds = getRemovedInventoryVehicleIds();
      removedIds.add(vehicleId);
      saveRemovedInventoryVehicleIds(removedIds);
    }

    const vehicles = this.getPullYardVehicles().filter((vehicle) => vehicle.id !== vehicleId);
    const serialized = JSON.stringify(vehicles);
    sharedStorage.setItem(STORAGE_KEYS.PULL_YARD_VEHICLES, serialized);
    pullVehicleCacheSource = serialized;
    pullVehicleCache = vehicles;
    notify(STORAGE_KEYS.PULL_YARD_VEHICLES);
  },

  getCoreReturns(): CoreReturnLog[] {
    return readCached(STORAGE_KEYS.CORE_RETURNS, INITIAL_CORE_RETURNS);
  },

  saveCoreReturn(log: CoreReturnLog): CoreReturnLog {
    appendCached(STORAGE_KEYS.CORE_RETURNS, log);
    notify(STORAGE_KEYS.CORE_RETURNS);

    this.addCashDrawerEntry({
      type: 'PAYOUT_DISBURSEMENT',
      amount: -Math.abs(log.coreDepositRefunded),
      operatorName: log.operatorName,
      notes: `Core deposit refund for ${log.partName} - ${log.customerName}`,
    });

    return log;
  },

  getAdmissionPasses(): AdmissionPass[] {
    return readCached(STORAGE_KEYS.ADMISSION_PASSES, INITIAL_ADMISSION_PASSES);
  },

  saveAdmissionPass(pass: AdmissionPass): AdmissionPass {
    appendCached(STORAGE_KEYS.ADMISSION_PASSES, pass);
    notify(STORAGE_KEYS.ADMISSION_PASSES);

    this.addCashDrawerEntry({
      type: 'VAULT_REPLENISHMENT',
      amount: Math.abs(pass.feePaid),
      operatorName: pass.operatorName,
      notes: `$${pass.feePaid.toFixed(2)} Yard Gate Admission Fee Pass - ${pass.customerName}`,
    });

    return pass;
  },

  getCatCodes(): CatalyticConverterCode[] {
    return readCached(STORAGE_KEYS.CATALYTIC_CODES, INITIAL_CAT_CODES);
  },

  saveCatCode(codeObj: CatalyticConverterCode): void {
    appendCached(STORAGE_KEYS.CATALYTIC_CODES, codeObj);
    notify(STORAGE_KEYS.CATALYTIC_CODES);
  },

  getContainerDrops(): ContainerDrop[] {
    return readCached(STORAGE_KEYS.CONTAINER_DROPS, INITIAL_CONTAINER_DROPS);
  },

  saveContainerDrop(drop: ContainerDrop): ContainerDrop {
    appendCached(STORAGE_KEYS.CONTAINER_DROPS, drop);
    notify(STORAGE_KEYS.CONTAINER_DROPS);
    return drop;
  },

  getCashDrawerLogs(): CashDrawerLog[] {
    return readCached(STORAGE_KEYS.CASH_DRAWER, INITIAL_CASH_DRAWER);
  },

  addCashDrawerEntry(entry: Omit<CashDrawerLog, 'id' | 'timestamp' | 'balanceAfter'>): CashDrawerLog {
    const logs = this.getCashDrawerLogs();
    const lastLog = logs[0];
    const currentBalance = lastLog ? lastLog.balanceAfter : 0;
    const newBalance = currentBalance + entry.amount;

    const newLog: CashDrawerLog = {
      id: `cd-${Date.now()}`,
      timestamp: new Date().toISOString(),
      balanceAfter: Math.round(newBalance * 100) / 100,
      ...entry,
    };

    logs.unshift(newLog);
    patchCached(STORAGE_KEYS.CASH_DRAWER, logs);
    notify(STORAGE_KEYS.CASH_DRAWER);
    return newLog;
  },

  getYardBays(): YardBayLocation[] {
    return readCached(STORAGE_KEYS.YARD_BAYS, INITIAL_YARD_BAYS);
  },

  saveYardBays(bays: YardBayLocation[]): void {
    patchCached(STORAGE_KEYS.YARD_BAYS, bays);
    notify(STORAGE_KEYS.YARD_BAYS);
  },

  getCustomers(): Customer[] {
    return readCached(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
  },

  saveCustomer(customer: Customer): Customer {
    appendCached(STORAGE_KEYS.CUSTOMERS, customer);
    notify(STORAGE_KEYS.CUSTOMERS);
    return customer;
  },

  getTickets(): Ticket[] {
    return readCached(STORAGE_KEYS.TICKETS, INITIAL_TICKETS);
  },

  saveTicket(ticket: Ticket): Ticket {
    const tickets = this.getTickets();
    const existingIndex = tickets.findIndex((t) => t.id === ticket.id);
    const previousTicket = existingIndex >= 0 ? tickets[existingIndex] : undefined;
    if (existingIndex >= 0) {
      tickets[existingIndex] = ticket;
    } else {
      tickets.unshift(ticket);
    }
    patchCached(STORAGE_KEYS.TICKETS, tickets);
    notify(STORAGE_KEYS.TICKETS);

    const inventoryVehicle = vehicleFromTicket(ticket);
    if (inventoryVehicle) this.savePullYardVehicle(inventoryVehicle);

    const previousCashPayout = previousTicket?.status === 'COMPLETED' && previousTicket.payoutMethod === 'Cash'
      ? previousTicket.finalPayout
      : 0;
    const currentCashPayout = ticket.status === 'COMPLETED' && ticket.payoutMethod === 'Cash'
      ? ticket.finalPayout
      : 0;
    const cashPayoutChange = Math.round((currentCashPayout - previousCashPayout) * 100) / 100;
    if (cashPayoutChange !== 0) {
      this.addCashDrawerEntry({
        type: 'PAYOUT_DISBURSEMENT',
        amount: -cashPayoutChange,
        ticketId: ticket.id,
        operatorName: ticket.operatorName,
        notes: previousCashPayout === 0
          ? `Cash voucher payout for ticket #${ticket.id}`
          : `Cash voucher adjustment for ticket #${ticket.id}`,
      });
    }

    const ticketWeight = (value?: Ticket) => {
      if (!value || value.status !== 'COMPLETED') return 0;
      if (value.ticketType === 'CAR_SALVAGE' && value.carRecord) return value.carRecord.vehicleWeightLbs;
      return value.scrapLines?.reduce((sum, line) => sum + line.billableWeight, 0) ?? 0;
    };
    const previousPayout = previousTicket?.status === 'COMPLETED' ? previousTicket.finalPayout : 0;
    const currentPayout = ticket.status === 'COMPLETED' ? ticket.finalPayout : 0;
    const payoutChange = Math.round((currentPayout - previousPayout) * 100) / 100;
    const weightChange = Math.round((ticketWeight(ticket) - ticketWeight(previousTicket)) * 10) / 10;

    if (ticket.customerName && (ticket.customerId || ticket.customerPhone)) {
      const customers = this.getCustomers();
      const customer = customers.find((candidate) =>
        candidate.id === ticket.customerId ||
        candidate.fullName.toLowerCase() === ticket.customerName.toLowerCase() ||
        Boolean(ticket.customerPhone && candidate.phone === ticket.customerPhone)
      );

      if (customer) {
        customer.totalPayouts = Math.max(0, Math.round((customer.totalPayouts + payoutChange) * 100) / 100);
        customer.totalWeightLbs = Math.max(0, Math.round((customer.totalWeightLbs + weightChange) * 10) / 10);
        if (ticket.customerPhone) customer.phone = ticket.customerPhone;
        if (ticket.customerIdNumber) customer.idNumber = ticket.customerIdNumber;
        if (ticket.vehicleLicensePlate) customer.vehicleLicensePlate = ticket.vehicleLicensePlate;
        if (ticket.complianceCaptures?.idPhotoUrl) customer.idPhotoUrl = ticket.complianceCaptures.idPhotoUrl;
        if (ticket.vehicleLicensePlate && !customer.capturedPlates?.includes(ticket.vehicleLicensePlate)) {
          customer.capturedPlates = [...(customer.capturedPlates || []), ticket.vehicleLicensePlate];
        }
        this.saveCustomer(customer);
      } else if (ticket.customerPhone) {
        this.saveCustomer({
          id: `cust-${Date.now()}`,
          fullName: ticket.customerName,
          phone: ticket.customerPhone,
          idType: 'Driver License',
          idNumber: ticket.customerIdNumber || 'ON-FILE',
          idState: 'GA',
          address: 'Address On File',
          vehicleLicensePlate: ticket.vehicleLicensePlate,
          createdAt: new Date().toISOString(),
          totalPayouts: currentPayout,
          totalWeightLbs: ticketWeight(ticket),
          idPhotoUrl: ticket.complianceCaptures?.idPhotoUrl,
          capturedPlates: ticket.vehicleLicensePlate ? [ticket.vehicleLicensePlate] : [],
        });
      }
    }

    return ticket;
  },

  /**
   * Sequential scrap-only receipt numbers: 2026-30, 2026-31, 2026-32, ...
   * Only scrap metal tickets are counted, so the numbering stays reserved
   * for scrap receipts regardless of what other intake types create.
   */
  generateScrapReceiptNumber(): string {
    const year = new Date().getFullYear();
    const scrapTypes: Ticket['ticketType'][] = ['SCRAP_METAL', 'MOBILE_SCRAP'];
    let maxSequence = 29; // sequence starts at 30
    this.getTickets().forEach((ticket) => {
      if (!scrapTypes.includes(ticket.ticketType)) return;
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

  updateTicketId(oldId: string, newId: string): { success: boolean; message?: string } {
    const cleanNewId = newId.trim();
    if (!cleanNewId) {
      return { success: false, message: "Receipt / Ticket number cannot be empty" };
    }

    const tickets = this.getTickets();
    const existingTarget = tickets.find((t) => t.id === cleanNewId);
    if (existingTarget && oldId !== cleanNewId) {
      return { success: false, message: `Receipt number "${cleanNewId}" is already used by another ticket` };
    }

    const ticketIndex = tickets.findIndex((t) => t.id === oldId);
    if (ticketIndex === -1) {
      return { success: false, message: "Original ticket not found" };
    }

    tickets[ticketIndex].id = cleanNewId;
    patchCached(STORAGE_KEYS.TICKETS, tickets);
    notify(STORAGE_KEYS.TICKETS);

    const cashLogs = this.getCashDrawerLogs();
    let updatedCashLogs = false;
    cashLogs.forEach((log) => {
      if (log.ticketId === oldId) {
        log.ticketId = cleanNewId;
        log.notes = log.notes?.replace(oldId, cleanNewId);
        updatedCashLogs = true;
      }
    });
    if (updatedCashLogs) {
      patchCached(STORAGE_KEYS.CASH_DRAWER, cashLogs);
      notify(STORAGE_KEYS.CASH_DRAWER);
    }

    return { success: true };
  },

  getNMVTISLogs(): NMVTISReportLog[] {
    return readCached(STORAGE_KEYS.NMVTIS_LOGS, []);
  },

  saveNMVTISLog(log: NMVTISReportLog): void {
    appendCached(STORAGE_KEYS.NMVTIS_LOGS, log);
    notify(STORAGE_KEYS.NMVTIS_LOGS);
  },

  markTicketsAsNMVTISReported(ticketIds: string[], batchId: string): void {
    const tickets = this.getTickets();
    const now = new Date().toISOString();
    tickets.forEach((t) => {
      if (ticketIds.includes(t.id)) {
        if (!t.complianceCaptures) {
          t.complianceCaptures = {};
        }
        t.complianceCaptures.nmvtisReported = true;
        t.complianceCaptures.nmvtisReportedAt = now;
        t.complianceCaptures.nmvtisBatchId = batchId;
        if (t.carRecord) {
          if (!t.carRecord.complianceCaptures) {
            t.carRecord.complianceCaptures = {};
          }
          t.carRecord.complianceCaptures.nmvtisReported = true;
          t.carRecord.complianceCaptures.nmvtisReportedAt = now;
          t.carRecord.complianceCaptures.nmvtisBatchId = batchId;
        }
      }
    });
    patchCached(STORAGE_KEYS.TICKETS, tickets);
    notify(STORAGE_KEYS.TICKETS);
  },

  getCollection<T>(key: string): T[] {
    return readCached<T[]>(key, []);
  },

  saveCollection<T extends { id: string }>(key: string, item: T): T {
    appendCached(key, item);
    notify(key);
    return item;
  },

  getShipments(): OutboundShipment[] { return this.getCollection(STORAGE_KEYS.SHIPMENTS) as OutboundShipment[]; },
  saveShipment(shipment: OutboundShipment): OutboundShipment { return this.saveCollection(STORAGE_KEYS.SHIPMENTS, shipment) as OutboundShipment; },
  getMills(): MillShipper[] { return this.getCollection(STORAGE_KEYS.MILLS) as MillShipper[]; },
  saveMill(mill: MillShipper): MillShipper { return this.saveCollection(STORAGE_KEYS.MILLS, mill) as MillShipper; },
  getTimeClockEntries(): TimeClockEntry[] { return this.getCollection(STORAGE_KEYS.TIMECLOCK) as TimeClockEntry[]; },
  saveTimeClockEntry(entry: TimeClockEntry): TimeClockEntry { return this.saveCollection(STORAGE_KEYS.TIMECLOCK, entry) as TimeClockEntry; },
  getChecklistRuns(): ChecklistRun[] { return this.getCollection(STORAGE_KEYS.CHECKLISTS) as ChecklistRun[]; },
  saveChecklistRun(run: ChecklistRun): ChecklistRun { return this.saveCollection(STORAGE_KEYS.CHECKLISTS, run) as ChecklistRun; },
  getYardTasks(): YardTask[] { return this.getCollection(STORAGE_KEYS.TASKS) as YardTask[]; },
  saveYardTask(task: YardTask): YardTask { return this.saveCollection(STORAGE_KEYS.TASKS, task) as YardTask; },
  getEquipment(): EquipmentItem[] { return this.getCollection(STORAGE_KEYS.EQUIPMENT) as EquipmentItem[]; },
  saveEquipment(item: EquipmentItem): EquipmentItem { return this.saveCollection(STORAGE_KEYS.EQUIPMENT, item) as EquipmentItem; },
  getMaintenanceLogs(): MaintenanceLogEntry[] { return this.getCollection(STORAGE_KEYS.MAINTENANCE) as MaintenanceLogEntry[]; },
  saveMaintenanceLog(log: MaintenanceLogEntry): MaintenanceLogEntry { return this.saveCollection(STORAGE_KEYS.MAINTENANCE, log) as MaintenanceLogEntry; },
  getRateHistory(): MetalRateChangeLog[] { return this.getCollection(STORAGE_KEYS.RATE_HISTORY) as MetalRateChangeLog[]; },
  addRateHistory(entry: MetalRateChangeLog): MetalRateChangeLog { return this.saveCollection(STORAGE_KEYS.RATE_HISTORY, entry) as MetalRateChangeLog; },

  getOperationsGoals(): ShiftGoals {
    return readCached(STORAGE_KEYS.OPERATIONS_GOALS, {
      id: 'default',
      name: 'Current shift',
      ticketTarget: 25,
      inboundLbsTarget: 20000,
      vehicleTarget: 8,
      averageTurnaroundMinutesTarget: 45,
      grossMarginTarget: 2500,
      updatedAt: new Date().toISOString(),
    });
  },
  saveOperationsGoals(goals: ShiftGoals): ShiftGoals { patchCached(STORAGE_KEYS.OPERATIONS_GOALS, goals); notify(STORAGE_KEYS.OPERATIONS_GOALS); return goals; },
  getOperationsAlertRules(): AlertRule[] {
    return readCached(STORAGE_KEYS.OPERATIONS_ALERT_RULES, [
      { id: 'queue', key: 'QUEUE_BACKLOG', enabled: true, threshold: 8, escalationMinutes: 30 },
      { id: 'ticket-age', key: 'TICKET_AGE', enabled: true, threshold: 45, escalationMinutes: 30 },
      { id: 'vehicle-age', key: 'VEHICLE_AGE', enabled: true, threshold: 4320, escalationMinutes: 1440 },
      { id: 'bay-capacity', key: 'BAY_CAPACITY', enabled: true, threshold: 85, escalationMinutes: 60 },
      { id: 'compliance', key: 'COMPLIANCE_GAP', enabled: true, threshold: 1, escalationMinutes: 30 },
      { id: 'shipment', key: 'SHIPMENT_EXCEPTION', enabled: true, threshold: 1, escalationMinutes: 30 },
      { id: 'margin', key: 'MARGIN_LOW', enabled: true, threshold: 0, escalationMinutes: 120 },
    ]);
  },
  saveOperationsAlertRules(rules: AlertRule[]): AlertRule[] { patchCached(STORAGE_KEYS.OPERATIONS_ALERT_RULES, rules); notify(STORAGE_KEYS.OPERATIONS_ALERT_RULES); return rules; },
  getOperationsAlerts(): OperationsAlert[] { return this.getCollection(STORAGE_KEYS.OPERATIONS_ALERTS) as OperationsAlert[]; },
  saveOperationsAlert(alert: OperationsAlert): OperationsAlert { return this.saveCollection(STORAGE_KEYS.OPERATIONS_ALERTS, alert) as OperationsAlert; },
  getDailyManagerSummaries(): DailyManagerSummary[] { return this.getCollection(STORAGE_KEYS.OPERATIONS_SUMMARIES) as DailyManagerSummary[]; },
  saveDailyManagerSummary(summary: DailyManagerSummary): DailyManagerSummary { return this.saveCollection(STORAGE_KEYS.OPERATIONS_SUMMARIES, summary) as DailyManagerSummary; },

  getSettings(): YardSettings {
    return readCached(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
  },

  saveSettings(settings: YardSettings): void {
    patchCached(STORAGE_KEYS.SETTINGS, settings);
    notify(STORAGE_KEYS.SETTINGS);
  },

  resetPricingToDefaults(): void {
    patchCached(STORAGE_KEYS.METALS, INITIAL_METALS);
    notify(STORAGE_KEYS.METALS);
    patchCached(STORAGE_KEYS.CAR_RATES, INITIAL_CAR_RATES);
    notify(STORAGE_KEYS.CAR_RATES);
    patchCached(STORAGE_KEYS.CATALYTIC_CODES, INITIAL_CAT_CODES);
    notify(STORAGE_KEYS.CATALYTIC_CODES);
  },

  resetToDefaults(): void {
    const keys: string[] = [
      STORAGE_KEYS.METALS, STORAGE_KEYS.CAR_RATES, STORAGE_KEYS.CUSTOMERS,
      STORAGE_KEYS.TICKETS, STORAGE_KEYS.SETTINGS, STORAGE_KEYS.CATALYTIC_CODES,
      STORAGE_KEYS.CONTAINER_DROPS, STORAGE_KEYS.CASH_DRAWER, STORAGE_KEYS.YARD_BAYS,
      STORAGE_KEYS.PULL_PARTS, STORAGE_KEYS.PULL_YARD_VEHICLES,
      STORAGE_KEYS.CORE_RETURNS, STORAGE_KEYS.ADMISSION_PASSES, STORAGE_KEYS.IP_CAMERAS,
    ];
    for (const key of keys) {
      sharedStorage.removeItem(key);
      cache.delete(key);
      notify(key);
    }
    sharedStorage.removeItem(STORAGE_KEYS.NMVTIS_LOGS);
  },
};