import type { PullYardVehicle, YardMapItem } from '@/types/scrap';
import type { PartAvailabilityStatus } from '@/types/vehicleActivity';
import { sharedStorage } from './sharedStorage';
import { vehiclePreviewSnapshot } from '@/utils/vehicleRecords';

export interface VehicleRecordResponse {
  vehicle: PullYardVehicle;
  mapItems: YardMapItem[];
  intake: { id: string; at: string; actor: string; photos: string[] } | null;
}
export type VehiclePatch = { section?: PullYardVehicle['section']; rowNumber?: number | null; status?: PullYardVehicle['status'] };
export type VehicleTarget = { id: string; revision: number; snapshot: string };
export function vehicleTarget(vehicle: PullYardVehicle): VehicleTarget {
  return { id: vehicle.id, revision: vehicle.vehicleRevision ?? 0, snapshot: vehiclePreviewSnapshot(vehicle) };
}
export type VehicleCommand =
  | { action: 'BULK'; targets: VehicleTarget[]; patch: VehiclePatch }
  | { action: 'PART'; target: VehicleTarget; name: string; status: PartAvailabilityStatus; notes?: string }
  | { action: 'PROCESS'; target: VehicleTarget; log: Omit<PullYardVehicle['dismantlingLog'], 'updatedAt'>; makeAvailable: boolean }
  | { action: 'PHOTO'; target: VehicleTarget; photoUrl: string };

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'include', cache: 'no-store', ...options, headers: { 'Content-Type': 'application/json' } });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw new Error(result?.statusMessage || result?.message || `Unable to load vehicle records (${response.status})`);
  return result as T;
}
export async function fetchYardVehicles(): Promise<PullYardVehicle[]> {
  return (await request<{ vehicles: PullYardVehicle[] }>('/api/yard-vehicles')).vehicles;
}
export function fetchVehicleRecord(id: string): Promise<VehicleRecordResponse> {
  return request(`/api/yard-vehicles/${encodeURIComponent(id)}`);
}
export function resolveVehicleCode(identifier: { id?: string; vin?: string }): Promise<{ id: string }> {
  const params = new URLSearchParams();
  if (identifier.id) params.set('id', identifier.id);
  if (identifier.vin) params.set('vin', identifier.vin);
  return request(`/api/yard-vehicles/resolve?${params.toString()}`);
}
export async function sendVehicleCommand(command: VehicleCommand) {
  const result = await request<{ vehicles: PullYardVehicle[]; changedIds: string[] }>('/api/yard-vehicles/commands', { method: 'POST', body: JSON.stringify(command) });
  sharedStorage.applyServerValue('mahaffeys_pull_yard_vehicles', result.vehicles);
  return result;
}
