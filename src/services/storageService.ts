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
} from "@/types/scrap";
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
};

let pullVehicleCacheSource: string | null = null;
let pullVehicleCache: PullYardVehicle[] | null = null;

const getRemovedInventoryVehicleIds = () => new Set<string>(
  JSON.parse(sharedStorage.getItem(STORAGE_KEYS.REMOVED_INVENTORY_VEHICLES) || "[]") as string[],
);

const saveRemovedInventoryVehicleIds = (ids: Set<string>) => {
  sharedStorage.setItem(STORAGE_KEYS.REMOVED_INVENTORY_VEHICLES, JSON.stringify([...ids]));
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
  customDomain: '',
};

export const INITIAL_TICKETS: Ticket[] = [];

export const storageService = {
  getIpCameras(): IpCamera[] {
    const data = sharedStorage.getItem(STORAGE_KEYS.IP_CAMERAS);
    if (!data) {
      sharedStorage.setItem(STORAGE_KEYS.IP_CAMERAS, JSON.stringify(INITIAL_IP_CAMERAS));
      return INITIAL_IP_CAMERAS;
    }
    return JSON.parse(data);
  },

  saveIpCamera(camera: IpCamera): IpCamera {
    const cameras = this.getIpCameras();
    const idx = cameras.findIndex((c) => c.id === camera.id);
    if (idx >= 0) {
      cameras[idx] = camera;
    } else {
      cameras.unshift(camera);
    }
    sharedStorage.setItem(STORAGE_KEYS.IP_CAMERAS, JSON.stringify(cameras));
    return camera;
  },

  deleteIpCamera(cameraId: string): void {
    const cameras = this.getIpCameras().filter((c) => c.id !== cameraId);
    sharedStorage.setItem(STORAGE_KEYS.IP_CAMERAS, JSON.stringify(cameras));
  },

  getMetals(): MetalGrade[] {
    const data = sharedStorage.getItem(STORAGE_KEYS.METALS);
    if (!data) {
      sharedStorage.setItem(STORAGE_KEYS.METALS, JSON.stringify(INITIAL_METALS));
      return INITIAL_METALS;
    }
    return JSON.parse(data);
  },

  saveMetals(metals: MetalGrade[]): void {
    sharedStorage.setItem(STORAGE_KEYS.METALS, JSON.stringify(metals));
  },

  getCarRates(): AutoSalvageCategoryRate[] {
    const data = sharedStorage.getItem(STORAGE_KEYS.CAR_RATES);
    if (!data) {
      sharedStorage.setItem(STORAGE_KEYS.CAR_RATES, JSON.stringify(INITIAL_CAR_RATES));
      return INITIAL_CAR_RATES;
    }
    return JSON.parse(data);
  },

  saveCarRates(rates: AutoSalvageCategoryRate[]): void {
    sharedStorage.setItem(STORAGE_KEYS.CAR_RATES, JSON.stringify(rates));
  },

  getPullParts(): PullPartItem[] {
    const data = sharedStorage.getItem(STORAGE_KEYS.PULL_PARTS);
    if (!data) {
      sharedStorage.setItem(STORAGE_KEYS.PULL_PARTS, JSON.stringify(INITIAL_PULL_PARTS));
      return INITIAL_PULL_PARTS;
    }
    return JSON.parse(data);
  },

  savePullParts(parts: PullPartItem[]): void {
    sharedStorage.setItem(STORAGE_KEYS.PULL_PARTS, JSON.stringify(parts));
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

  getInventoryVehicles(): PullYardVehicle[] {
    const vehicles = this.getPullYardVehicles();
    const removedIds = getRemovedInventoryVehicleIds();
    const linkedTicketIds = new Set(vehicles.map((vehicle) => vehicle.sourceTicketId).filter(Boolean));
    const knownVins = new Set(vehicles.map((vehicle) => vehicle.vin.toUpperCase()));
    const recovered = this.getTickets()
      .map(vehicleFromTicket)
      .filter((vehicle): vehicle is PullYardVehicle => Boolean(
        vehicle
        && !removedIds.has(vehicle.id)
        && !linkedTicketIds.has(vehicle.sourceTicketId)
        && !knownVins.has(vehicle.vin.toUpperCase()),
      ));
    return [...recovered, ...vehicles]
      .filter((vehicle) => !removedIds.has(vehicle.id))
      .sort((a, b) => new Date(b.dateSetInYard).getTime() - new Date(a.dateSetInYard).getTime());
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
    return veh;
  },

  deletePullYardVehicle(vehicleId: string): void {
    const inventoryVehicle = this.getInventoryVehicles().find((vehicle) => vehicle.id === vehicleId);
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
  },

  getCoreReturns(): CoreReturnLog[] {
    const data = sharedStorage.getItem(STORAGE_KEYS.CORE_RETURNS);
    if (!data) {
      sharedStorage.setItem(STORAGE_KEYS.CORE_RETURNS, JSON.stringify(INITIAL_CORE_RETURNS));
      return INITIAL_CORE_RETURNS;
    }
    return JSON.parse(data);
  },

  saveCoreReturn(log: CoreReturnLog): CoreReturnLog {
    const logs = this.getCoreReturns();
    logs.unshift(log);
    sharedStorage.setItem(STORAGE_KEYS.CORE_RETURNS, JSON.stringify(logs));

    this.addCashDrawerEntry({
      type: 'PAYOUT_DISBURSEMENT',
      amount: -Math.abs(log.coreDepositRefunded),
      operatorName: log.operatorName,
      notes: `Core deposit refund for ${log.partName} - ${log.customerName}`,
    });

    return log;
  },

  getAdmissionPasses(): AdmissionPass[] {
    const data = sharedStorage.getItem(STORAGE_KEYS.ADMISSION_PASSES);
    if (!data) {
      sharedStorage.setItem(STORAGE_KEYS.ADMISSION_PASSES, JSON.stringify(INITIAL_ADMISSION_PASSES));
      return INITIAL_ADMISSION_PASSES;
    }
    return JSON.parse(data);
  },

  saveAdmissionPass(pass: AdmissionPass): AdmissionPass {
    const passes = this.getAdmissionPasses();
    passes.unshift(pass);
    sharedStorage.setItem(STORAGE_KEYS.ADMISSION_PASSES, JSON.stringify(passes));

    this.addCashDrawerEntry({
      type: 'VAULT_REPLENISHMENT',
      amount: Math.abs(pass.feePaid),
      operatorName: pass.operatorName,
      notes: `$${pass.feePaid.toFixed(2)} Yard Gate Admission Fee Pass - ${pass.customerName}`,
    });

    return pass;
  },

  getCatCodes(): CatalyticConverterCode[] {
    const data = sharedStorage.getItem(STORAGE_KEYS.CATALYTIC_CODES);
    if (!data) {
      sharedStorage.setItem(STORAGE_KEYS.CATALYTIC_CODES, JSON.stringify(INITIAL_CAT_CODES));
      return INITIAL_CAT_CODES;
    }
    return JSON.parse(data);
  },

  saveCatCode(codeObj: CatalyticConverterCode): void {
    const codes = this.getCatCodes();
    const existingIndex = codes.findIndex((c) => c.id === codeObj.id);
    if (existingIndex >= 0) {
      codes[existingIndex] = codeObj;
    } else {
      codes.unshift(codeObj);
    }
    sharedStorage.setItem(STORAGE_KEYS.CATALYTIC_CODES, JSON.stringify(codes));
  },

  getContainerDrops(): ContainerDrop[] {
    const data = sharedStorage.getItem(STORAGE_KEYS.CONTAINER_DROPS);
    if (!data) {
      sharedStorage.setItem(STORAGE_KEYS.CONTAINER_DROPS, JSON.stringify(INITIAL_CONTAINER_DROPS));
      return INITIAL_CONTAINER_DROPS;
    }
    return JSON.parse(data);
  },

  saveContainerDrop(drop: ContainerDrop): ContainerDrop {
    const drops = this.getContainerDrops();
    const idx = drops.findIndex((d) => d.id === drop.id);
    if (idx >= 0) {
      drops[idx] = drop;
    } else {
      drops.unshift(drop);
    }
    sharedStorage.setItem(STORAGE_KEYS.CONTAINER_DROPS, JSON.stringify(drops));
    return drop;
  },

  getCashDrawerLogs(): CashDrawerLog[] {
    const data = sharedStorage.getItem(STORAGE_KEYS.CASH_DRAWER);
    if (!data) {
      sharedStorage.setItem(STORAGE_KEYS.CASH_DRAWER, JSON.stringify(INITIAL_CASH_DRAWER));
      return INITIAL_CASH_DRAWER;
    }
    return JSON.parse(data);
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
    sharedStorage.setItem(STORAGE_KEYS.CASH_DRAWER, JSON.stringify(logs));
    return newLog;
  },

  getYardBays(): YardBayLocation[] {
    const data = sharedStorage.getItem(STORAGE_KEYS.YARD_BAYS);
    if (!data) {
      sharedStorage.setItem(STORAGE_KEYS.YARD_BAYS, JSON.stringify(INITIAL_YARD_BAYS));
      return INITIAL_YARD_BAYS;
    }
    return JSON.parse(data);
  },

  saveYardBays(bays: YardBayLocation[]): void {
    sharedStorage.setItem(STORAGE_KEYS.YARD_BAYS, JSON.stringify(bays));
  },

  getCustomers(): Customer[] {
    const data = sharedStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (!data) {
      sharedStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(INITIAL_CUSTOMERS));
      return INITIAL_CUSTOMERS;
    }
    return JSON.parse(data);
  },

  saveCustomer(customer: Customer): Customer {
    const customers = this.getCustomers();
    const existingIndex = customers.findIndex((c) => c.id === customer.id);
    if (existingIndex >= 0) {
      customers[existingIndex] = customer;
    } else {
      customers.unshift(customer);
    }
    sharedStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
    return customer;
  },

  getTickets(): Ticket[] {
    const data = sharedStorage.getItem(STORAGE_KEYS.TICKETS);
    if (!data) {
      sharedStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(INITIAL_TICKETS));
      return INITIAL_TICKETS;
    }
    return JSON.parse(data);
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
    sharedStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));

    const inventoryVehicle = vehicleFromTicket(ticket);
    if (inventoryVehicle) {
      try {
        this.savePullYardVehicle(inventoryVehicle);
      } catch {
        // Vehicle recovery will still happen via getInventoryVehicles() which reads tickets
      }
    }

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
    sharedStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));

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
      sharedStorage.setItem(STORAGE_KEYS.CASH_DRAWER, JSON.stringify(cashLogs));
    }

    return { success: true };
  },

  getNMVTISLogs(): NMVTISReportLog[] {
    const data = sharedStorage.getItem(STORAGE_KEYS.NMVTIS_LOGS);
    if (!data) {
      sharedStorage.setItem(STORAGE_KEYS.NMVTIS_LOGS, "[]");
      return [];
    }
    return JSON.parse(data);
  },

  saveNMVTISLog(log: NMVTISReportLog): void {
    const logs = this.getNMVTISLogs();
    logs.unshift(log);
    sharedStorage.setItem(STORAGE_KEYS.NMVTIS_LOGS, JSON.stringify(logs));
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
    sharedStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));
  },

  getSettings(): YardSettings {
    const data = sharedStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) {
      sharedStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(INITIAL_SETTINGS));
      return INITIAL_SETTINGS;
    }
    return JSON.parse(data);
  },

  saveSettings(settings: YardSettings): void {
    sharedStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  resetPricingToDefaults(): void {
    sharedStorage.setItem(STORAGE_KEYS.METALS, JSON.stringify(INITIAL_METALS));
    sharedStorage.setItem(STORAGE_KEYS.CAR_RATES, JSON.stringify(INITIAL_CAR_RATES));
    sharedStorage.setItem(STORAGE_KEYS.CATALYTIC_CODES, JSON.stringify(INITIAL_CAT_CODES));
  },

  resetToDefaults(): void {
    sharedStorage.setItem(STORAGE_KEYS.METALS, JSON.stringify(INITIAL_METALS));
    sharedStorage.setItem(STORAGE_KEYS.CAR_RATES, JSON.stringify(INITIAL_CAR_RATES));
    sharedStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(INITIAL_CUSTOMERS));
    sharedStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(INITIAL_TICKETS));
    sharedStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(INITIAL_SETTINGS));
    sharedStorage.setItem(STORAGE_KEYS.CATALYTIC_CODES, JSON.stringify(INITIAL_CAT_CODES));
    sharedStorage.setItem(STORAGE_KEYS.CONTAINER_DROPS, JSON.stringify(INITIAL_CONTAINER_DROPS));
    sharedStorage.setItem(STORAGE_KEYS.CASH_DRAWER, JSON.stringify(INITIAL_CASH_DRAWER));
    sharedStorage.setItem(STORAGE_KEYS.YARD_BAYS, JSON.stringify(INITIAL_YARD_BAYS));
    sharedStorage.setItem(STORAGE_KEYS.PULL_PARTS, JSON.stringify(INITIAL_PULL_PARTS));
    sharedStorage.setItem(STORAGE_KEYS.PULL_YARD_VEHICLES, JSON.stringify(INITIAL_PULL_VEHICLES));
    sharedStorage.setItem(STORAGE_KEYS.CORE_RETURNS, JSON.stringify(INITIAL_CORE_RETURNS));
    sharedStorage.setItem(STORAGE_KEYS.ADMISSION_PASSES, JSON.stringify(INITIAL_ADMISSION_PASSES));
    sharedStorage.setItem(STORAGE_KEYS.IP_CAMERAS, JSON.stringify(INITIAL_IP_CAMERAS));
    sharedStorage.removeItem(STORAGE_KEYS.NMVTIS_LOGS);
  },
};