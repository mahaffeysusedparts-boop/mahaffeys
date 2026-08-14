import type { PullYardVehicle } from "@/types/scrap";

export interface InventoryResponse {
  items: PullYardVehicle[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts: {
    available: number;
    pending: number;
    crushed: number;
  };
  updatedAt: string | null;
}

export async function fetchInventory(params: URLSearchParams, signal?: AbortSignal): Promise<InventoryResponse> {
  const response = await fetch(`/api/inventory?${params.toString()}`, {
    credentials: "include",
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Unable to load inventory (${response.status})`);
  return response.json() as Promise<InventoryResponse>;
}
