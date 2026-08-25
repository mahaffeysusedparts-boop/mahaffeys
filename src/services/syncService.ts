import { apiRequest } from "./apiClient";
import { sharedStorage } from "./sharedStorage";
import { toast } from "sonner";

const SHARED_KEYS = [
  "mahaffeys_metals",
  "mahaffeys_car_rates",
  "mahaffeys_customers",
  "mahaffeys_tickets",
  "mahaffeys_settings",
  "mahaffeys_nmvtis_logs",
  "mahaffeys_cat_codes",
  "mahaffeys_container_drops",
  "mahaffeys_cash_drawer",
  "mahaffeys_yard_bays",
  "mahaffeys_pull_parts",
  "mahaffeys_pull_yard_vehicles",
  "mahaffeys_removed_inventory_vehicles",
  "mahaffeys_core_returns",
  "mahaffeys_admission_passes",
  "mahaffeys_ip_cameras",
  "mahaffeys_shipments",
  "mahaffeys_mills",
  "mahaffeys_timeclock",
  "mahaffeys_checklists",
  "mahaffeys_tasks",
  "mahaffeys_equipment",
  "mahaffeys_maintenance_logs",
  "mahaffeys_rate_history",
  "mahaffeys_operations_goals",
  "mahaffeys_operations_alert_rules",
  "mahaffeys_operations_alerts",
  "mahaffeys_operations_summaries",
] as const;

const LOCAL_USER_KEY = "mahaffeys_sync_user_id";
const POLL_INTERVAL_MS = 10_000;
const SLOW_POLL_INTERVAL_MS = 60_000;
const MERGE_KEYS = new Set(["mahaffeys_tickets", "mahaffeys_pull_yard_vehicles"]);

interface SinceEntry {
  key: string;
  value: unknown;
  updatedAt: string;
  updatedBy: string | null;
}

interface SinceResponse {
  entries: SinceEntry[];
  serverTime: string;
  count: number;
}

type SyncStatus = "idle" | "polling" | "error";
type SyncListener = (status: SyncStatus, lastSyncedAt: number) => void;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeRecord(local: Record<string, unknown>, remote: Record<string, unknown>) {
  const merged: Record<string, unknown> = { ...remote, ...local };
  for (const field of ["carRecord", "complianceCaptures"]) {
    if (isRecord(remote[field]) && isRecord(local[field])) {
      merged[field] = { ...remote[field], ...local[field] };
    }
  }
  return merged;
}

function mergeArrays(localValue: unknown, remoteValue: unknown): unknown {
  if (!Array.isArray(localValue) || !Array.isArray(remoteValue)) return remoteValue;
  const remoteRecords = remoteValue.filter((item): item is Record<string, unknown> => isRecord(item) && "id" in item);
  const remoteById = new Map(remoteRecords.map((item) => [String(item.id), item]));
  const localRecords = localValue.filter((item): item is Record<string, unknown> => isRecord(item) && "id" in item);
  const localIds = new Set(localRecords.map((item) => String(item.id)));
  const mergedLocal = localRecords.map((item) => {
    const remoteRecord = remoteById.get(String(item.id));
    return remoteRecord ? mergeRecord(item, remoteRecord) : item;
  });
  return [...mergedLocal, ...remoteRecords.filter((item) => !localIds.has(String(item.id)))];
}

function localUserId(): string {
  if (typeof localStorage === "undefined") return "anonymous";
  let id = localStorage.getItem(LOCAL_USER_KEY);
  if (!id) {
    id = `ws-${Math.random().toString(36).slice(2, 10)}`;
    try { localStorage.setItem(LOCAL_USER_KEY, id); } catch { /* ignore */ }
  }
  return id;
}

class SyncService {
  private lastSyncedAt = 0;
  private status: SyncStatus = "idle";
  private listeners = new Set<SyncListener>();
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private intervalMs = POLL_INTERVAL_MS;
  private inFlight = false;
  private docVisible = typeof document === "undefined" || document.visibilityState !== "hidden";
  private errorCount = 0;
  private lastNotifiedError = 0;
  private booted = false;

  constructor() {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        this.docVisible = document.visibilityState !== "hidden";
        this.intervalMs = this.docVisible ? POLL_INTERVAL_MS : SLOW_POLL_INTERVAL_MS;
        if (this.booted) this.scheduleNextPoll(0);
      });
    }
  }

  start() {
    this.booted = true;
    void this.poll();
  }

  stop() {
    this.booted = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.status, this.lastSyncedAt);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getStatus(): { status: SyncStatus; lastSyncedAt: number } {
    return { status: this.status, lastSyncedAt: this.lastSyncedAt };
  }

  private notify() {
    const snapshot = { status: this.status, lastSyncedAt: this.lastSyncedAt };
    this.listeners.forEach((listener) => listener(snapshot.status, snapshot.lastSyncedAt));
  }

  private setStatus(status: SyncStatus) {
    this.status = status;
    this.notify();
  }

  private scheduleNextPoll(delay: number = this.intervalMs) {
    if (!this.booted) return;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => void this.poll(), delay);
  }

  private async poll() {
    if (this.inFlight) {
      this.scheduleNextPoll();
      return;
    }
    this.inFlight = true;
    this.setStatus("polling");

    try {
      const params = new URLSearchParams();
      if (this.lastSyncedAt > 0) {
        params.set("since", new Date(this.lastSyncedAt - 1500).toISOString());
      }
      params.set("limit", "2000");
      const response = await apiRequest<SinceResponse>(`/api/state/since?${params.toString()}`);
      const me = localUserId();
      let applied = 0;
      for (const entry of response.entries) {
        if (!(SHARED_KEYS as readonly string[]).includes(entry.key)) continue;
        if (entry.updatedBy === me) continue; // we wrote it, skip
        const localRaw = localStorage.getItem(entry.key);
        const localValue = localRaw ? JSON.parse(localRaw) : null;
        const merged = MERGE_KEYS.has(entry.key) && localValue
          ? mergeArrays(localValue, entry.value)
          : entry.value;
        const serialized = JSON.stringify(merged);
        localStorage.setItem(entry.key, serialized);
        // mtime key is updated by persistLocalSnapshot, so mirror it.
        try { localStorage.setItem(`${entry.key}__mtime__`, String(Date.parse(entry.updatedAt))); } catch { /* ignore */ }
        applied += 1;
        sharedStorage.subscribeKey.length; // touch to ensure module load
        // Trigger a soft refresh on any open components.
        window.dispatchEvent(new CustomEvent("mahaffeys:remote-sync", { detail: { key: entry.key } }));
      }
      this.lastSyncedAt = Date.parse(response.serverTime) || Date.now();
      this.errorCount = 0;
      this.setStatus("idle");
      if (applied > 0) {
        // Throttle success toasts so a busy shared database doesn't spam users.
        toast.info(`${applied} record${applied === 1 ? "" : "s"} synced from other workstations`, { duration: 2500 });
      }
    } catch (error) {
      this.errorCount += 1;
      this.setStatus("error");
      // Exponential backoff on consecutive failures (capped at 60s).
      this.intervalMs = Math.min(this.intervalMs * 2, 60_000);
      const now = Date.now();
      if (now - this.lastNotifiedError > 30_000) {
        this.lastNotifiedError = now;
        console.warn("Background sync poll failed", error);
      }
    } finally {
      this.inFlight = false;
      this.scheduleNextPoll();
    }
  }
}

export const syncService = new SyncService();