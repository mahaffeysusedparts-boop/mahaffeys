import { defineHandler } from "nitro";
import { createError, getQuery } from "nitro/h3";
import { requireUser } from "../../../utils/auth";
import { query } from "../../../utils/db";
import { findCustomerByPlate, normalizePlate, type LprCustomer } from "../../../utils/lpr";

interface CustomerStateRow {
  value: unknown;
}

export default defineHandler(async (event) => {
  await requireUser(event);
  const plate = normalizePlate(String(getQuery(event).plate || ""));
  if (plate.length < 2 || plate.length > 12) {
    throw createError({ statusCode: 400, statusMessage: "Provide a valid license plate number" });
  }

  const result = await query<CustomerStateRow>(
    "SELECT value FROM app_state WHERE key = 'mahaffeys_customers'",
  );
  const value = result.rows[0]?.value;
  const customers = Array.isArray(value) ? value as LprCustomer[] : [];
  const customer = findCustomerByPlate(customers, plate);

  return { plate, customer };
});
