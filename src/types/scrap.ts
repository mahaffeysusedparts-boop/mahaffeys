export type IntakeType = 'CAR_SALVAGE' | 'SCRAP_METAL' | 'MOBILE_SCRAP';

export type ScaleConnectionMode = 'WEB_SERIAL' | 'WEBSOCKET';

export type WeightUnit = 'LBS' | 'KG';

export type UserRole = 'admin' | 'yard_manager' | 'scale_operator' | 'yard_employee';

export type AccountStatus = 'pending' | 'approved' | 'rejected' | 'disabled';

export type IpCameraType = 'MJPEG' | 'SNAPSHOT' | 'HLS' | 'RTSP_STREAM';
export type IpCameraAssignment = 'SCALE_DESK' | 'SELLER_FACE' | 'LICENSE_PLATE' | 'CARGO_BAY' | 'YARD_OVERVIEW' | 'OTHER';

export interface IpCamera {
  id: string;
  name: string;
  ipAddress: string; // e.g. "192.168.1.150" or full URL "http://192.168.1.150:8080/video"
  port?: number;
  streamUrl: string; // resolved video or snapshot URL
  snapshotUrl?: string; // e.g. "http://192.168.1.150/cgi-bin/snapshot.cgi" or "/snapshot.jpg"
  cameraType: IpCameraType;
  assignment: IpCameraAssignment;
  username?: string;
  password?: string;
  isActive: boolean;
  notes?: string;
  createdAt: string;
}

export interface UserAccount {
  id: string;
  fullName: string;
  username: string;
  email?: string;
  role: UserRole;
  status: AccountStatus;
  createdAt: string;
  updatedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface AuthSession {
  userId: string;
  token: string;
  loginTime: string;
}

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
  categoryName: string;
  description: string;
  ratePerTon: number;
  flatBonusWithCat: number;
  flatBonusWithEngine: number;
  flatBonusWithBattery: number;
}

export interface CatalyticConverterCode {
  id: string;
  code: string;
  make: string;
  category: 'Domestic Large' | 'Foreign Small' | 'Exotic / High-Grade' | 'Aftermarket' | 'Diesel DPF Filter';
  ptGrams: number;
  pdGrams: number;
  rhGrams: number;
  avgMarketValue: number;
  notes?: string;
  photoUrl?: string;
}

export interface PullPartItem {
  id: string;
  partName: string;
  category: 'Engine & Driveline' | 'Body & Panels' | 'Electrical & Lights' | 'Interior & Glass' | 'Wheels & Tires' | 'Exhaust & Fuel';
  price: number;
  coreDeposit: number;
  warrantyFee: number;
  interchangeNotes?: string;
  isPopular?: boolean;
}

export type PullYardVehicleStatus = 'PENDING' | 'AVAILABLE' | 'CRUSHED';

export interface VehicleDismantlingLog {
  catalyticConvertersRemoved: number;
  wheelsRemoved: number;
  gasDrained: boolean;
  oilDrained: boolean;
  notes?: string;
  updatedAt?: string;
}

export interface PullYardVehicle {
  id: string;
  sourceTicketId?: string;
  section: 'Domestic Trucks & SUVs' | 'Ford & Lincoln' | 'GM & Chevrolet' | 'Chrysler & Dodge' | 'Asian Imports' | 'European';
  rowNumber?: number;
  year: number;
  make: string;
  model: string;
  trim?: string;
  color: string;
  vin: string;
  engineSizeLiters?: number;
  engineCylinders?: number;
  engineModel?: string;
  fuelType?: string;
  dateSetInYard: string;
  status: PullYardVehicleStatus;
  partsRemaining: string[];
  dismantlingLog: VehicleDismantlingLog;
  photoUrl?: string;
  purchasePrice?: number;
  originSource?: string;
  notes?: string;
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
  feePaid: number;
  waiverSigned: boolean;
  operatorName: string;
}

export interface ContainerDrop {
  id: string;
  containerNumber: string;
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
  amount: number;
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
  gridArea: string;
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
  idPhotoUrl?: string;
  capturedPlates?: string[];
}

export interface ComplianceCaptures {
  personPhotoUrl?: string;
  idPhotoUrl?: string;
  vehiclePhotoUrl?: string;
  licensePlatePhotoUrl?: string;
  loadPhotoUrl?: string;
  signatureUrl?: string;
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
  deductionPercent: number;
  deductionLbs: number;
  billableWeight: number;
  ratePerLb: number;
  lineTotal: number;
}

export interface CarIntakeRecord {
  vin: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  series?: string;
  color: string;
  mileage?: number;
  bodyClass?: string;
  vehicleType?: string;
  driveType?: string;
  doors?: number;
  engineCylinders?: number;
  engineSizeLiters?: number;
  engineModel?: string;
  engineHorsepower?: number;
  fuelType?: string;
  secondaryFuelType?: string;
  electrificationLevel?: string;
  transmissionStyle?: string;
  transmissionSpeeds?: number;
  manufacturer?: string;
  plantCountry?: string;
  plantCity?: string;
  plantState?: string;
  vinDecodedAt?: string;
  vinDecoderSource?: 'NHTSA vPIC';
  titleStatus: 'Clean Title' | 'Salvage Title' | 'Bill of Sale' | 'Missing Title (Affidavit)' | 'Junk / Scrap Certificate';
  titleNumber?: string;
  
  hasCatalyticConverter: boolean;
  catCondition: 'Original OEM' | 'Aftermarket' | 'Missing / Removed';
  catCodeSerial?: string;
  hasEngineAndTrans: boolean;
  hasBattery: boolean;
  hasAluminumRims: boolean;
  fluidsDrained: boolean;
  
  yardStatus?: PullYardVehicleStatus;
  
  pricingMode: 'TONNAGE' | 'FLAT_RATE';
  vehicleWeightLbs: number;
  ratePerTon: number;
  flatRate: number;
  catBonus: number;
  engineBonus: number;
  batteryBonus: number;
  deductions: number;
  totalPayout: number;

  purchasePrice?: number;
  originSource?: string;
  customerAddress?: string;
  notes?: string;
  photoUrl?: string;

  complianceCaptures?: ComplianceCaptures;
}

export interface Ticket {
  id: string;
  ticketType: IntakeType;
  createdAt: string;
  status: 'COMPLETED' | 'VOIDED' | 'DRAFT' | 'PENDING';
  
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerIdNumber?: string;
  vehicleLicensePlate?: string;
  
  scrapLines?: ScrapTicketLine[];
  carRecord?: CarIntakeRecord;
  complianceCaptures?: ComplianceCaptures;

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
  customDomain?: string;
  shipmentVarianceTolerancePct?: number;
}

export type ShipmentStatus = 'STAGED' | 'IN_TRANSIT' | 'DELIVERED' | 'SETTLED' | 'DISCREPANCY';

export interface MillShipper {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  notes?: string;
  createdAt: string;
}

export interface ShipmentSettlement {
  scaleTicketNumber: string;
  actualNetWeightLbs: number;
  actualRatePerLb: number;
  deductions: number;
  amountPaid: number;
  settledAt: string;
}

export interface OutboundShipment {
  id: string;
  loadNumber: string;
  millId?: string;
  millName: string;
  materialCategory: string;
  trailerNumber?: string;
  driverName?: string;
  grossWeightLbs: number;
  tareWeightLbs: number;
  netWeightLbs: number;
  expectedRatePerLb: number;
  expectedRevenue: number;
  status: ShipmentStatus;
  createdAt: string;
  departedAt?: string;
  deliveredAt?: string;
  settlement?: ShipmentSettlement;
}

export interface MetalRateChangeLog {
  id: string;
  metalGradeId: string;
  metalName: string;
  ratePerLb: number;
  changedAt: string;
}

export interface TimeClockEntry {
  id: string;
  userId: string;
  userName: string;
  clockInAt: string;
  clockOutAt?: string;
  breakStartedAt?: string;
  breakMinutes: number;
}

export type ChecklistShift = 'OPENING' | 'CLOSING';
export interface ChecklistItem { id: string; label: string; completed: boolean; completedAt?: string; completedBy?: string; }
export interface ChecklistRun { id: string; shift: ChecklistShift; date: string; items: ChecklistItem[]; }

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH';
export interface YardTask { id: string; title: string; assigneeName?: string; priority: TaskPriority; status: TaskStatus; dueDate?: string; createdAt: string; }

export interface EquipmentItem { id: string; name: string; assetType: string; meterLabel: string; meterReading: number; lastServiceDate?: string; nextServiceDue: string; }
export interface MaintenanceLogEntry { id: string; equipmentId: string; completedAt: string; notes: string; meterReading?: number; }