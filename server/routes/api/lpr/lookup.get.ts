import { defineHandler } from "nitro";
import { createError, getQuery } from "nitro/h3";
import { requireUser } from "../../../utils/auth";
import { query } from "../../../utils/db";
import { toCustomer, type CustomerRow } from "../../../utils/customers";
import { normalizePlate } from "../../../utils/lpr";

export default defineHandler(async (event) => {
  await requireUser(event);
  const plate = normalizePlate(String(getQuery(event).plate || ""));
  if (plate.length < 2 || plate.length > 12) {
    throw createError({ statusCode: 400, statusMessage: "Provide a valid license plate number" });
  }

  const result = await query<CustomerRow>(`
    SELECT * FROM customers
    WHERE UPPER(REGEXP_REPLACE(COALESCE(vehicle_license_plate, ''), '[^A-Za-z0-9]', '', 'g')) = $1
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(captured_plates) AS saved_plate
         WHERE UPPER(REGEXP_REPLACE(saved_plate, '[^A-Za-z0-9]', '', 'g')) = $1
       )
    ORDER BY updated_at DESC
    LIMIT 1
  `, [plate]);
  const customer = result.rows[0] ? toCustomer(result.rows[0]) : null;

  return { plate, customer };
});
