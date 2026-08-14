import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchInventory } from "./inventoryService";

const payload = {
  items: [], total: 0, page: 2, limit: 24, totalPages: 3,
  counts: { available: 0, pending: 0, crushed: 0 }, updatedAt: null,
};

afterEach(() => vi.unstubAllGlobals());

describe("fetchInventory", () => {
  it("sends persisted query parameters to the inventory endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) });
    vi.stubGlobal("fetch", fetchMock);
    const params = new URLSearchParams({ page: "2", search: "Honda Civic", sort: "year_desc" });

    await expect(fetchInventory(params)).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/inventory?page=2&search=Honda+Civic&sort=year_desc",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("surfaces an unsuccessful API response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(fetchInventory(new URLSearchParams())).rejects.toThrow("Unable to load inventory (503)");
  });
});
