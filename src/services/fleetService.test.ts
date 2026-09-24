import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { EquipmentItem, MaintenanceLogEntry, ToolCheckout, ToolItem } from '@/types/scrap';

const stores = vi.hoisted(() => {
  const state = {
    equipment: [] as EquipmentItem[],
    tools: [] as ToolItem[],
    checkouts: [] as ToolCheckout[],
    maintenance: [] as MaintenanceLogEntry[],
  };
  return state;
});

vi.mock('./storageService', () => ({
  storageService: {
    getEquipment: () => [...stores.equipment],
    saveEquipment: (item: EquipmentItem) => {
      const index = stores.equipment.findIndex((existing) => existing.id === item.id);
      if (index >= 0) stores.equipment[index] = item;
      else stores.equipment.push(item);
    },
    getTools: () => [...stores.tools],
    saveTool: (tool: ToolItem) => {
      const index = stores.tools.findIndex((existing) => existing.id === tool.id);
      if (index >= 0) stores.tools[index] = tool;
      else stores.tools.push(tool);
    },
    getToolCheckouts: () => [...stores.checkouts],
    saveToolCheckout: (checkout: ToolCheckout) => {
      const index = stores.checkouts.findIndex((existing) => existing.id === checkout.id);
      if (index >= 0) stores.checkouts[index] = checkout;
      else stores.checkouts.push(checkout);
    },
    getMaintenanceLogs: () => [...stores.maintenance],
    saveMaintenanceLog: (log: MaintenanceLogEntry) => {
      stores.maintenance.push(log);
    },
  },
}));

import {
  addMaintenanceLog,
  checkinTool,
  checkoutTool,
  getEquipmentDueInfo,
  getFleetKPIs,
  getOverdueCheckouts,
  getOverdueEquipment,
} from './fleetService';

const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const daysAgo = (days: number) => daysFromNow(-days);

const equipment = (overrides: Partial<EquipmentItem> = {}): EquipmentItem => ({
  id: 'eq-1',
  name: 'Loader #1',
  assetType: 'Loader',
  meterLabel: 'Hours',
  meterReading: 100,
  nextServiceDue: daysFromNow(30),
  ...overrides,
});

const tool = (overrides: Partial<ToolItem> = {}): ToolItem => ({
  id: 'tool-1',
  code: 'IW-01',
  name: 'Impact Wrench',
  category: 'Power Tool',
  status: 'Available',
  homeLocation: 'Tool Crib A',
  createdAt: daysAgo(60),
  updatedAt: daysAgo(60),
  ...overrides,
});

beforeEach(() => {
  stores.equipment = [];
  stores.tools = [];
  stores.checkouts = [];
  stores.maintenance = [];
});

describe('getEquipmentDueInfo', () => {
  it('flags equipment past its due date as overdue', () => {
    const info = getEquipmentDueInfo(equipment({ nextServiceDue: daysAgo(3) }));
    expect(info.isOverdue).toBe(true);
    expect(info.isDueSoon).toBe(false);
    expect(info.daysUntilDue).toBe(3);
  });

  it('flags equipment due within the threshold as due soon', () => {
    const info = getEquipmentDueInfo(equipment({ nextServiceDue: daysFromNow(5) }), 7);
    expect(info.isOverdue).toBe(false);
    expect(info.isDueSoon).toBe(true);
  });

  it('keeps on-schedule equipment clear of both flags', () => {
    const info = getEquipmentDueInfo(equipment({ nextServiceDue: daysFromNow(20) }), 7);
    expect(info.isOverdue).toBe(false);
    expect(info.isDueSoon).toBe(false);
  });

  it('tolerates a missing due date', () => {
    const info = getEquipmentDueInfo(equipment({ nextServiceDue: '' }));
    expect(info.daysUntilDue).toBeNull();
    expect(info.isOverdue).toBe(false);
    expect(info.isDueSoon).toBe(false);
  });
});

describe('getOverdueEquipment', () => {
  it('returns only overdue and due-soon items', () => {
    stores.equipment = [
      equipment({ id: 'a', nextServiceDue: daysAgo(1) }),
      equipment({ id: 'b', nextServiceDue: daysFromNow(3) }),
      equipment({ id: 'c', nextServiceDue: daysFromNow(60) }),
    ];
    const result = getOverdueEquipment(7);
    expect(result.map((info) => info.item.id).sort()).toEqual(['a', 'b']);
  });
});

describe('addMaintenanceLog', () => {
  it('records the log and stamps the equipment service dates', () => {
    stores.equipment = [equipment({ serviceIntervalDays: 30, meterReading: 100 })];
    const log = addMaintenanceLog({
      equipmentId: 'eq-1',
      completedAt: '2026-01-10T12:00:00.000Z',
      notes: 'Oil + filters',
      meterReading: 150,
      performedBy: 'Dale',
    });

    expect(stores.maintenance).toHaveLength(1);
    expect(log.equipmentId).toBe('eq-1');
    expect(log.meterReading).toBe(150);

    const updated = stores.equipment[0];
    expect(updated.meterReading).toBe(150);
    expect(updated.lastServiceDate).toBe('2026-01-10T12:00:00.000Z');
    // Next due date rolls forward by the service interval.
    expect(new Date(updated.nextServiceDue).toISOString()).toBe('2026-02-09T12:00:00.000Z');
  });

  it('leaves the due date alone when no interval is configured', () => {
    const due = daysFromNow(15);
    stores.equipment = [equipment({ nextServiceDue: due, serviceIntervalDays: undefined })];
    addMaintenanceLog({ equipmentId: 'eq-1', notes: 'Inspection' });
    expect(stores.equipment[0].nextServiceDue).toBe(due);
  });
});

describe('tool checkouts', () => {
  it('marks the tool Out when checked out', () => {
    stores.tools = [tool()];
    const checkout = checkoutTool({ toolId: 'tool-1', checkedOutBy: 'Marcus', dueBackAt: daysFromNow(1) });

    expect(checkout.checkedOutAt).toBeTruthy();
    expect(checkout.checkedInAt).toBeUndefined();
    expect(stores.tools[0].status).toBe('Out');
    expect(stores.checkouts).toHaveLength(1);
  });

  it('marks the tool Available when checked back in', () => {
    stores.tools = [tool({ status: 'Out' })];
    stores.checkouts = [{
      id: 'co-1',
      toolId: 'tool-1',
      checkedOutBy: 'Marcus',
      checkedOutAt: daysAgo(2),
      dueBackAt: daysAgo(1),
    }];

    const result = checkinTool('co-1', 'Good', 'Dale');
    expect(result?.checkedInAt).toBeTruthy();
    expect(result?.conditionOnCheckin).toBe('Good');
    expect(stores.tools[0].status).toBe('Available');
  });

  it('returns null when checking in an unknown checkout', () => {
    expect(checkinTool('missing')).toBeNull();
  });

  it('lists only open checkouts past their due-back date', () => {
    stores.checkouts = [
      { id: 'open-late', toolId: 't1', checkedOutBy: 'A', checkedOutAt: daysAgo(3), dueBackAt: daysAgo(1) },
      { id: 'open-ontime', toolId: 't2', checkedOutBy: 'B', checkedOutAt: daysAgo(1), dueBackAt: daysFromNow(1) },
      { id: 'returned-late', toolId: 't3', checkedOutBy: 'C', checkedOutAt: daysAgo(5), dueBackAt: daysAgo(2), checkedInAt: daysAgo(2) },
      { id: 'open-nodue', toolId: 't4', checkedOutBy: 'D', checkedOutAt: daysAgo(1) },
    ];
    expect(getOverdueCheckouts().map((checkout) => checkout.id)).toEqual(['open-late']);
  });
});

describe('getFleetKPIs', () => {
  it('aggregates equipment, tool, and checkout counts', () => {
    stores.equipment = [
      equipment({ id: 'a', status: 'Active', nextServiceDue: daysAgo(2) }),
      equipment({ id: 'b', status: 'Active', nextServiceDue: daysFromNow(90) }),
      equipment({ id: 'c', status: 'Down for service', nextServiceDue: daysFromNow(90) }),
      equipment({ id: 'd', status: 'Retired', nextServiceDue: daysFromNow(90) }),
    ];
    stores.tools = [
      tool({ id: 't1', status: 'Available' }),
      tool({ id: 't2', status: 'Out' }),
      tool({ id: 't3', status: 'Out' }),
      tool({ id: 't4', status: 'Missing' }),
    ];
    stores.checkouts = [
      { id: 'co-1', toolId: 't2', checkedOutBy: 'A', checkedOutAt: daysAgo(3), dueBackAt: daysAgo(1) },
    ];

    const kpis = getFleetKPIs(7);
    expect(kpis.totalEquipment).toBe(4);
    expect(kpis.equipmentActive).toBe(2);
    expect(kpis.equipmentDown).toBe(1);
    expect(kpis.equipmentRetired).toBe(1);
    expect(kpis.overdueServiceCount).toBe(1);
    expect(kpis.totalTools).toBe(4);
    expect(kpis.toolsAvailable).toBe(1);
    expect(kpis.toolsOut).toBe(2);
    expect(kpis.toolsMissing).toBe(1);
    expect(kpis.overdueCheckouts).toBe(1);
  });
});
