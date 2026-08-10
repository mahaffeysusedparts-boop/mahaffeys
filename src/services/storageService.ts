import {
  Customer,
  MetalGrade,
  AutoSalvageCategoryRate,
  Ticket,
  YardSettings,
  ComplianceCaptures,
  NMVTISReportLog,
  CatalyticConverterCode,
  ContainerDrop,
  CashDrawerLog,
  YardBayLocation,
} from "@/types/scrap";
import { generateSamplePhoto, generateSampleThumbprint } from "@/utils/complianceUtils";

const STORAGE_KEYS = {
  METALS: 'scrapflow_metals',
  CAR_RATES: 'scrapflow_car_rates',
  CUSTOMERS: 'scrapflow_customers',
  TICKETS: 'scrapflow_tickets',
  SETTINGS: 'scrapflow_settings',
  NMVTIS_LOGS: 'scrapflow_nmvtis_logs',
  CATALYTIC_CODES: 'scrapflow_cat_codes',
  CONTAINER_DROPS: 'scrapflow_container_drops',
  CASH_DRAWER: 'scrapflow_cash_drawer',
  YARD_BAYS: 'scrapflow_yard_bays',
};

// Seed Catalytic Converter Codes
export const INITIAL_CAT_CODES: CatalyticConverterCode[] = [
  {
    id: 'cat-101',
    code: '4R31-5E212-AA',
    make: 'Ford / Lincoln',
    category: 'Domestic Large',
    ptGrams: 2.8,
    pdGrams: 1.9,
    rhGrams: 0.35,
    avgMarketValue: 185.00,
    notes: 'Common on 2004-2010 Ford F-150 / Expedition 5.4L V8',
  },
  {
    id: 'cat-102',
    code: 'GM-12564299',
    make: 'General Motors',
    category: 'Domestic Large',
    ptGrams: 3.1,
    pdGrams: 2.2,
    rhGrams: 0.42,
    avgMarketValue: 210.00,
    notes: 'Chevrolet Silverado / Tahoe 5.3L V8 catalytic manifold',
  },
  {
    id: 'cat-103',
    code: 'TOYOTA-GD3',
    make: 'Toyota / Lexus',
    category: 'Foreign Small',
    ptGrams: 4.2,
    pdGrams: 3.8,
    rhGrams: 0.65,
    avgMarketValue: 340.00,
    notes: 'High precious metal yield on Prius & Camry hybrids',
  },
  {
    id: 'cat-104',
    code: 'HONDA-251',
    make: 'Honda / Acura',
    category: 'Foreign Small',
    ptGrams: 2.4,
    pdGrams: 2.1,
    rhGrams: 0.38,
    avgMarketValue: 165.00,
    notes: 'Honda Civic & Accord 2.4L i-VTEC OEM manifold converter',
  },
  {
    id: 'cat-105',
    code: 'DPF-CUMMINS-67',
    make: 'Dodge / RAM / Cummins',
    category: 'Diesel DPF Filter',
    ptGrams: 6.8,
    pdGrams: 0.5,
    rhGrams: 0.1,
    avgMarketValue: 420.00,
    notes: 'Heavy duty diesel particulate filter assembly',
  },
  {
    id: 'cat-106',
    code: 'UNIVERSAL-AFTERMARKET',
    make: 'Generic Aftermarket',
    category: 'Aftermarket',
    ptGrams: 0.5,
    pdGrams: 0.3,
    rhGrams: 0.05,
    avgMarketValue: 35.00,
    notes: 'Low loading aftermarket replacement converter shell',
  },
];

// Seed Container Drops
export const INITIAL_CONTAINER_DROPS: ContainerDrop[] = [
  {
    id: 'drop-1001',
    containerNumber: 'BOX-20-104',
    clientName: 'Apex Precision CNC Machine Shop',
    clientAddress: '1900 Manufacturing Pkwy, Atlanta, GA',
    clientPhone: '(404) 555-1029',
    dropDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    pickupDueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
    status: 'PICKUP_REQUESTED',
    binType: '20-Yard Roll-Off',
    assignedDriver: 'Driver #2 (Dave Miller)',
    materialCategory: 'Aluminum Turnings & Stainless Chips',
    estimatedWeightLbs: 8400,
    notes: 'Client reported bin is 90% full of clean 6061 aluminum chips.',
  },
  {
    id: 'drop-1002',
    containerNumber: 'BOX-40-209',
    clientName: 'Tri-City Demolition & Salvage',
    clientAddress: '88 Construction Hwy, Marietta, GA',
    clientPhone: '(770) 555-9981',
    dropDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    pickupDueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 1).toISOString(),
    status: 'ON_SITE',
    binType: '40-Yard High-Side',
    assignedDriver: 'Driver #1 (Sam Taylor)',
    materialCategory: 'Heavy Structural Steel (HMS #1)',
    estimatedWeightLbs: 22500,
    notes: 'Commercial I-beam cut-offs from warehouse strip-out.',
  },
  {
    id: 'drop-1003',
    containerNumber: 'LUGGER-04',
    clientName: 'Atlanta Auto Stamping Plant',
    clientAddress: '400 Industrial Blvd, Decatur, GA',
    clientPhone: '(404) 555-3300',
    dropDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    pickupDueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    status: 'ON_SITE',
    binType: 'Lugger Scrap Box',
    assignedDriver: 'Driver #3 (Alex Vance)',
    materialCategory: '#1 Busheling & New Bare Sheet Stamping Clips',
    estimatedWeightLbs: 14000,
    notes: 'High priority prime steel scrap drop.',
  },
];

// Seed Cash Drawer Logs
export const INITIAL_CASH_DRAWER: CashDrawerLog[] = [
  {
    id: 'cd-101',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    type: 'OPENING_FLOAT',
    amount: 5000.00,
    operatorName: 'Scale Tech Station 1',
    balanceAfter: 5000.00,
    notes: 'Morning shift opening cash drawer float verified by supervisor.',
  },
  {
    id: 'cd-102',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    type: 'PAYOUT_DISBURSEMENT',
    amount: -535.50,
    ticketId: 'T-2025-1001',
    operatorName: 'Scale Tech Station 1',
    balanceAfter: 4464.50,
    notes: 'Cash voucher payout for Car Salvage Ticket #T-2025-1001.',
  },
  {
    id: 'cd-103',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    type: 'PAYOUT_DISBURSEMENT',
    amount: -670.93,
    ticketId: 'T-2025-1002',
    operatorName: 'Scale Tech Station 1',
    balanceAfter: 3793.57,
    notes: 'Cash voucher payout for Scrap Metal Ticket #T-2025-1002.',
  },
  {
    id: 'cd-104',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(),
    type: 'VAULT_REPLENISHMENT',
    amount: 3000.00,
    operatorName: 'Yard Supervisor',
    balanceAfter: 6793.57,
    notes: 'Armored vault cash replenishment addition.',
  },
];

// Seed Yard Storage Bays
export const INITIAL_YARD_BAYS: YardBayLocation[] = [
  {
    id: 'bay-1',
    bayName: 'HMS Heavy Steel Pile #1',
    categoryType: 'FERROUS_PILE',
    capacityLbs: 100000,
    currentLbs: 64200,
    estValueUsd: 7704.00,
    status: 'NORMAL',
    gridArea: 'Grid A1-A3',
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'bay-2',
    bayName: '#1 Bare Bright Copper Safe Bin',
    categoryType: 'PRECIOUS_VAULT',
    capacityLbs: 15000,
    currentLbs: 12800,
    estValueUsd: 49280.00,
    status: 'NEAR_CAPACITY',
    gridArea: 'Vault Room B',
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'bay-3',
    bayName: 'Clean Aluminum Siding & UBC Shred',
    categoryType: 'NON_FERROUS_BIN',
    capacityLbs: 40000,
    currentLbs: 21500,
    estValueUsd: 13975.00,
    status: 'NORMAL',
    gridArea: 'Grid C2',
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'bay-4',
    bayName: 'Junk Car Staging & Pull Grid A',
    categoryType: 'CAR_GRID',
    capacityLbs: 120000,
    currentLbs: 114000,
    estValueUsd: 12540.00,
    status: 'CRITICAL_FULL',
    gridArea: 'South Yard Grid A',
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'bay-5',
    bayName: 'Catalytic Converter High-Security Safe',
    categoryType: 'PRECIOUS_VAULT',
    capacityLbs: 5000,
    currentLbs: 1450,
    estValueUsd: 38200.00,
    status: 'NORMAL',
    gridArea: 'Locked Vault 1',
    lastUpdated: new Date().toISOString(),
  },
];

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
  cashDrawerFloatLimit: 10000,
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
      catCodeSerial: '4R31-5E212-AA',
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

  getCatCodes(): CatalyticConverterCode[] {
    const data = localStorage.getItem(STORAGE_KEYS.CATALYTIC_CODES);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.CATALYTIC_CODES, JSON.stringify(INITIAL_CAT_CODES));
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
    localStorage.setItem(STORAGE_KEYS.CATALYTIC_CODES, JSON.stringify(codes));
  },

  getContainerDrops(): ContainerDrop[] {
    const data = localStorage.getItem(STORAGE_KEYS.CONTAINER_DROPS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.CONTAINER_DROPS, JSON.stringify(INITIAL_CONTAINER_DROPS));
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
    localStorage.setItem(STORAGE_KEYS.CONTAINER_DROPS, JSON.stringify(drops));
    return drop;
  },

  getCashDrawerLogs(): CashDrawerLog[] {
    const data = localStorage.getItem(STORAGE_KEYS.CASH_DRAWER);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.CASH_DRAWER, JSON.stringify(INITIAL_CASH_DRAWER));
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
    localStorage.setItem(STORAGE_KEYS.CASH_DRAWER, JSON.stringify(logs));
    return newLog;
  },

  getYardBays(): YardBayLocation[] {
    const data = localStorage.getItem(STORAGE_KEYS.YARD_BAYS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.YARD_BAYS, JSON.stringify(INITIAL_YARD_BAYS));
      return INITIAL_YARD_BAYS;
    }
    return JSON.parse(data);
  },

  saveYardBays(bays: YardBayLocation[]): void {
    localStorage.setItem(STORAGE_KEYS.YARD_BAYS, JSON.stringify(bays));
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

    // Deduct cash from Paymaster Cash Drawer if payoutMethod === 'Cash'
    if (ticket.payoutMethod === 'Cash') {
      this.addCashDrawerEntry({
        type: 'PAYOUT_DISBURSEMENT',
        amount: -Math.abs(ticket.finalPayout),
        ticketId: ticket.id,
        operatorName: ticket.operatorName,
        notes: `Cash voucher payout for ticket #${ticket.id}`,
      });
    }

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
    localStorage.setItem(STORAGE_KEYS.CATALYTIC_CODES, JSON.stringify(INITIAL_CAT_CODES));
    localStorage.setItem(STORAGE_KEYS.CONTAINER_DROPS, JSON.stringify(INITIAL_CONTAINER_DROPS));
    localStorage.setItem(STORAGE_KEYS.CASH_DRAWER, JSON.stringify(INITIAL_CASH_DRAWER));
    localStorage.setItem(STORAGE_KEYS.YARD_BAYS, JSON.stringify(INITIAL_YARD_BAYS));
    localStorage.removeItem(STORAGE_KEYS.NMVTIS_LOGS);
  },
};
