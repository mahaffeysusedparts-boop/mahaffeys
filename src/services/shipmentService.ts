import { apiRequest } from './apiClient';
import { sharedStorage } from './sharedStorage';
import { storageService } from './storageService';
import type { OutboundShipment, ShipmentSettlement } from '@/types/scrap';
import { shipmentSnapshot } from '@/utils/shipments';

async function command(shipment: OutboundShipment, action: 'SETTLE' | 'VOID', details: Record<string, unknown>, expectedSnapshot = shipmentSnapshot(shipment)) {
  // Dispatch/delivery still use shared state. Finish those saves before settling.
  await sharedStorage.flushNow();
  const saved = await apiRequest<OutboundShipment>('/api/shipments/commands', {
    method: 'POST', body: JSON.stringify({ id: shipment.id, action, expectedSnapshot, ...details }),
  });
  sharedStorage.applyServerValue('mahaffeys_shipments', storageService.getShipments().map(load => load.id === saved.id ? saved : load));
  return saved;
}

export const shipmentService = {
  settle: (shipment: OutboundShipment, settlement: Omit<ShipmentSettlement, 'settledAt' | 'actualRatePerLb'>, expectedSnapshot: string) => command(shipment, 'SETTLE', { settlement }, expectedSnapshot),
  void: (shipment: OutboundShipment, reason: string) => command(shipment, 'VOID', { reason }),
};
