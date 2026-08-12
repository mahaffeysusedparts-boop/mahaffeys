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
  PullPartItem,
  PullYardVehicle,
  CoreReturnLog,
  AdmissionPass,
  IpCamera,
  VehicleArrivalSubscription,
} from "@/types/scrap";
import { generateSamplePhoto } from "@/utils/complianceUtils";
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
  CORE_RETURNS: 'mahaffeys_core_returns',
  ADMISSION_PASSES: 'mahaffeys_admission_passes',
  IP_CAMERAS: 'mahaffeys_ip_cameras',
  VEHICLE_SUBSCRIPTIONS: 'mahaffeys_vehicle_subscriptions',
};

export const INITIAL_IP_CAMERAS: IpCamera[] = [
  {
    id: 'cam-101',
    name: 'Scale Desk License Plate OCR Cam',
    ipAddress: '192.168.1.150',
    port: 8080,
    streamUrl: 'http://192.168.1.150:8080/video',
    snapshotUrl: 'http://192.168.1.150:8080/shot.jpg',
    cameraType: 'MJPEG',
    assignment: 'LICENSE_PLATE',
    isActive: true,
    notes: 'High resolution 1080p camera positioned over drive-on scale tag line',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cam-102',
    name: 'Customer Face & ID Counter Camera',
    ipAddress: '192.168.1.151',
    port: 80,
    streamUrl: 'http://192.168.1.151/mjpeg',
    snapshotUrl: 'http://192.168.1.151/snapshot.jpg',
    cameraType: 'SNAPSHOT',
    assignment: 'SELLER_FACE',
    isActive: true,
    notes: 'Positioned above paymaster counter for seller facial verification',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cam-103',
    name: 'Scale Bed Overhead Cargo Camera',
    ipAddress: '192.168.1.152',
    port: 8080,
    streamUrl: 'http://192.168.1.152:8080/video',
    snapshotUrl: 'http://192.168.1.152:8080/shot.jpg',
    cameraType: 'MJPEG',
    assignment: 'CARGO_BAY',
    isActive: true,
    notes: 'Overhead wide angle camera viewing truck bed and scale hopper',
    createdAt: new Date().toISOString(),
  },
];

export const INITIAL_PULL_PARTS: PullPartItem[] = [
  {
    id: 'part-1',
    partName: 'Complete Engine Assembly (Short/Long Block)',
    category: 'Engine & Driveline',
    price: 245.00,
    coreDeposit: 45.00,
    warrantyFee: 15.00,
    interchangeNotes: 'Includes intake manifold, oil pan, and heads.',
    isPopular: true,
  },
  {
    id: 'part-2',
    partName: 'Automatic / Manual Transmission Assembly',
    category: 'Engine & Driveline',
    price: 175.00,
    coreDeposit: 35.00,
    warrantyFee: 12.00,
    interchangeNotes: 'Torque converter included if attached.',
    isPopular: true,
  },
  {
    id: 'part-3',
    partName: 'Alternator / Generator',
    category: 'Electrical & Lights',
    price: 38.00,
    coreDeposit: 10.00,
    warrantyFee: 5.00,
    interchangeNotes: 'Standard 12V OEM alternator.',
    isPopular: true,
  },
  {
    id: 'part-4',
    partName: 'Starter Motor Assembly',
    category: 'Electrical & Lights',
    price: 32.00,
    coreDeposit: 10.00,
    warrantyFee: 5.00,
    interchangeNotes: 'Bench tested at counter.',
    isPopular: true,
  },
  {
    id: 'part-5',
    partName: 'Door Assembly (Bare Shell or Loaded)',
    category: 'Body & Panels',
    price: 75.00,
    coreDeposit: 0.00,
    warrantyFee: 5.00,
    interchangeNotes: 'Includes door glass and regulator if intact.',
    isPopular: true,
  },
  {
    id: 'part-6',
    partName: 'Front / Rear Fender Panel',
    category: 'Body & Panels',
    price: 48.00,
    coreDeposit: 0.00,
    warrantyFee: 3.00,
    interchangeNotes: 'Steel or aluminum OEM body fender.',
  },
  {
    id: 'part-7',
    partName: '12V Lead Auto Battery',
    category: 'Electrical & Lights',
    price: 28.00,
    coreDeposit: 12.00,
    warrantyFee: 5.00,
    interchangeNotes: 'Charged and battery tester verified.',
    isPopular: true,
  },
  {
    id: 'part-8',
    partName: 'Headlight / Tail Light Assembly',
    category: 'Electrical & Lights',
    price: 35.00,
    coreDeposit: 0.00,
    warrantyFee: 3.00,
    interchangeNotes: 'Clean OEM lens assembly.',
  },
  {
    id: 'part-9',
    partName: 'Aluminum Rim / Alloy Wheel',
    category: 'Wheels & Tires',
    price: 42.00,
    coreDeposit: 0.00,
    warrantyFee: 0.00,
    interchangeNotes: 'Straight alloy wheel (tire separate).',
    isPopular: true,
  },
  {
    id: 'part-10',
    partName: 'Radiator & Cooling Fan Shroud',
    category: 'Exhaust & Fuel',
    price: 45.00,
    coreDeposit: 8.00,
    warrantyFee: 5.00,
    interchangeNotes: 'Pressure checked for core leaks.',
  },
];

export const INITIAL_PULL_VEHICLES: PullYardVehicle[] = [
  {
    id: 'veh-101',
    section: 'Domestic Trucks & SUVs',
    year: 2008,
    make: 'Ford',
    model: 'F-150 SuperCrew 5.4L',
    color: 'Oxford White',
    vin: '1FTRF12W88KA10291',
    dateSetInYard: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    status: 'AVAILABLE',
    partsRemaining: ['Transmission 4R75E', 'Doors (4x)', 'Rear Axle Assembly', 'Interior Seats', 'Fenders', 'Hood'],
    dismantlingLog: { catalyticConvertersRemoved: 1, wheelsRemoved: 0, gasDrained: true, oilDrained: true, notes: 'Pulled main cat converter' },
    photoUrl: generateSamplePhoto('vehicle'),
    purchasePrice: 450,
    originSource: '1428 Industrial Pkwy, Tow Origin',
    notes: 'Runs and drives, minor front dent',
    stockNumber: 'STK-2025-101',
    rowNumber: 'Row 4',
    spaceNumber: 'Space 12',
  },
  {
    id: 'veh-102',
    section: 'GM & Chevrolet',
    year: 2008,
    make: 'Chevrolet',
    model: 'Impala LT 3.5L V6',
    color: 'Silver Metallic',
    vin: '1G1JC524317109281',
    dateSetInYard: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    status: 'AVAILABLE',
    partsRemaining: ['Engine 3.5L V6', 'Headlights', 'Bumper Assembly', 'Front Struts'],
    dismantlingLog: { catalyticConvertersRemoved: 0, wheelsRemoved: 2, gasDrained: true, oilDrained: false },
    photoUrl: generateSamplePhoto('vehicle'),
    purchasePrice: 350,
    originSource: 'Vance Auto Recovery Tow',
    notes: 'Missing key, flat tire on right rear',
    stockNumber: 'STK-2025-102',
    rowNumber: 'Row 2',
    spaceNumber: 'Space 08',
  },
  {
    id: 'veh-103',
    section: 'Asian Imports',
    year: 2008,
    make: 'Nissan',
    model: 'Altima 2.5S Sedan',
    color: 'Super Black',
    vin: '1N4AL21E38C209182',
    dateSetInYard: new Date(Date.now() - 1000 * 60 * 60 * 24 * 22).toISOString(),
    status: 'CRUSHED',
    partsRemaining: ['Bare Body Shell', 'Subframe', 'Rear Suspension Beam'],
    dismantlingLog: { catalyticConvertersRemoved: 1, wheelsRemoved: 4, gasDrained: true, oilDrained: true, notes: 'Completely stripped and ready for bailer' },
    photoUrl: generateSamplePhoto('vehicle'),
    purchasePrice: 300,
    originSource: 'Decatur Highway Tow Depot',
    notes: 'Crushed and stripped shell',
    stockNumber: 'STK-2025-103',
    rowNumber: 'Row 8',
    spaceNumber: 'Space 01',
  },
  {
    id: 'veh-104',
    section: 'Asian Imports',
    year: 2011,
    make: 'Toyota',
    model: 'Camry LE 2.5L',
    color: 'Classic Silver',
    vin: '4T1BF1FK1BU209182',
    dateSetInYard: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    status: 'AVAILABLE',
    partsRemaining: ['2AR-FE Engine', '6-Speed Auto Transmission', 'Alloy Wheels (4x)', 'Doors', 'Front End Assembly'],
    dismantlingLog: { catalyticConvertersRemoved: 0, wheelsRemoved: 0, gasDrained: false, oilDrained: false },
    photoUrl: generateSamplePhoto('vehicle'),
    purchasePrice: 500,
    originSource: 'Highway 78 Police Impound Tow',
    notes: 'Key in ignition, catalytic converters intact',
    stockNumber: 'STK-2025-104',
    rowNumber: 'Row 1',
    spaceNumber: 'Space 04',
  },
];

export const INITIAL_CORE_RETURNS: CoreReturnLog[] = [
  {
    id: 'core-1',
    customerName: 'Robert Henderson',
    customerIdNumber: 'DL-9823145-GA',
    partName: 'Alternator / Generator Core',
    coreDepositRefunded: 10.00,
    returnedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    operatorName: 'Scale Tech Station 1',
  },
  {
    id: 'core-2',
    customerName: 'Marcus Vance',
    customerIdNumber: 'DL-4481029-GA',
    partName: '4R75E Transmission Core',
    coreDepositRefunded: 35.00,
    returnedAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    operatorName: 'Scale Tech Station 1',
  },
];

export const INITIAL_ADMISSION_PASSES: AdmissionPass[] = [
  {
    id: 'pass-1001',
    customerName: 'Robert Henderson',
    customerIdNumber: 'DL-9823145-GA',
    passDate: new Date().toISOString(),
    feePaid: 2.00,
    waiverSigned: true,
    operatorName: 'Scale Tech Station 1',
  },
  {
    id: 'pass-1002',
    customerName: 'Sarah Jenkins',
    customerIdNumber: 'ID-881920-GA',
    passDate: new Date().toISOString(),
    feePaid: 2.00,
    waiverSigned: true,
    operatorName: 'Scale Tech Station 1',
  },
];

export const INITIAL_VEHICLE_SUBSCRIPTIONS: VehicleArrivalSubscription[] = [
  {
    id: 'sub-1',
    make: 'Honda',
    model: 'Civic',
    yearMin: 2008,
    yearMax: 2015,
    contactName: 'Alex Mercer',
    contactPhoneOrEmail: '(555) 234-5678',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    notified: false,
  },
  {
    id: 'sub-2',
    make: 'Ford',
    model: 'F-150',
    yearMin: 2004,
    yearMax: 2012,
    contactName: 'Dave Miller',
    contactPhoneOrEmail: 'dave@truckrepair.com',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    notified: false,
  },
];

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
    capturedPlates: ['BKN-402'],
  },
];

export const INITIAL_SETTINGS: YardSettings = {
  yardName: 'Apex Metal & Auto Recyclers',
  address: '400 Recycling Way, Suite A',
  cityStateZip: 'Atlanta, GA 30318',
  phone: '(404) 555-SCRAP',
  email: 'intake@apexrecycling.local',
  licenseNumber: 'SCRAP-GA-2025-901A',
  nmvtisReportingId: 'NMVTIS-ENTITY-881902',
  receiptHeader: 'THANK YOU FOR RECYCLING WITH APEX! STATE COMPLIANCE ID VERIFIED.',
  receiptFooter: 'All scrap transactions final. Photo ID on record. NMVTIS Auto Salvage Verified.',
  defaultWeightUnit: 'LBS',
  serialBaudRate: 9600,
  webSocketUrl: 'ws://localhost:8080/scale',
  operatorName: 'Scale Tech Station 1',
  cashDrawerFloatLimit: 10000,
  admissionFeeUsd: 2.00,
  customDomain: 'app.mahaffeysusedparts.com',
};

const sampleCarCaptures: ComplianceCaptures = {
  personPhotoUrl: generateSamplePhoto('person'),
  idPhotoUrl: generateSamplePhoto('id'),
  vehiclePhotoUrl: generateSamplePhoto('vehicle'),
  licensePlatePhotoUrl: generateSamplePhoto('plate'),
  loadPhotoUrl: generateSamplePhoto('load'),
  nmvtisReported: false,
};

const sampleScrapCaptures: ComplianceCaptures = {
  personPhotoUrl: generateSamplePhoto('person'),
  idPhotoUrl: generateSamplePhoto('id'),
  vehiclePhotoUrl: generateSamplePhoto('vehicle'),
  licensePlatePhotoUrl: generateSamplePhoto('plate'),
  loadPhotoUrl: generateSamplePhoto('load'),
};

export const INITIAL_TICKETS: Ticket[] = [
  {
    id: 'T-2025-1001',
    ticketType: 'CAR_SALVAGE',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    status: 'COMPLETED',
    customerId: 'cust-102',
    customerName: 'Marcus Vance (Vance Towing)',
    customerPhone: '(555) 712-4091',
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
    customerPhone: '(555) 382-9102',
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
];

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

  getVehicleSubscriptions(): VehicleArrivalSubscription[] {
    const data = sharedStorage.getItem(STORAGE_KEYS.VEHICLE_SUBSCRIPTIONS);
    if (!data) {
      sharedStorage.setItem(STORAGE_KEYS.VEHICLE_SUBSCRIPTIONS, JSON.stringify(INITIAL_VEHICLE_SUBSCRIPTIONS));
      return INITIAL_VEHICLE_SUBSCRIPTIONS;
    }
    return JSON.parse(data);
  },

  saveVehicleSubscription(sub: VehicleArrivalSubscription): VehicleArrivalSubscription {
    const subs = this.getVehicleSubscriptions();
    const idx = subs.findIndex((s) => s.id === sub.id);
    if (idx >= 0) {
      subs[idx] = sub;
    } else {
      subs.unshift(sub);
    }
    sharedStorage.setItem(STORAGE_KEYS.VEHICLE_SUBSCRIPTIONS, JSON.stringify(subs));
    return sub;
  },

  deleteVehicleSubscription(id: string): void {
    const subs = this.getVehicleSubscriptions().filter((s) => s.id !== id);
    sharedStorage.setItem(STORAGE_KEYS.VEHICLE_SUBSCRIPTIONS, JSON.stringify(subs));
  },

  matchVehicleSubscriptions(make: string, model: string, year?: number): VehicleArrivalSubscription[] {
    const subs = this.getVehicleSubscriptions();
    const cleanMake = make.toLowerCase().trim();
    const cleanModel = model.toLowerCase().trim();

    return subs.filter((s) => {
      const matchMake = s.make.toLowerCase().trim() === cleanMake || cleanMake.includes(s.make.toLowerCase().trim());
      const matchModel = s.model.toLowerCase().trim() === cleanModel || cleanModel.includes(s.model.toLowerCase().trim());
      let matchYear = true;
      if (year && s.yearMin) matchYear = matchYear && year >= s.yearMin;
      if (year && s.yearMax) matchYear = matchYear && year <= s.yearMax;
      return matchMake && matchModel && matchYear;
    });
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
      sharedStorage.setItem(STORAGE_KEYS.PULL_YARD_VEHICLES, JSON.stringify(INITIAL_PULL_VEHICLES));
      return INITIAL_PULL_VEHICLES;
    }

    const vehicles = JSON.parse(data) as Array<Omit<PullYardVehicle, 'status' | 'dismantlingLog'> & {
      status: string;
      dismantlingLog?: PullYardVehicle['dismantlingLog'];
    }>;

    return vehicles.map((vehicle) => ({
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
  },

  savePullYardVehicle(veh: PullYardVehicle): PullYardVehicle {
    const vehicles = this.getPullYardVehicles();
    const idx = vehicles.findIndex((v) => v.id === veh.id);
    if (idx >= 0) {
      vehicles[idx] = veh;
    } else {
      vehicles.unshift(veh);
    }
    sharedStorage.setItem(STORAGE_KEYS.PULL_YARD_VEHICLES, JSON.stringify(vehicles));
    return veh;
  },

  deletePullYardVehicle(vehicleId: string): void {
    const vehicles = this.getPullYardVehicles().filter((vehicle) => vehicle.id !== vehicleId);
    sharedStorage.setItem(STORAGE_KEYS.PULL_YARD_VEHICLES, JSON.stringify(vehicles));
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
    if (existingIndex >= 0) {
      tickets[existingIndex] = ticket;
    } else {
      tickets.unshift(ticket);
    }
    sharedStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));

    if (ticket.ticketType === 'CAR_SALVAGE' && ticket.carRecord) {
      const c = ticket.carRecord;
      this.savePullYardVehicle({
        id: `veh-${Date.now()}`,
        section: c.make.includes('Ford')
          ? 'Ford & Lincoln'
          : c.make.includes('Chevy') || c.make.includes('Chevrolet') || c.make.includes('GMC')
          ? 'GM & Chevrolet'
          : c.make.includes('Toyota') || c.make.includes('Nissan') || c.make.includes('Honda')
          ? 'Asian Imports'
          : 'Domestic Trucks & SUVs',
        year: c.year,
        make: c.make,
        model: c.model,
        color: c.color,
        vin: c.vin,
        dateSetInYard: new Date().toISOString(),
        status: c.yardStatus || 'PENDING',
        partsRemaining: ['Engine Assembly', 'Transmission', 'Doors', 'Wheels', 'Headlights', 'Fenders'],
        photoUrl: c.photoUrl || ticket.complianceCaptures?.vehiclePhotoUrl,
        purchasePrice: c.purchasePrice ?? ticket.finalPayout,
        originSource: c.originSource || 'Tow Intake',
        notes: c.notes || ticket.notes,
        stockNumber: `STK-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        dismantlingLog: {
          catalyticConvertersRemoved: 0,
          wheelsRemoved: 0,
          gasDrained: c.fluidsDrained,
          oilDrained: c.fluidsDrained,
        },
      });
    }

    if (ticket.payoutMethod === 'Cash') {
      this.addCashDrawerEntry({
        type: 'PAYOUT_DISBURSEMENT',
        amount: -Math.abs(ticket.finalPayout),
        ticketId: ticket.id,
        operatorName: ticket.operatorName,
        notes: `Cash voucher payout for ticket #${ticket.id}`,
      });
    }

    if (ticket.customerId) {
      const customers = this.getCustomers();
      const cust = customers.find((c) => c.id === ticket.customerId);
      if (cust) {
        cust.totalPayouts += ticket.finalPayout;
        if (ticket.customerPhone) {
          cust.phone = ticket.customerPhone;
        }
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
        if (ticket.vehicleLicensePlate && (!cust.capturedPlates || !cust.capturedPlates.includes(ticket.vehicleLicensePlate))) {
          cust.capturedPlates = [...(cust.capturedPlates || []), ticket.vehicleLicensePlate];
        }
        this.saveCustomer(cust);
      }
    } else if (ticket.customerName && ticket.customerPhone) {
      const customers = this.getCustomers();
      const existing = customers.find(c => c.fullName.toLowerCase() === ticket.customerName.toLowerCase() || (c.phone && c.phone === ticket.customerPhone));
      if (!existing) {
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
          totalPayouts: ticket.finalPayout,
          totalWeightLbs: ticket.scrapLines ? ticket.scrapLines.reduce((acc, l) => acc + l.billableWeight, 0) : 0,
          idPhotoUrl: ticket.complianceCaptures?.idPhotoUrl,
          capturedPlates: ticket.vehicleLicensePlate ? [ticket.vehicleLicensePlate] : [],
        });
      }
    }

    return ticket;
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
    sharedStorage.setItem(STORAGE_KEYS.VEHICLE_SUBSCRIPTIONS, JSON.stringify(INITIAL_VEHICLE_SUBSCRIPTIONS));
    sharedStorage.removeItem(STORAGE_KEYS.NMVTIS_LOGS);
  },
};