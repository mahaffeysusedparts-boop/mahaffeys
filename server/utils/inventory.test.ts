import { describe, expect, it } from "vitest";
import type { PullYardVehicle } from "../../src/types/scrap";
import { queryInventory } from "./inventory";

const vehicle = (overrides: Partial<PullYardVehicle>): PullYardVehicle => ({
  id: "vehicle-1",
  section: "Asian Imports",
  year: 2020,
  make: "Honda",
  model: "Civic",
  color: "Blue",
  vin: "1HGBH41JXMN109186",
  dateSetInYard: "2026-01-01T00:00:00.000Z",
  status: "AVAILABLE",
  partsRemaining: ["Engine Assembly", "Doors"],
  purchasePrice: 700,
  dismantlingLog: { catalyticConvertersRemoved: 0, wheelsRemoved: 0, gasDrained: false, oilDrained: false },
  ...overrides,
});

const inventory = [
  vehicle({ id: "a", year: 2018, make: "Toyota", model: "Camry", purchasePrice: 500, dateSetInYard: "2026-01-01T00:00:00.000Z" }),
  vehicle({ id: "b", year: 2022, make: "Honda", model: "Accord", purchasePrice: 900, dateSetInYard: "2026-03-01T00:00:00.000Z" }),
  vehicle({ id: "c", year: 2020, make: "Ford", model: "F-150", section: "Ford & Lincoln", status: "PENDING", purchasePrice: 750, partsRemaining: ["Transmission"], dateSetInYard: "2026-02-01T00:00:00.000Z" }),
];

const baseQuery = { page: 1, limit: 24, sort: "dateSetInYard_desc" };

describe("queryInventory", () => {
  it("sorts deterministically and returns only the requested page", () => {
    const result = queryInventory(inventory, { ...baseQuery, limit: 2 });
    expect(result.items.map((item) => item.id)).toEqual(["b", "c"]);
    expect(result.total).toBe(3);
    expect(result.totalPages).toBe(2);
  });

  it("filters by search, year, price, section, part, and status", () => {
    const result = queryInventory(inventory, {
      ...baseQuery,
      search: "ford f-150",
      section: "Ford & Lincoln",
      part: "trans",
      status: "PENDING",
      yearMin: 2019,
      yearMax: 2021,
      priceMin: 700,
      priceMax: 800,
    });
    expect(result.items.map((item) => item.id)).toEqual(["c"]);
    expect(result.counts).toEqual({ available: 0, pending: 1, crushed: 0 });
  });

  it("clamps an out-of-range page after filtering", () => {
    const result = queryInventory(inventory, { ...baseQuery, page: 99, limit: 2 });
    expect(result.page).toBe(2);
    expect(result.items.map((item) => item.id)).toEqual(["a"]);
  });
});
