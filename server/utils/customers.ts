import type { QueryResultRow } from "pg";

export const CUSTOMER_ID_TYPES = ["Driver License", "State ID", "Passport", "Military ID"] as const;
export type CustomerIdType = typeof CUSTOMER_ID_TYPES[number];

export interface CustomerRow extends QueryResultRow {
  id: string;
  full_name: string;
  phone: string;
  id_type: CustomerIdType;
  id_number: string;
  id_state: string;
  address: string;
  vehicle_license_plate: string | null;
  vehicle_state: string | null;
  notes: string | null;
  created_at: Date | string;
  total_payouts: string | number;
  total_weight_lbs: string | number;
  id_photo_url: string | null;
  captured_plates: unknown;
  is_commercial: boolean;
  company_name: string | null;
  business_address: string | null;
}

export function isCustomerIdType(value: unknown): value is CustomerIdType {
  return typeof value === "string" && CUSTOMER_ID_TYPES.includes(value as CustomerIdType);
}

export function toCustomer(row: CustomerRow) {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    idType: row.id_type,
    idNumber: row.id_number,
    idState: row.id_state,
    address: row.address,
    vehicleLicensePlate: row.vehicle_license_plate || undefined,
    vehicleState: row.vehicle_state || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    totalPayouts: Number(row.total_payouts),
    totalWeightLbs: Number(row.total_weight_lbs),
    idPhotoUrl: row.id_photo_url || undefined,
    capturedPlates: Array.isArray(row.captured_plates) ? row.captured_plates.filter((plate): plate is string => typeof plate === "string") : [],
    isCommercial: row.is_commercial,
    companyName: row.company_name || undefined,
    businessAddress: row.business_address || undefined,
  };
}
