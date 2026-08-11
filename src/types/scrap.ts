export type IntakeType = 'CAR_SALVAGE' | 'SCRAP_METAL';

export type ScaleConnectionMode = 'SIMULATOR' | 'WEB_SERIAL' | 'WEBSOCKET';

export type WeightUnit = 'LBS' | 'KG';

export interface ScaleStatus {
  weight: number; // in current weight unit (default LBS)
  unit: WeightUnit;
  isStable: boolean;
  isZero: boolean;
  tareWeight: number;
  grossWeight: number;
  netWeight: number;
  mode: ScaleConnectionMode;
  connected: boolean;
  portName?: string;
  errorMessage?: string;
}

export interface MetalGrade {
  id: string;
  category: 'Non-Ferrous' | 'Ferrous' | 'Precious' | 'E-Waste' | 'Batteries & Auto';
  name: string;
  code: string;
  ratePerLb: number;
  description: string;
  iconName?: string;
  isPopular?: boolean;
}

export interface AutoSalvageCategoryRate {
  id: string;
  categoryName: string; // e.g. "Complete Sedan / Coupe", "SUV / Pickup Truck", "Striped Vehicle Shell", "Heavy Commercial Truck"
  description: string;
  ratePerTon: number;
  flatBonusWithCat: number;
  flatBonusWithEngine: number;
  flatBonusWithBattery: number;
}

export interface CatalyticConverterCode {
  id: string;
  code: string; // e.g. "4R31-5E212-AA", "GM-125642", "TOYOTA-GD3", "HONDA-251"
  make: string;
  category: 'Domestic Large' | 'Foreign Small' | 'Exotic / High-Grade' | 'Aftermarket' | 'Diesel DPF Filter';
  ptGrams: number; // Platinum grams
  pdGrams: number; // Palladium grams
  rhGrams: number; // Rhodium grams
  avgMarketValue: number; // USD
  notes?: string;
  photoUrl?: string;
}

export interface PullPartItem {
  id: string;
  partName: string;
  category: 'Engine & Driveline' | 'Body & Panels' | 'Electrical & Lights' | 'Interior & Glass' | 'Wheels & Tires' | 'Exhaust & Fuel';
  price: number;
  coreDeposit: number; // e.g. $10 or $25 core refund
  warrantyFee: number; // 30-day exchange warranty optional $5
  interchangeNotes?: string;
  isPopular?: boolean;
}

export interface PullYardVehicle {
  id: string;
  rowNumber: string; // e.g. "Row 104"
  spaceNumber: string; // e.g. "Space 12"
  section: 'Domestic Trucks & SUVs' | 'Ford & Lincoln' | 'GM & Chevrolet' | 'Chrysler & Dodge' | 'Asian Imports' | 'European';
  year: number;
  make: string;
  model: string;
  color: string;
  vin: string;
  dateSetInYard: string;
  status: 'FRESH_SET' | 'POPULAR' | 'STRIPPED_SHELL' | 'READY_FOR_CRUSHER';
  partsRemaining: string[];
}

export interface CoreReturnLog {
  id: string;
  customerName: string;
  customerIdNumber?: string;
  partName: string;
  coreDepositRefunded: number;
  returnedAt: string;
  operatorName: string;
  ticketId?: string;
}

export interface AdmissionPass {
  id: string;
  customerName: string;
  customerIdNumber: string;
  passDate: string;
  feePaid: number; // e.g. $2.00
  waiverSigned: boolean;
  operatorName: string;
}

export interface ContainerDrop {
  id: string;
  containerNumber: string; // e.g. "BOX-20-88"
  clientName: string;
  clientAddress: string;
  clientPhone: string;
  dropDate: string;
  pickupDueDate: string;
  status: 'ON_SITE' | 'PICKUP_REQUESTED' | 'RETURNED_TO_YARD' | 'PROCESSED';
  binType: '20-Yard Roll-Off' | '40-Yard High-Side' | 'Lugger Scrap Box' | 'Gaylord Wire Bin';
  assignedDriver: string;
  materialCategory: string;
  estimatedWeightLbs: number;
  notes?: string;
}

export interface CashDrawerLog {
  id: string;
  timestamp: string;
  type: 'OPENING_FLOAT' | 'PAYOUT_DISBURSEMENT' | 'VAULT_REPLENISHMENT' | 'CLOSING_AUDIT';
  amount: number; // Positive for float/replenish, negative for payout
  ticketId?: string;
  operatorName: string;
  balanceAfter: number;
  notes?: string;
}

export interface YardBayLocation {
  id: string;
  bayName: string;
  categoryType: 'FERROUS_PILE' | 'NON_FERROUS_BIN' | 'CAR_GRID' | 'PRECIOUS_VAULT' | 'PROCESSING_ZONE';
  capacityLbs: number;
  currentLbs: number;
  estValueUsd: number;
  status: 'NORMAL' | 'NEAR_CAPACITY' | 'CRITICAL_FULL';
  gridArea: string; // e.g. "Grid A1"
  lastUpdated: string;
}

export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  idType: 'Driver License' | 'State ID' | 'Passport' | 'Military ID';
  idNumber: string;
  idState: string;
  address: string;
  vehicleLicensePlate?: string;
  vehicleState?: string;
  notes?: string;
  createdAt: string;
  totalPayouts: number;
  totalWeightLbs: number;
  // Enhanced Compliance Fields
  idPhotoUrl?: string;
  thumbprintData?: string;
  capturedPlates?: string[];
}

export interface ComplianceCaptures {
  personPhotoUrl?: string;
  idPhotoUrl?: string;
  vehiclePhotoUrl?: string;
  licensePlatePhotoUrl?: string;
  loadPhotoUrl?: string;
  thumbprintCaptured?: boolean;
  thumbprintDataUrl?: string;
  nmvtisReported?: boolean;
  nmvtisReportedAt?: string;
  nmvtisBatchId?: string;
}

export interface ScrapTicketLine {
  id: string;
  metalGradeId: string;
  metalName: string;
  metalCategory: string;
  grossWeight: number;
  tareWeight: number;
  netWeight: number;
  deductionPercent: number; // e.g. 5% moisture/plastic
  deductionLbs: number; // calculated deduction in lbs
  billableWeight: number; // netWeight - deductionLbs
  ratePerLb: number;
  lineTotal: number;
}

export interface CarIntakeRecord {
  vin: string;
  year: number;
  make: string;
  model: string;
  color: string;
  mileage?: number;
  titleStatus: 'Clean Title' | 'Salvage Title' | 'Bill of Sale' | 'Missing Title (Affidavit)' | 'Junk / Scrap Certificate';
  titleNumber?: string;
  
  // Checklist & Features
  hasCatalyticConverter: boolean;
  catCondition: 'Original OEM' | 'Aftermarket' | 'Missing / Removed';
  catCodeSerial?: string;
  hasEngineAndTrans: boolean;
  hasBattery: boolean;
  hasAluminumRims: boolean;
  fluidsDrained: boolean;
  
  // Pull-a-Part Row Staging
  assignedRow?: string;
  assignedSpace?: string;
  
  // Pricing
  pricingMode: 'TONNAGE' | 'FLAT_RATE';
  vehicleWeightLbs: number;
  ratePerTon: number;
  flatRate: number;
  catBonus: number;
  engineBonus: number;
  batteryBonus: number;
  deductions: number;
  totalPayout: number;

  // Compliance
  complianceCaptures?: ComplianceCaptures;
}

export interface Ticket {
  id: string; // e.g. "T-2025-0104"
  ticketType: IntakeType;
  createdAt: string;
  status: 'COMPLETED' | 'VOIDED' | 'DRAFT';
  
  customerId?: string;
  customerName: string;
  customerIdNumber?: string;
  vehicleLicensePlate?: string;
  
  // Scrap metal specific
  scrapLines?: ScrapTicketLine[];
  
  // Car salvage specific
  carRecord?: CarIntakeRecord;
  
  // Compliance attachment
  complianceCaptures?: ComplianceCaptures;

  // Financial
  grossTotal: number;
  totalDeductions: number;
  finalPayout: number;
  payoutMethod: 'Cash' | 'Check' | 'ACH Direct Transfer' | 'Yard Credit';
  checkNumber?: string;
  notes?: string;
  operatorName: string;
}

export interface NMVTISReportLog {
  id: string;
  batchId: string;
  exportedAt: string;
  ticketCount: number;
  ticketIds: string[];
  status: 'PENDING' | 'EXPORTED' | 'DISCREPANCY';
  exportedBy: string;
  downloadUrl?: string;
}

export interface YardSettings {
  yardName: string;
  address: string;
  cityStateZip: string;
  phone: string;
  email: string;
  licenseNumber: string;
  receiptHeader: string;
  receiptFooter: string;
  defaultWeightUnit: WeightUnit;
  serialBaudRate: number;
  webSocketUrl: string;
  operatorName: string;
  nmvtisReportingId?: string;
  cashDrawerFloatLimit?: number;
  admissionFeeUsd?: number;
}
