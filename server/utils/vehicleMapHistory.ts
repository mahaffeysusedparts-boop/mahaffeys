import { randomUUID } from 'node:crypto';
import type { PullYardVehicle, YardMapItem } from '../../src/types/scrap';

export function trackVehicleMapChanges(vehicles: PullYardVehicle[], previous: YardMapItem[], next: YardMapItem[], actor: string) {
  const changes = new Map<string, string[]>();
  const markers = new Set([...previous, ...next].filter(item => item.linkedEntityType === 'VEHICLE').map(item => item.id));
  for (const id of markers) {
    const old = previous.find(item => item.id === id && !item.deletedAt);
    const item = next.find(row => row.id === id && !row.deletedAt);
    const oldVehicle = old?.linkedEntityType === 'VEHICLE' ? old.linkedEntityId : undefined;
    const newVehicle = item?.linkedEntityType === 'VEHICLE' ? item.linkedEntityId : undefined;
    const add = (vehicleId: string, text: string) => changes.set(vehicleId, [...(changes.get(vehicleId) ?? []), text]);
    if (oldVehicle && oldVehicle !== newVehicle) add(oldVehicle, `Yard map marker ${old?.label || id} removed or unlinked.`);
    if (newVehicle && oldVehicle !== newVehicle) add(newVehicle, `Yard map marker placed at (${item!.x}, ${item!.y}).`);
    else if (newVehicle && old && item && (old.x !== item.x || old.y !== item.y || old.rotation !== item.rotation)) add(newVehicle, `Yard map marker moved from (${old.x}, ${old.y}) to (${item.x}, ${item.y}); rotation ${item.rotation}°.`);
  }
  const at = new Date().toISOString();
  return vehicles.map(vehicle => changes.has(vehicle.id) ? { ...vehicle, vehicleRevision: (vehicle.vehicleRevision ?? 0) + 1,
    history: [...(vehicle.history ?? []), ...changes.get(vehicle.id)!.map(description => ({ id: randomUUID(), kind: 'LOCATION' as const, at, actor, description }))] } : vehicle);
}
