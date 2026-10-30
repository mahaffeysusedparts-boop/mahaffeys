import { describe, expect, it } from 'vitest';
import type { PullYardVehicle, YardMapItem } from '../../src/types/scrap';
import { protectVehicleChanges, recordVehicleChanges } from './vehicleActivity';
import { trackVehicleMapChanges } from './vehicleMapHistory';

const base: PullYardVehicle = { id: 'veh-1', section: 'Asian Imports', rowNumber: 1, year: 2010, make: 'Honda', model: 'Civic', color: 'Blue', vin: '1HGBH41JXMN109186', dateSetInYard: '2020-01-01T00:00:00Z', status: 'PENDING', partsRemaining: ['Engine', 'Wheels'], dismantlingLog: { catalyticConvertersRemoved: 0, wheelsRemoved: 0, gasDrained: false, oilDrained: false } };
const hold = { enabled: true, crushHoldDays: 30 };
const at = '2026-01-01T12:00:00Z';
describe('vehicle history', () => {
  it('records location, status, photos and removed quantities with the server actor', () => {
    const next = recordVehicleChanges(base, { ...base, rowNumber: 2, status: 'AVAILABLE', photoUrl: 'https://yard.example/photo.jpg', dismantlingLog: { ...base.dismantlingLog, wheelsRemoved: 2 } }, 'Technician', at);
    expect(next.history?.map(event => event.kind)).toEqual(['LOCATION', 'STATUS', 'PHOTO', 'PART', 'PROCESSING']);
    expect(next.history?.every(event => event.actor === 'Technician' && event.at === at)).toBe(true);
    expect(next.vehicleRevision).toBe(1);
  });
  it('preserves an earlier photo when replacing the primary image', () => {
    const next = recordVehicleChanges({ ...base, photoUrl: 'https://yard.example/old.jpg' }, { ...base, photoUrl: 'https://yard.example/new.jpg' }, 'Technician', at);
    expect(next.history?.map(event => event.photoUrl)).toContain('https://yard.example/old.jpg');
    expect(next.history?.map(event => event.photoUrl)).toContain('https://yard.example/new.jpg');
  });
  it('retains removed parts with who recorded removal and when', () => {
    const next = recordVehicleChanges(base, { ...base, partsRemaining: ['Engine'] }, 'Technician', at);
    expect(next.partChecks).toEqual([{ name: 'Wheels', status: 'REMOVED', checkedBy: 'Technician', checkedAt: at }]);
  });
  it('rejects stale edits and never replaces server history or checks from sync', () => {
    const old = recordVehicleChanges(base, { ...base, rowNumber: 2 }, 'Technician', at);
    expect(() => protectVehicleChanges([old], [{ ...base, rowNumber: 3 }], 'Other user', 'yard_employee', hold)).toThrow('changed on another workstation');
    const forged = { ...old, history: [], partChecks: [{ name: 'Engine', status: 'AVAILABLE', checkedBy: 'Forged', checkedAt: at }] };
    expect(protectVehicleChanges([old], [forged], 'Other user', 'yard_employee', hold)[0]).toEqual(old);
    expect(protectVehicleChanges([old], [], 'Other user', 'yard_employee', hold)).toEqual([old]);
  });
  it('does not fabricate processing events for JSONB key ordering changes', () => {
    const log = Object.fromEntries(Object.entries(base.dismantlingLog).reverse()) as unknown as PullYardVehicle['dismantlingLog'];
    expect(recordVehicleChanges(base, { ...base, rowNumber: 2, dismantlingLog: log }, 'Technician', at).history?.map(event => event.kind)).toEqual(['LOCATION']);
  });
  it('blocks held crush changes and unauthorized override attribution', () => {
    const held = { ...base, holdUntil: new Date(Date.now() + 30 * 86400000).toISOString() };
    expect(() => protectVehicleChanges([held], [{ ...held, status: 'CRUSHED' }], 'Worker', 'yard_employee', hold)).toThrow('title hold');
    expect(() => protectVehicleChanges([held], [{ ...held, status: 'CRUSHED', holdOverride: { by: 'Admin', at, reason: 'Bypass' } }], 'Worker', 'yard_employee', hold)).toThrow('administrator');
  });
  it('records map placement, movement and unlinking without duplicating unchanged layouts', () => {
    const marker: YardMapItem = { id: 'marker-1', type: 'CAR', label: 'Honda', x: 10, y: 20, width: 40, height: 60, rotation: 0, color: '#0284c7', linkedEntityType: 'VEHICLE', linkedEntityId: base.id };
    const placed = trackVehicleMapChanges([base], [], [marker], 'Worker');
    expect(placed[0].history?.[0].kind).toBe('LOCATION');
    expect(trackVehicleMapChanges(placed, [marker], [marker], 'Worker')[0]).toBe(placed[0]);
    const moved = trackVehicleMapChanges(placed, [marker], [{ ...marker, x: 50 }], 'Worker');
    expect(moved[0].history?.at(-1)?.description).toContain('(50, 20)');
    expect(trackVehicleMapChanges(moved, [{ ...marker, x: 50 }], [], 'Worker')[0].history?.at(-1)?.description).toContain('unlinked');
  });
});
