import type { PullYardVehicle } from '../types/scrap';
import type { VehiclePartCheck } from '../types/vehicleActivity';

export function vehicleParts(vehicle: PullYardVehicle): VehiclePartCheck[] {
  const checks = new Map((vehicle.partChecks ?? []).map(part => [part.name.toLowerCase(), part]));
  const names = new Map(vehicle.partsRemaining.map(name => [name.toLowerCase(), name]));
  for (const part of checks.values()) names.set(part.name.toLowerCase(), part.name);
  return [...names].map(([key, name]) => checks.get(key) ?? { name, status: 'NOT_CHECKED', checkedBy: '', checkedAt: '' });
}
export function parseVehicleCode(value: string): { id?: string; vin?: string } | null {
  const text = value.trim();
  if (!text || text.length > 2000) return null;
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const staff = url.pathname.match(/^\/yard-vehicles\/([^/]+)\/?$/);
    const publicRecord = url.pathname.match(/^\/inventory\/vehicle\/([^/]+)\/?$/);
    if (staff) return { id: decodeURIComponent(staff[1]) };
    if (publicRecord) return { vin: decodeURIComponent(publicRecord[1]) };
    if (url.pathname === '/vehicles' && url.searchParams.get('vin')) return { vin: url.searchParams.get('vin')! };
    return null;
  } catch {
    if (/^[A-Za-z0-9-]{3,120}$/.test(text)) return text.startsWith('veh-') ? { id: text } : { vin: text.toUpperCase() };
    return null;
  }
}
export function vehiclePublicUrl(vin: string, origin = window.location.origin) {
  return `${origin.replace(/\/$/, '')}/inventory/vehicle/${encodeURIComponent(vin)}`;
}
export function vehiclePreviewSnapshot(vehicle: PullYardVehicle): string {
  return JSON.stringify([vehicle.year, vehicle.make, vehicle.model, vehicle.vin, vehicle.section, vehicle.rowNumber ?? null, vehicle.status, vehicle.dateSetInYard, vehicle.holdUntil ?? null]);
}
