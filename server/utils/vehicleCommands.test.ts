import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PullYardVehicle } from '../../src/types/scrap';
import { vehiclePreviewSnapshot } from '../../src/utils/vehicleRecords';
const mocks = vi.hoisted(() => ({ body: vi.fn(), user: vi.fn(), read: vi.fn(), transaction: vi.fn(), lock: vi.fn(), put: vi.fn() }));
vi.mock('nitro', () => ({ defineHandler: (handler: unknown) => handler }));
vi.mock('nitro/h3', () => ({ readBody: mocks.body, createError: ({ statusCode, statusMessage }: { statusCode: number; statusMessage: string }) => Object.assign(new Error(statusMessage), { statusCode }) }));
vi.mock('./yardVehicles', () => ({ yardVehicleUser: mocks.user, readYardVehicles: mocks.read }));
vi.mock('./db', () => ({ withTransaction: mocks.transaction }));
vi.mock('./financialState', () => ({ lockFinancialState: mocks.lock, putState: mocks.put }));
import handler from '../routes/api/yard-vehicles/commands.post';
const base: PullYardVehicle = { id: 'veh-1', section: 'Asian Imports', rowNumber: 1, year: 2010, make: 'Honda', model: 'Civic', color: 'Blue', vin: '1HGBH41JXMN109186', dateSetInYard: '2020-01-01T00:00:00Z', status: 'PENDING', partsRemaining: ['Engine'], dismantlingLog: { catalyticConvertersRemoved: 0, wheelsRemoved: 0, gasDrained: false, oilDrained: false } };
let vehicles: PullYardVehicle[];
const target = (vehicle: PullYardVehicle, revision = vehicle.vehicleRevision ?? 0) => ({ id: vehicle.id, revision, snapshot: vehiclePreviewSnapshot(vehicle) });
const invoke = () => (handler as unknown as (event: unknown) => Promise<{ vehicles: PullYardVehicle[]; changedIds: string[] }>)({});
beforeEach(() => {
  vi.clearAllMocks(); vehicles = [structuredClone(base), { ...structuredClone(base), id: 'veh-2', vin: 'NO-VIN-1234' }];
  mocks.user.mockResolvedValue({ id: 'worker', fullName: 'Technician', role: 'yard_employee' });
  mocks.read.mockImplementation(async () => ({ vehicles, settings: {}, layout: [], stored: vehicles, tickets: [] }));
  mocks.transaction.mockImplementation(async callback => callback({}));
  mocks.put.mockImplementation(async (_client, _key, value) => { vehicles = value; });
});
describe('vehicle commands', () => {
  it('commits every bulk change once, together, with history', async () => {
    mocks.body.mockResolvedValue({ action: 'BULK', targets: vehicles.map(vehicle => target(vehicle)), patch: { section: 'European', rowNumber: 4, status: 'AVAILABLE' } });
    const result = await invoke();
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(result.changedIds).toEqual(['veh-1','veh-2']);
    expect(result.vehicles.every(vehicle => vehicle.section === 'European' && vehicle.rowNumber === 4 && vehicle.status === 'AVAILABLE')).toBe(true);
    expect(result.vehicles[0].history?.map(event => event.kind)).toEqual(['LOCATION','STATUS']);
  });
  it('applies nothing if any selected revision changed after preview', async () => {
    vehicles[1].vehicleRevision = 2;
    mocks.body.mockResolvedValue({ action: 'BULK', targets: vehicles.map(vehicle => target(vehicle, 0)), patch: { rowNumber: 4 } });
    await expect(invoke()).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.put).not.toHaveBeenCalled();
    expect(vehicles[0].rowNumber).toBe(1);
  });
  it('also rejects ticket-derived changes that have no materialized revision yet', async () => {
    const preview = vehicles.map(vehicle => target(vehicle));
    vehicles[1].vin = 'NO-VIN-9999';
    mocks.body.mockResolvedValue({ action: 'BULK', targets: preview, patch: { rowNumber: 4 } });
    await expect(invoke()).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.put).not.toHaveBeenCalled();
  });
  it('blocks the whole batch when one selected vehicle is under a crush hold', async () => {
    vehicles[1].holdUntil = new Date(Date.now() + 30 * 86400000).toISOString();
    mocks.body.mockResolvedValue({ action: 'BULK', targets: vehicles.map(vehicle => target(vehicle)), patch: { status: 'CRUSHED' } });
    await expect(invoke()).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.put).not.toHaveBeenCalled();
    expect(vehicles[0].status).toBe('PENDING');
  });
  it('records real part check attribution and keeps removed parts in the timeline', async () => {
    mocks.body.mockResolvedValue({ action: 'PART', target: target(vehicles[0]), name: 'engine', status: 'AVAILABLE', notes: 'Checked in row 1' });
    await invoke();
    expect(vehicles[0].partChecks?.[0]).toMatchObject({ name: 'Engine', status: 'AVAILABLE', checkedBy: 'Technician', notes: 'Checked in row 1' });
    expect(vehicles[0].partsRemaining).toEqual(['Engine']);
    mocks.body.mockResolvedValue({ action: 'PART', target: target(vehicles[0]), name: 'Engine', status: 'REMOVED' });
    await invoke();
    expect(vehicles[0].partsRemaining).toEqual([]);
    expect(vehicles[0].partChecks?.[0].status).toBe('REMOVED');
    expect(vehicles[0].history?.at(-1)).toMatchObject({ kind: 'PART', actor: 'Technician', description: 'Engine: removed.' });
  });
  it('rejects client-supplied audit identities and arbitrary photo protocols', async () => {
    mocks.body.mockResolvedValue({ action: 'PART', target: target(vehicles[0]), name: 'Engine', status: 'AVAILABLE', checkedBy: 'Administrator' });
    await expect(invoke()).rejects.toMatchObject({ statusCode: 400 });
    mocks.body.mockResolvedValue({ action: 'PHOTO', target: target(vehicles[0]), photoUrl: 'javascript:alert(1)' });
    await expect(invoke()).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.put).not.toHaveBeenCalled();
  });
  it('saves dismantling, the optional available status and history together', async () => {
    mocks.body.mockResolvedValue({ action: 'PROCESS', target: target(vehicles[0]), makeAvailable: true, log: {
      catalyticConvertersRemoved: 1, wheelsRemoved: 4, gasDrained: true, oilDrained: true, notes: 'Ready for the yard',
    } });
    await invoke();
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(vehicles[0].status).toBe('AVAILABLE');
    expect(vehicles[0].vehicleRevision).toBe(1);
    expect(vehicles[0].dismantlingLog).toMatchObject({ catalyticConvertersRemoved: 1, wheelsRemoved: 4, gasDrained: true, oilDrained: true, updatedAt: expect.any(String) });
    expect(vehicles[0].history?.map(event => event.kind)).toEqual(['STATUS', 'PART', 'PART', 'PROCESSING']);
    expect(vehicles[0].history?.every(event => event.actor === 'Technician' && event.at === vehicles[0].dismantlingLog.updatedAt)).toBe(true);
    expect(vehicles[0].partsRemaining).toEqual(['Engine']);
    expect(vehicles[0].partChecks).toEqual([]);
  });
  it('retains earlier removed quantities in history when a count is corrected', async () => {
    mocks.body.mockResolvedValue({ action: 'PROCESS', target: target(vehicles[0]), makeAvailable: false, log: { ...base.dismantlingLog, wheelsRemoved: 4 } });
    await invoke();
    const history = [...vehicles[0].history!];
    mocks.body.mockResolvedValue({ action: 'PROCESS', target: target(vehicles[0]), makeAvailable: false, log: { ...base.dismantlingLog, wheelsRemoved: 2, notes: 'Corrected the count' } });
    await invoke();
    expect(vehicles[0].history?.slice(0, history.length)).toEqual(history);
    expect(vehicles[0].history?.at(-1)?.description).toContain('wheels removed: 4 → 2');
    expect(vehicles[0].dismantlingLog.wheelsRemoved).toBe(2);
    expect(vehicles[0].status).toBe('PENDING');
  });
  it('rejects stale dismantling saves without applying the available status', async () => {
    const preview = target(vehicles[0]);
    vehicles[0].vehicleRevision = 1;
    mocks.body.mockResolvedValue({ action: 'PROCESS', target: preview, makeAvailable: true, log: { ...base.dismantlingLog, wheelsRemoved: 4 } });
    await expect(invoke()).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.put).not.toHaveBeenCalled();
    expect(vehicles[0].status).toBe('PENDING');
    expect(vehicles[0].dismantlingLog.wheelsRemoved).toBe(0);
  });
  it.each([-1, 1.5, 9])('rejects an invalid wheel count of %s rather than silently clamping it', async wheelsRemoved => {
    mocks.body.mockResolvedValue({ action: 'PROCESS', target: target(vehicles[0]), makeAvailable: false, log: { ...base.dismantlingLog, wheelsRemoved } });
    await expect(invoke()).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.put).not.toHaveBeenCalled();
  });
  it('does not reopen a crushed vehicle through the dismantling action', async () => {
    vehicles[0].status = 'CRUSHED';
    mocks.body.mockResolvedValue({ action: 'PROCESS', target: target(vehicles[0]), makeAvailable: true, log: base.dismantlingLog });
    await expect(invoke()).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.put).not.toHaveBeenCalled();
  });
  it('rejects a caller-provided dismantling timestamp', async () => {
    mocks.body.mockResolvedValue({ action: 'PROCESS', target: target(vehicles[0]), makeAvailable: false, log: { ...base.dismantlingLog, updatedAt: '2020-01-01T00:00:00Z' } });
    await expect(invoke()).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.put).not.toHaveBeenCalled();
  });
});
