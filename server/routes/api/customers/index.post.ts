import { randomUUID } from "node:crypto";
import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { requireUser } from "../../../utils/auth";
import { auditFor, recordAudit } from "../../../utils/audit";
import { isCustomerIdType, toCustomer, type CustomerIdType, type CustomerRow } from "../../../utils/customers";
import { query } from "../../../utils/db";

interface CreateCustomerBody {
  fullName?: unknown;
  phone?: unknown;
  idType?: unknown;
  idNumber?: unknown;
  idState?: unknown;
  address?: unknown;
  vehicleLicensePlate?: unknown;
  vehicleState?: unknown;
  notes?: unknown;
  idPhotoUrl?: unknown;
  isCommercial?: unknown;
  companyName?: unknown;
  businessAddress?: unknown;
}

const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  const body = await readBody<CreateCustomerBody>(event);
  const fullName = text(body.fullName, 160);
  const idNumber = text(body.idNumber, 120);
  const isCommercial = body.isCommercial === true;
  const companyName = text(body.companyName, 180);
  const businessAddress = text(body.businessAddress, 300);

  if (!fullName) throw createError({ statusCode: 400, statusMessage: "Full name is required" });
  if (!idNumber) throw createError({ statusCode: 400, statusMessage: "ID number is required" });
  if (!isCustomerIdType(body.idType)) throw createError({ statusCode: 400, statusMessage: "Select a valid ID type" });
  if (isCommercial && !companyName) {
    throw createError({ statusCode: 400, statusMessage: "Company name is required for commercial accounts" });
  }

  const id = `cust-${randomUUID()}`;
  const createdAt = new Date();
  const plate = text(body.vehicleLicensePlate, 24).toUpperCase();
  const result = await query<CustomerRow>(`
    INSERT INTO customers (
      id, full_name, phone, id_type, id_number, id_state, address,
      vehicle_license_plate, vehicle_state, notes, created_at, updated_at,
      id_photo_url, captured_plates, is_commercial, company_name, business_address
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      NULLIF($8, ''), NULLIF($9, ''), NULLIF($10, ''), $11, $11,
      NULLIF($12, ''), $13::jsonb, $14, NULLIF($15, ''), NULLIF($16, '')
    )
    RETURNING *
  `, [
    id,
    fullName,
    text(body.phone, 40),
    body.idType as CustomerIdType,
    idNumber,
    text(body.idState, 12) || "GA",
    text(body.address, 300),
    plate,
    text(body.vehicleState, 12),
    text(body.notes, 1000),
    createdAt,
    text(body.idPhotoUrl, 2048),
    JSON.stringify(plate ? [plate] : []),
    isCommercial,
    isCommercial ? companyName : "",
    isCommercial ? businessAddress : "",
  ]);

  const customer = toCustomer(result.rows[0]);
  await recordAudit(auditFor(user, {
    action: "customer.create",
    entity: "customer",
    entityId: customer.id,
    detail: { fullName: customer.fullName, isCommercial: customer.isCommercial },
  }));
  return customer;
});
