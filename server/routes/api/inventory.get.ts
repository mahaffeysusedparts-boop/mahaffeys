import { defineHandler } from "nitro";
import { createError, getQuery, setResponseHeader } from "nitro/h3";
import type { PullYardVehicle, PullYardVehicleStatus, Ticket } from "../../../src/types/scrap";
import { query } from "../../utils/db";
import { mergeInventory, queryInventory } from "../../utils/inventory";

interface StateRow {
  key: string;
  value: unknown;
  updated_at: Date | string;
}

const SORT_OPTIONS = new Set([
  "dateSetInYard_asc", "dateSetInYard_desc",
  "year_asc", "year_desc",
  "make_asc", "make_desc",
  "model_asc", "model_desc",
  "price_asc", "price_desc",
]);
const STATUSES = new Set<PullYardVehicleStatus>(["PENDING", "AVAILABLE", "CRUSHED"]);

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const boundedInteger = (value: string | undefined, fallback: number, min: number, max: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw createError({ statusCode: 400, statusMessage: `Expected an integer between ${min} and ${max}` });
  }
  return parsed;
};
const optionalNumber = (value: string | undefined) => {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw createError({ statusCode: 400, statusMessage: "Invalid numeric filter" });
  return parsed;
};

export default defineHandler(async (event) => {
  const raw = getQuery(event);
  const page = boundedInteger(first(raw.page), 1, 1, 1_000_000);
  const limit = boundedInteger(first(raw.limit), 24, 1, 100);
  const sort = first(raw.sort) || "dateSetInYard_desc";
  const statusValue = first(raw.status)?.toUpperCase() as PullYardVehicleStatus | undefined;
  if (!SORT_OPTIONS.has(sort)) throw createError({ statusCode: 400, statusMessage: "Invalid inventory sort option" });
  if (statusValue && !STATUSES.has(statusValue)) throw createError({ statusCode: 400, statusMessage: "Invalid vehicle status" });

  const result = await query<StateRow>(`
    SELECT key, value, updated_at
    FROM app_state
    WHERE key = ANY($1::text[])
  `, [["mahaffeys_pull_yard_vehicles", "mahaffeys_tickets", "mahaffeys_removed_inventory_vehicles"]]);
  const state = new Map(result.rows.map((row) => [row.key, row.value]));
  const vehicles = Array.isArray(state.get("mahaffeys_pull_yard_vehicles"))
    ? state.get("mahaffeys_pull_yard_vehicles") as PullYardVehicle[]
    : [];
  const tickets = Array.isArray(state.get("mahaffeys_tickets"))
    ? state.get("mahaffeys_tickets") as Ticket[]
    : [];
  const removedIds = Array.isArray(state.get("mahaffeys_removed_inventory_vehicles"))
    ? state.get("mahaffeys_removed_inventory_vehicles") as string[]
    : [];

  const response = queryInventory(mergeInventory(vehicles, tickets, removedIds), {
    page,
    limit,
    search: first(raw.search)?.slice(0, 100),
    section: first(raw.section)?.slice(0, 100),
    part: first(raw.part)?.slice(0, 100),
    status: statusValue,
    excludeCrushed: first(raw.excludeCrushed) === "true",
    yearMin: optionalNumber(first(raw.yearMin)),
    yearMax: optionalNumber(first(raw.yearMax)),
    priceMin: optionalNumber(first(raw.priceMin)),
    priceMax: optionalNumber(first(raw.priceMax)),
    sort,
  });
  const updatedAt = result.rows
    .map((row) => row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at))
    .sort()
    .at(-1) || null;
  const publicItems = response.items.map(({ purchasePrice: _purchasePrice, notes: _notes, originSource: _originSource, sourceTicketId: _sourceTicketId, ...vehicle }) => vehicle);

  setResponseHeader(event, "Cache-Control", "no-store");
  return { ...response, items: publicItems, updatedAt };
});
