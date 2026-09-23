import { storageService } from "./storageService";
import type { EquipmentItem, MaintenanceLogEntry, ToolItem, ToolCheckout } from "@/types/scrap";

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseDate(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / 86_400_000;
}

// ── Equipment due math ───────────────────────────────────────────────────────

export interface EquipmentDueInfo {
  item: EquipmentItem;
  daysUntilDue: number | null; // null if no due date
  isOverdue: boolean;
  isDueSoon: boolean; // within threshold days
}

export function getEquipmentDueInfo(
  item: EquipmentItem,
  thresholdDays: number = 7
): EquipmentDueInfo {
  const due = parseDate(item.nextServiceDue);
  if (!due) return { item, daysUntilDue: null, isOverdue: false, isDueSoon: false };
  const now = new Date();
  const days = daysBetween(now, due);
  const isOverdue = due < now;
  const isDueSoon = !isOverdue && days <= thresholdDays;
  return { item, daysUntilDue: Math.round(days), isOverdue, isDueSoon };
}

export function getOverdueEquipment(thresholdDays: number = 7): EquipmentDueInfo[] {
  const equipment = storageService.getEquipment();
  return equipment
    .map((item) => getEquipmentDueInfo(item, thresholdDays))
    .filter((info) => info.isOverdue || info.isDueSoon);
}

// ── Maintenance actions ──────────────────────────────────────────────────────

export interface MaintenancePayload {
  equipmentId: string;
  completedAt?: string;
  notes: string;
  meterReading?: number;
  performedBy?: string;
  taskType?: MaintenanceLogEntry["taskType"];
  cost?: number;
  vendor?: string;
  downtimeHours?: number;
}

export function addMaintenanceLog(payload: MaintenancePayload): MaintenanceLogEntry {
  const log: MaintenanceLogEntry = {
    id: `maint-${Date.now()}`,
    equipmentId: payload.equipmentId,
    completedAt: payload.completedAt || new Date().toISOString(),
    notes: payload.notes,
    meterReading: payload.meterReading,
    performedBy: payload.performedBy,
    taskType: payload.taskType,
    cost: payload.cost,
    vendor: payload.vendor,
    downtimeHours: payload.downtimeHours,
  };
  storageService.saveMaintenanceLog(log);

  // Update equipment's lastServiceDate and bump nextServiceDue if interval is set
  const equipment = storageService.getEquipment();
  const idx = equipment.findIndex((e) => e.id === payload.equipmentId);
  if (idx >= 0) {
    const updated = { ...equipment[idx] };
    updated.lastServiceDate = log.completedAt;
    if (payload.meterReading !== undefined) updated.meterReading = payload.meterReading;
    if (updated.serviceIntervalDays) {
      const due = new Date(log.completedAt);
      due.setDate(due.getDate() + updated.serviceIntervalDays);
      updated.nextServiceDue = due.toISOString();
    }
    storageService.saveEquipment(updated);
  }
  return log;
}

// ── Tool checkout actions ────────────────────────────────────────────────────

export interface CheckoutPayload {
  toolId: string;
  checkedOutBy: string;
  checkedOutById?: string;
  dueBackAt?: string;
  conditionOnCheckout?: string;
  notes?: string;
}

export function checkoutTool(payload: CheckoutPayload): ToolCheckout {
  const checkout: ToolCheckout = {
    id: `co-${Date.now()}`,
    toolId: payload.toolId,
    checkedOutBy: payload.checkedOutBy,
    checkedOutById: payload.checkedOutById,
    checkedOutAt: new Date().toISOString(),
    dueBackAt: payload.dueBackAt,
    conditionOnCheckout: payload.conditionOnCheckout,
    notes: payload.notes,
  };
  storageService.saveToolCheckout(checkout);

  // Update tool status to Out
  const tools = storageService.getTools();
  const tool = tools.find((t) => t.id === payload.toolId);
  if (tool) {
    storageService.saveTool({ ...tool, status: "Out" });
  }
  return checkout;
}

export function checkinTool(checkoutId: string, conditionOnCheckin?: string, checkedInBy?: string): ToolCheckout | null {
  const checkouts = storageService.getToolCheckouts();
  const idx = checkouts.findIndex((c) => c.id === checkoutId);
  if (idx < 0) return null;
  const updated = {
    ...checkouts[idx],
    checkedInAt: new Date().toISOString(),
    conditionOnCheckin,
    checkedInBy,
  };
  storageService.saveToolCheckout(updated);

  // Update tool status back to Available
  const tool = storageService.getTools().find((t) => t.id === updated.toolId);
  if (tool) {
    storageService.saveTool({ ...tool, status: "Available" });
  }
  return updated;
}

export function getOverdueCheckouts(): ToolCheckout[] {
  const checkouts = storageService.getToolCheckouts();
  const now = new Date();
  return checkouts.filter((c) => {
    if (c.checkedInAt) return false;
    if (!c.dueBackAt) return false;
    return new Date(c.dueBackAt) < now;
  });
}

// ── KPIs ─────────────────────────────────────────────────────────────────────

export interface FleetKPIs {
  totalEquipment: number;
  equipmentActive: number;
  equipmentDown: number;
  equipmentRetired: number;
  overdueServiceCount: number;
  dueSoonCount: number;
  totalTools: number;
  toolsAvailable: number;
  toolsOut: number;
  toolsMissing: number;
  overdueCheckouts: number;
}

export function getFleetKPIs(thresholdDays: number = 7): FleetKPIs {
  const equipment = storageService.getEquipment();
  const tools = storageService.getTools();
  const checkouts = storageService.getToolCheckouts();

  const overdueService: EquipmentDueInfo[] = [];
  const dueSoon: EquipmentDueInfo[] = [];
  equipment.forEach((item) => {
    const info = getEquipmentDueInfo(item, thresholdDays);
    if (info.isOverdue) overdueService.push(info);
    else if (info.isDueSoon) dueSoon.push(info);
  });

  const overdueCheckouts = getOverdueCheckouts();

  return {
    totalEquipment: equipment.length,
    equipmentActive: equipment.filter((e) => e.status === "Active").length,
    equipmentDown: equipment.filter((e) => e.status === "Down for service").length,
    equipmentRetired: equipment.filter((e) => e.status === "Retired").length,
    overdueServiceCount: overdueService.length,
    dueSoonCount: dueSoon.length,
    totalTools: tools.length,
    toolsAvailable: tools.filter((t) => t.status === "Available").length,
    toolsOut: tools.filter((t) => t.status === "Out").length,
    toolsMissing: tools.filter((t) => t.status === "Missing").length,
    overdueCheckouts: overdueCheckouts.length,
  };
}
