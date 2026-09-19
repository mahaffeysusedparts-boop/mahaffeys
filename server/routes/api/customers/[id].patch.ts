import { defineHandler } from "nitro";
import { createError, getRouterParam, readBody } from "nitro/h3";
import { requireUser } from "../../../utils/auth";
import { auditFor, recordAudit } from "../../../utils/audit";
import { isCustomerIdType, toCustomer, type CustomerIdType, type CustomerRow } from "../../../utils/customers";
import { query } from "../../../utils/db";

interface UpdateCustomerBody {
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
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Customer ID is required" });

  const body = await readBody<UpdateCustomerBody>(event);
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

  const plate = text(body.vehicleLicensePlate, 24).toUpperCase();
  const result = await query<CustomerRow>(`
    UPDATE customers SET
      full_name = $2,
      phone = $3,
      id_type = $4,
      id_number = $5,
      id_state = $6,
      address = $7,
      vehicle_license_plate = NULLIF($8, ''),
      vehicle_state = NULLIF($9, ''),
      notes = NULLIF($10, ''),
      id_photo_url = NULLIF($11, ''),
      captured_plates = CASE
        WHEN $8 = '' OR captured_plates ? $8 THEN captured_plates
        ELSE captured_plates || jsonb_build_array($8::text)
      END,
      is_commercial = $12,
      company_name = NULLIF($13, ''),
      business_address = NULLIF($14, ''),
      updated_at = NOW()
    WHERE id = $1
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
    text(body.idPhotoUrl, 2048),
    isCommercial,
    isCommercial ? companyName : "",
    isCommercial ? businessAddress : "",
  ]);

  if (!result.rows[0]) throw createError({ statusCode: 404, statusMessage: "Customer not found" });
  const customer = toCustomer(result.rows[0]);
  await recordAudit(auditFor(user, {
    action: "customer.update",
    entity: "customer",
    entityId: customer.id,
    detail: { fullName: customer.fullName, isCommercial: customer.isCommercial },
  }));
  return customer;
});
