import { Customer, MetalGrade, AutoSalvageCategoryRate, Ticket, YardSettings, ComplianceCaptures, NMVTISReportLog } from "@/types/scrap";
import { generateSamplePhoto, generateSampleThumbprint } from "@/utils/complianceUtils";

const STORAGE_KEYS = {
  METALS: 'scrapflow_metals',
  CAR_RATES: 'scrapflow_car_rates',
  CUSTOMERS: 'scrapflow_customers',
  TICKETS: 'scrapflow_tickets',
  SETTINGS: 'scrapflow_settings',
  NMVTIS_LOGS: 'scrapflow_nmvtis_logs',
};

// Seed Metals Data
export const INITIAL_METALS: MetalGrade[] = [
  {
    id: 'm1',
    category: 'Non-Ferrous',
    name: '#1 Bare Bright Copper Wire',
    code: 'COP-BB',
    ratePerLb: 3.85,
    description: 'Clean, unalloyed, uncoated copper wire not smaller than 16 gauge.',
    isPopular: true,
  },
  {
    id: 'm2',
    category: 'Non-Ferrous',
    name: '#1 Copper Tubing & Pipe',
    code: 'COP-1',
    ratePerLb: 3.65,
    description: 'Clean copper pipe free of solder, brass fittings, or paint.',
    isPopular: true,
  },
  {
    id: 'm3',
    category: 'Non-Ferrous',
    name: '#2 Copper Wire & Pipe',
    code: 'COP-2',
    ratePerLb: 3.35,
    description: 'Lightly oxidized or burnt copper wire, soldered copper pipe.',
    isPopular: true,
  },
  {
    id: 'm4',
    category: 'Non-Ferrous',
    name: 'Yellow Brass / Plumbers Brass',
    code: 'BRS-YEL',
    ratePerLb: 2.30,
    description: 'Clean yellow brass castings, valves, tubing, plumbing fixtures.',
    isPopular: true,
  },
  {
    id: 'm5',
    category: 'Non-Ferrous',
    name: 'Clean Sheet Aluminum',
    code: 'ALM-SHT',
    ratePerLb: 0.65,
    description: 'Clean sheet aluminum, gutters, siding, pots, pans.',
    isPopular: true,
  },
  {
    id: 'm6',
    category: 'Non-Ferrous',
    name: 'Aluminum Cans (UBC)',
    code: 'ALM-CAN',
    ratePerLb: 0.72,
    description: 'Used aluminum beverage cans, flattened or whole.',
    isPopular: true,
  },
  {
    id: 'm7',
    category: 'Non-Ferrous',
    name: 'Cast Aluminum',
    code: 'ALM-CST',
    ratePerLb: 0.58,
    description: 'Engine blocks, lawnmower decks, transmission housings.',
  },
  {
    id: 'm8',
    category: 'Ferrous',
    name: 'Prepared Heavy Melting Steel (HMS #1)',
    code: 'STEEL-HMS1',
    ratePerLb: 0.12,
    description: 'Cut structural steel, plate, heavy iron over 1/4 inch thick under 5ft.',
    isPopular: true,
  },
  {
    id: 'm9',
    category: 'Ferrous',
    name: 'Light Iron / Shred Scrap',
    code: 'STEEL-SHRED',
    ratePerLb: 0.09,
    description: 'Appliances, tin, thin sheet iron, wire fencing.',
    isPopular: true,
  },
  {
    id: 'm10',
    category: 'Batteries & Auto',
    name: 'Lead-Acid Auto Batteries',
    code: 'BAT-AUTO',
    ratePerLb: 0.28,
    description: 'Intact automotive, truck, marine lead-acid wet batteries.',
    isPopular: true,
  },
  {
    id: 'm11',
    category: 'Non-Ferrous',
    name: 'Stainless Steel 304',
    code: 'SS-304',
    ratePerLb: 0.52,
    description: 'Non-magnetic stainless sinks, food service equipment.',
  },
  {
    id: 'm12',
    category: 'E-Waste',
    name: 'Computer Motherboards / Circuit Boards',
    code: 'E-BOARD',
    ratePerLb: 1.80,
    description: 'High-grade telecom or motherboard circuit boards.',
  },
];

// Seed Car Rates
export const INITIAL_CAR_RATES: AutoSalvageCategoryRate[] = [
  {
    id: 'car1',
    categoryName: 'Complete Passenger Sedan / Coupe',
    description: 'Whole automobile with intact motor, transmission, battery, and catalytic converter.',
    ratePerTon: 220,
    flatBonusWithCat: 80,
    flatBonusWithEngine: 50,
    flatBonusWithBattery: 15,
  },
  {
    id: 'car2',
    categoryName: 'Pickup Truck / Full-Size SUV',
    description: 'Full frame light duty truck or large SUV.',
    ratePerTon: 240,
    flatBonusWithCat: 110,
    flatBonusWithEngine: 60,
    flatBonusWithBattery: 15,
  },
  {
    id: 'car3',
    categoryName: 'Stripped Shell (No Engine / No Cat)',
    description: 'Incomplete body or shell missing major driveline components.',
    ratePerTon: 140,
    flatBonusWithCat: 0,
    flatBonusWithEngine: 0,
    flatBonusWithBattery: 0,
  },
  {
    id: 'car4',
    categoryName: 'Heavy Commercial / Farm Equipment',
    description: 'Heavy duty commercial chassis, box truck, tractor.',
    ratePerTon: 260,
    flatBonusWithCat: 120,
    flatBonusWithEngine: 100,
    flatBonusWithBattery: 30,
  },
];

// Seed Customers
export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-101',
    fullName: 'Robert Henderson',
    phone: '(555) 382-9102',
    idType: 'Driver License',
    idNumber: 'DL-9823145-GA',
    idState: 'GA',
    address: '1428 Industrial Pkwy, Atlanta, GA',
    vehicleLicensePlate: '7ABC89',
    vehicleState: 'GA',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    totalPayouts: 1450.80,
    totalWeightLbs: 3820,
    idPhotoUrl: generateSamplePhoto('id'),
    thumbprintData: generateSampleThumbprint(),
    capturedPlates: ['7ABC89'],
  },
  {
    id: 'cust-102',
    fullName: 'Marcus Vance (Vance Towing)',
    phone: '(555) 712-4091',
    idType: 'Driver License',
    idNumber: 'DL-4481029-GA',
    idState: 'GA',
    address: '802 Scrap Yard Rd, Marietta, GA',
    vehicleLicensePlate: 'TOW-912',
    vehicleState: 'GA',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
    totalPayouts: 8940.00,
    totalWeightLbs: 34200,
    idPhotoUrl: generateSamplePhoto('id'),
    thumbprintData: generateSampleThumbprint(),
    capturedPlates: ['TOW-912'],
  },
  {
    id: 'cust-103',
    fullName: 'Sarah Jenkins',
    phone: '(555) 201-9988',
    idType: 'State ID',
    idNumber: 'ID-881920-GA',
    idState: 'GA',
    address: '55 Oakland Ave, Decatur, GA',
    vehicleLicensePlate: 'BKN-402',
    vehicleState: 'GA',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    totalPayouts: 340.25,
    totalWeightLbs: 890,
    idPhotoUrl: generateSamplePhoto('id'),
    thumbprintData: generateSampleThumbprint(),
    capturedPlates: ['BKN-402'],
  },
];

// Seed Yard Settings
export const INITIAL_SETTINGS: YardSettings = {
  yardName: 'Apex Metal & Auto Recyclers',
  address: '400 Recycling Way, Suite A',
  cityStateZip: 'Atlanta, GA 30318',
  phone: '(404) 555-SCRAP',
  email: 'intake@apexrecycling.local',
  licenseNumber: 'SCRAP-GA-2025-901A',
  nmvtisReportingId: 'NMVTIS-ENTITY-881902',
  receiptHeader: 'THANK YOU FOR RECYCLING WITH APEX! STATE COMPLIANCE ID VERIFIED.',
  receiptFooter: 'All scrap transactions final. Photo ID & Thumbprint on record. NMVTIS Auto Salvage Verified.',
  defaultWeightUnit: 'LBS',
  serialBaudRate: 9600,
  webSocketUrl: 'ws://localhost:8080/scale',
  operatorName: 'Scale Tech Station 1',
};

// Seed Sample Compliance Captures
const sampleCarCaptures: ComplianceCaptures = {
  personPhotoUrl: generateSamplePhoto('person'),
  idPhotoUrl: generateSamplePhoto('id'),
  vehiclePhotoUrl: generateSamplePhoto('vehicle'),
  licensePlatePhotoUrl: generateSamplePhoto('plate'),
  loadPhotoUrl: generateSamplePhoto('load'),
  thumbprintCaptured: true,
  thumbprintDataUrl: generateSampleThumbprint(),
  nmvtisReported: false,
};

const sampleScrapCaptures: ComplianceCaptures = {
  personPhotoUrl: generateSamplePhoto('person'),
  idPhotoUrl: generateSamplePhoto('id'),
  vehiclePhotoUrl: generateSamplePhoto('vehicle'),
  licensePlatePhotoUrl: generateSamplePhoto('plate'),
  loadPhotoUrl: generateSamplePhoto('load'),
  thumbprintCaptured: true,
  thumbprintDataUrl: generateSampleThumbprint(),
};

// Seed Sample Tickets
export const INITIAL_TICKETS: Ticket[] = [
  {
    id: 'T-2025-1001',
    ticketType: 'CAR_SALVAGE',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    status: 'COMPLETED',
    customerId: 'cust-102',
    customerName: 'Marcus Vance (Vance Towing)',
    customerIdNumber: 'DL-4481029-GA',
    vehicleLicensePlate: 'TOW-912',
    carRecord: {
      vin: '1G1JC524317109281',
      year: 2008,
      make: 'Chevrolet',
      model: 'Impala LT',
      color: 'Silver',
      mileage: 184500,
      titleStatus: 'Salvage Title',
      titleNumber: 'GA-TL-99120',
      hasCatalyticConverter: true,
      catCondition: 'Original OEM',
      hasEngineAndTrans: true,
      hasBattery: true,
      hasAluminumRims: true,
      fluidsDrained: true,
      pricingMode: 'TONNAGE',
      vehicleWeightLbs: 3550,
      ratePerTon: 220,
      flatRate: 0,
      catBonus: 80,
      engineBonus: 50,
      batteryBonus: 15,
      deductions: 0,
      totalPayout: 535.50,
      complianceCaptures: sampleCarCaptures,
    },
    complianceCaptures: sampleCarCaptures,
    grossTotal: 535.50,
    totalDeductions: 0,
    finalPayout: 535.50,
    payoutMethod: 'Cash',
    operatorName: 'Scale Tech Station 1',
    notes: 'Clean title provided with tow voucher. NMVTIS inspection clear.',
  },
  {
    id: 'T-2025-1002',
    ticketType: 'SCRAP_METAL',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    status: 'COMPLETED',
    customerId: 'cust-101',
    customerName: 'Robert Henderson',
    customerIdNumber: 'DL-9823145-GA',
    vehicleLicensePlate: '7ABC89',
    complianceCaptures: sampleScrapCaptures,
    scrapLines: [
      {
        id: 'line-1',
        metalGradeId: 'm1',
        metalName: '#1 Bare Bright Copper Wire',
        metalCategory: 'Non-Ferrous',
        grossWeight: 142,
        tareWeight: 12,
        netWeight: 130,
        deductionPercent: 0,
        deductionLbs: 0,
        billableWeight: 130,
        ratePerLb: 3.85,
        lineTotal: 500.50,
      },
      {
        id: 'line-2',
        metalGradeId: 'm4',
        metalName: 'Yellow Brass / Plumbers Brass',
        metalCategory: 'Non-Ferrous',
        grossWeight: 88,
        tareWeight: 10,
        netWeight: 78,
        deductionPercent: 5,
        deductionLbs: 3.9,
        billableWeight: 74.1,
        ratePerLb: 2.30,
        lineTotal: 170.43,
      },
    ],
    grossTotal: 670.93,
    totalDeductions: 0,
    finalPayout: 670.93,
    payoutMethod: 'Cash',
    operatorName: 'Scale Tech Station 1',
  },
  {
    id: 'T-2025-1003',
    ticketType: 'CAR_SALVAGE',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    status: 'COMPLETED',
    customerId: 'cust-103',
    customerName: 'Sarah Jenkins',
    customerIdNumber: 'ID-881920-GA',
    vehicleLicensePlate: 'BKN-402',
    carRecord: {
      vin: '1N4AL21E38C209182',
      year: 2008,
      make: 'Nissan',
      model: 'Altima 2.5S',
      color: 'Black',
      mileage: 210000,
      titleStatus: 'Missing Title (Affidavit)',
      titleNumber: 'AFF-2025-091',
      hasCatalyticConverter: false,
      catCondition: 'Missing / Removed',
      hasEngineAndTrans: true,
      hasBattery: true,
      hasAluminumRims: false,
      fluidsDrained: true,
      pricingMode: 'TONNAGE',
      vehicleWeightLbs: 3100,
      ratePerTon: 220,
      flatRate: 0,
      catBonus: 0,
      engineBonus: 50,
      batteryBonus: 15,
      deductions: 0,
      totalPayout: 406.00,
      complianceCaptures: {
        ...sampleCarCaptures,
        nmvtisReported: false,
      },
    },
    complianceCaptures: {
      ...sampleCarCaptures,
      nmvtisReported: false,
    },
    grossTotal: 406.00,
    totalDeductions: 0,
    finalPayout: 406.00,
    payoutMethod: 'Check',
    checkNumber: 'CHK-9021',
    operatorName: 'Scale Tech Station 1',
    notes: 'Missing title state affidavit filed on record.',
  }
];

export const storageService = {
  getMetals(): MetalGrade[] {
    const data = localStorage.getItem(STORAGE_KEYS.METALS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.METALS, JSON.stringify(INITIAL_METALS));
      return INITIAL_METALS;
    }
    return JSON.parse(data);
  },

  saveMetals(metals: MetalGrade[]): void {
    localStorage.setItem(STORAGE_KEYS.METALS, JSON.stringify(metals));
  },

  getCarRates(): AutoSalvageCategoryRate[] {
    const data = localStorage.getItem(STORAGE_KEYS.CAR_RATES);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.CAR_RATES, JSON.stringify(INITIAL_CAR_RATES));
      return INITIAL_CAR_RATES;
    }
    return JSON.parse(data);
  },

  saveCarRates(rates: AutoSalvageCategoryRate[]): void {
    localStorage.setItem(STORAGE_KEYS.CAR_RATES, JSON.stringify(rates));
  },

  getCustomers(): Customer[] {
    const data = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(INITIAL_CUSTOMERS));
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
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
    return customer;
  },

  getTickets(): Ticket[] {
    const data = localStorage.getItem(STORAGE_KEYS.TICKETS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(INITIAL_TICKETS));
      return INITIAL_TICKETS;
    }
    return JSON.parse(data);
  },

  saveTicket(ticket: Ticket): Ticket {
    const tickets = this.getTickets();
    const existingIndex = tickets.findIndex((t) => t.id === ticket.id);
    if (existingIndex >= 0) {
      tickets[existingIndex] = ticket;
    } else {
      tickets.unshift(ticket);
    }
    localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));

    // Update customer stats if customerId matches
    if (ticket.customerId) {
      const customers = this.getCustomers();
      const cust = customers.find((c) => c.id === ticket.customerId);
      if (cust) {
        cust.totalPayouts += ticket.finalPayout;
        let totalLbs = 0;
        if (ticket.ticketType === 'CAR_SALVAGE' && ticket.carRecord) {
          totalLbs = ticket.carRecord.vehicleWeightLbs;
        } else if (ticket.scrapLines) {
          totalLbs = ticket.scrapLines.reduce((acc, l) => acc + l.billableWeight, 0);
        }
        cust.totalWeightLbs += totalLbs;
        if (ticket.complianceCaptures?.idPhotoUrl) {
          cust.idPhotoUrl = ticket.complianceCaptures.idPhotoUrl;
        }
        if (ticket.complianceCaptures?.thumbprintDataUrl) {
          cust.thumbprintData = ticket.complianceCaptures.thumbprintDataUrl;
        }
        if (ticket.vehicleLicensePlate && (!cust.capturedPlates || !cust.capturedPlates.includes(ticket.vehicleLicensePlate))) {
          cust.capturedPlates = [...(cust.capturedPlates || []), ticket.vehicleLicensePlate];
        }
        this.saveCustomer(cust);
      }
    }

    return ticket;
  },

  getNMVTISLogs(): NMVTISReportLog[] {
    const data = localStorage.getItem(STORAGE_KEYS.NMVTIS_LOGS);
    if (!data) {
      return [
        {
          id: 'log-101',
          batchId: 'NMVTIS-BATCH-20250104-01',
          exportedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
          ticketCount: 1,
          ticketIds: ['T-2025-1001'],
          status: 'EXPORTED',
          exportedBy: 'Scale Tech Station 1',
        }
      ];
    }
    return JSON.parse(data);
  },

  saveNMVTISLog(log: NMVTISReportLog): void {
    const logs = this.getNMVTISLogs();
    logs.unshift(log);
    localStorage.setItem(STORAGE_KEYS.NMVTIS_LOGS, JSON.stringify(logs));
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
    localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));
  },

  getSettings(): YardSettings {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(INITIAL_SETTINGS));
      return INITIAL_SETTINGS;
    }
    return JSON.parse(data);
  },

  saveSettings(settings: YardSettings): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  resetToDefaults(): void {
    localStorage.setItem(STORAGE_KEYS.METALS, JSON.stringify(INITIAL_METALS));
    localStorage.setItem(STORAGE_KEYS.CAR_RATES, JSON.stringify(INITIAL_CAR_RATES));
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(INITIAL_CUSTOMERS));
    localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(INITIAL_TICKETS));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(INITIAL_SETTINGS));
    localStorage.removeItem(STORAGE_KEYS.NMVTIS_LOGS);
  },
};
