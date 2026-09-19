import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";
import { requireUser } from "../../../utils/auth";
import { query } from "../../../utils/db";
import { toCustomer, type CustomerRow } from "../../../utils/customers";

interface CountRow {
  count: string;
}

export default defineHandler(async (event) => {
  await requireUser(event);
  const params = getQuery(event);
  const search = String(params.search || "").trim().slice(0, 120);
  const requestedPage = Number.parseInt(String(params.page || "1"), 10);
  const requestedPageSize = Number.parseInt(String(params.pageSize || "25"), 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = Number.isFinite(requestedPageSize)
    ? Math.min(100, Math.max(1, requestedPageSize))
    : 25;
  const offset = (page - 1) * pageSize;
  const term = `%${search}%`;
  const where = search
    ? `WHERE full_name ILIKE $1
        OR COALESCE(company_name, '') ILIKE $1
        OR id_number ILIKE $1
        OR phone ILIKE $1
        OR COALESCE(vehicle_license_plate, '') ILIKE $1
        OR address ILIKE $1
        OR COALESCE(business_address, '') ILIKE $1`
    : "";
  const searchValues = search ? [term] : [];
  const limitIndex = searchValues.length + 1;
  const offsetIndex = searchValues.length + 2;

  const [customerResult, countResult] = await Promise.all([
    query<CustomerRow>(`
      SELECT * FROM customers
      ${where}
      ORDER BY is_commercial DESC, COALESCE(company_name, full_name), full_name
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `, [...searchValues, pageSize, offset]),
    query<CountRow>(`SELECT COUNT(*)::text AS count FROM customers ${where}`, searchValues),
  ]);

  const total = Number(countResult.rows[0]?.count || 0);
  return {
    customers: customerResult.rows.map(toCustomer),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
});
