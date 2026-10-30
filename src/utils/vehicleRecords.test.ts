import { describe, expect, it } from 'vitest';
import type { PullYardVehicle } from '../types/scrap';
import { parseVehicleCode, vehicleParts, vehiclePublicUrl } from './vehicleRecords';

const vehicle = { partsRemaining: ['Engine', 'Doors'], partChecks: [{ name: 'engine', status: 'AVAILABLE', checkedBy: 'Alex', checkedAt: '2026-01-01T12:00:00Z' }, { name: 'Wheels', status: 'REMOVED', checkedBy: 'Sam', checkedAt: '2026-01-02T12:00:00Z' }] } as PullYardVehicle;
describe('vehicle record helpers', () => {
  it('keeps unverified legacy parts unchecked and retains removed components', () => {
    expect(vehicleParts(vehicle)).toEqual([
      vehicle.partChecks![0], { name: 'Doors', status: 'NOT_CHECKED', checkedBy: '', checkedAt: '' }, vehicle.partChecks![1],
    ]);
  });
  it('recognizes current and previously printed QR formats without navigating to external hosts', () => {
    expect(parseVehicleCode('https://yard.example/inventory/vehicle/1HGBH41JXMN109186')).toEqual({ vin: '1HGBH41JXMN109186' });
    expect(parseVehicleCode('https://yard.example/vehicles?vin=NO-VIN-1234')).toEqual({ vin: 'NO-VIN-1234' });
    expect(parseVehicleCode('https://yard.example/yard-vehicles/veh-123')).toEqual({ id: 'veh-123' });
    expect(parseVehicleCode('1hgbh41jxmn109186')).toEqual({ vin: '1HGBH41JXMN109186' });
    expect(parseVehicleCode('veh-ticket-123')).toEqual({ id: 'veh-ticket-123' });
  });
  it('rejects unrelated URLs and executable protocols', () => {
    expect(parseVehicleCode('https://example.com/phishing')).toBeNull();
    expect(parseVehicleCode('javascript:alert(1)')).toBeNull();
    expect(parseVehicleCode('')).toBeNull();
  });
  it('prints an encoded direct detail URL rather than a catalog search', () => {
    expect(vehiclePublicUrl('NO-VIN-1234', 'https://yard.example/')).toBe('https://yard.example/inventory/vehicle/NO-VIN-1234');
  });
});
