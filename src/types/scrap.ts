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
  hasEngineAndTrans: boolean;
  hasBattery: boolean;
  hasAluminumRims: boolean;
  fluidsDrained: boolean;
  
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
  
  // Financial
  grossTotal: number;
  totalDeductions: number;
  finalPayout: number;
  payoutMethod: 'Cash' | 'Check' | 'ACH Direct Transfer' | 'Yard Credit';
  checkNumber?: string;
  notes?: string;
  operatorName: string;
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
}
