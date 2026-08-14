import { apiRequest } from "./apiClient";
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

const LEGACY_DEMO_IDS: Record<string, Set<string>> = {
  mahaffeys_ip_cameras: new Set(["cam-101", "cam-102", "cam-103"]),
  mahaffeys_pull_parts: new Set(Array.from({ length: 10 }, (_, index) => `part-${index + 1}`)),
  mahaffeys_pull_yard_vehicles: new Set(["veh-101", "veh-102", "veh-103", "veh-104"]),
  mahaffeys_core_returns: new Set(["core-1", "core-2"]),
  mahaffeys_admission_passes: new Set(["pass-1001", "pass-1002"]),
  mahaffeys_cat_codes: new Set(Array.from({ length: 6 }, (_, index) => `cat-${index + 101}`)),
  mahaffeys_container_drops: new Set(["drop-1001", "drop-1002", "drop-1003"]),
  mahaffeys_cash_drawer: new Set(["cd-101", "cd-102", "cd-103", "cd-104"]),
  mahaffeys_yard_bays: new Set(Array.from({ length: 5 }, (_, index) => `bay-${index + 1}`)),
  mahaffeys_metals: new Set(Array.from({ length: 12 }, (_, index) => `m${index + 1}`)),
  mahaffeys_car_rates: new Set(Array.from({ length: 4 }, (_, index) => `car${index + 1}`)),
  mahaffeys_customers: new Set(["cust-101", "cust-102", "cust-103"]),
  mahaffeys_tickets: new Set(["T-2025-1001", "T-2025-1002", "T-2025-1003", "T-2025-1004"]),
  mahaffeys_nmvtis_logs: new Set(["log-101"]),
};

function removeLegacyDemoData(key: string, value: unknown): unknown {
  const ids = LEGACY_DEMO_IDS[key];
  if (ids && Array.isArray(value)) {
    return value.filter((item) => !isRecord(item) || !ids.has(String(item.id)));
  }
  if (key === "mahaffeys_settings" && isRecord(value) && value.yardName === "Apex Metal & Auto Recyclers") {
    return {
      ...value,
      yardName: "My Recycling Yard",
      address: "",
      cityStateZip: "",
      phone: "",
      email: "",
      licenseNumber: "",
      nmvtisReportingId: "",
      receiptHeader: "Thank you for recycling with us.",
      receiptFooter: "All transactions are final.",
      operatorName: "Operator",
      cashDrawerFloatLimit: 0,
      admissionFeeUsd: 0,
      customDomain: "",
    };
  }
  return value;
}

type ConnectionStatus = "local" | "connecting" | "connected" | "error";
type StatusListener = (status: ConnectionStatus) => void;

let connectionStatus: ConnectionStatus = "local";
let remoteEnabled = false;
const listeners = new Set<StatusListener>();
const pendingWrites = new Map<string, string>();
const memoryValues = new Map<string, string>();
let flushPromise: Promise<void> | null = null;
let retryCount = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let lastErrorToast = 0;

function setStatus(status: ConnectionStatus) {
  connectionStatus = status;
  listeners.forEach((listener) => listener(status));
}

function stripEmbeddedMedia(value: unknown): unknown {
  if (typeof value === "string" && /^data:(image|video|audio)\//i.test(value)) return undefined;
  if (Array.isArray(value)) return value.map((item) => stripEmbeddedMedia(item) ?? null);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) => {
      const compacted = stripEmbeddedMedia(item);
      return compacted === undefined ? [] : [[key, compacted]];
    }),
  );
}

function compactSerializedValue(serialized: string) {
  try {
    return JSON.stringify(stripEmbeddedMedia(JSON.parse(serialized))) ?? serialized;
  } catch {
    return serialized;
  }
}

function isQuotaError(error: unknown) {
  return error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED");
}

function compactExistingSnapshots() {
  for (const key of SHARED_KEYS) {
    const stored = localStorage.getItem(key);
    if (!stored) continue;
    const compacted = compactSerializedValue(stored);
    if (compacted.length < stored.length) localStorage.setItem(key, compacted);
  }
}

function persistLocalSnapshot(key: string, serialized: string) {
  const compacted = compactSerializedValue(serialized);
  try {
    localStorage.setItem(key, compacted);
  } catch (error) {
    if (!isQuotaError(error)) throw error;
    compactExistingSnapshots();
    localStorage.setItem(key, compacted);
  }
}

const STATE_CHUNK_SIZE = 500 * 1024;

async function uploadSerializedState(key: string, serialized: string) {
  const uploadId = crypto.randomUUID();
  const total = Math.max(1, Math.ceil(serialized.length / STATE_CHUNK_SIZE));

  for (let index = 0; index < total; index += 1) {
    const chunk = serialized.slice(index * STATE_CHUNK_SIZE, (index + 1) * STATE_CHUNK_SIZE);
    await apiRequest(`/api/state/${encodeURIComponent(key)}/chunk`, {
      method: "POST",
      body: JSON.stringify({ uploadId, index, total, chunk }),
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeRecord(localRecord: Record<string, unknown>, serverRecord: Record<string, unknown>) {
  const merged = { ...serverRecord, ...localRecord };
  for (const field of ["carRecord", "complianceCaptures"]) {
    if (isRecord(serverRecord[field]) && isRecord(localRecord[field])) {
      merged[field] = { ...serverRecord[field], ...localRecord[field] };
    }
  }
  return merged;
}

function mergeRecords(localValue: unknown, serverValue: unknown) {
  if (!Array.isArray(localValue) || !Array.isArray(serverValue)) return serverValue;
  const serverRecords = serverValue.filter((item): item is Record<string, unknown> => isRecord(item) && "id" in item);
  const serverById = new Map(serverRecords.map((item) => [String(item.id), item]));
  const localRecords = localValue.filter((item): item is Record<string, unknown> => isRecord(item) && "id" in item);
  const localIds = new Set(localRecords.map((item) => String(item.id)));
  const mergedLocalRecords = localRecords.map((item) => {
    const serverRecord = serverById.get(String(item.id));
    return serverRecord ? mergeRecord(item, serverRecord) : item;
  });
  return [...mergedLocalRecords, ...serverRecords.filter((item) => !localIds.has(String(item.id)))];
}

function notifySyncError(message: string) {
  const now = Date.now();
  if (now - lastErrorToast > 15_000) {
    lastErrorToast = now;
    toast.error("Server sync failed — changes saved locally", {
      description: `${message} Retrying automatically.`,
      duration: 10_000,
    });
  }
}

async function flushWrites(): Promise<void> {
  if (flushPromise) return flushPromise;

  flushPromise = (async () => {
    while (pendingWrites.size > 0) {
      const [key, serialized] = pendingWrites.entries().next().value as [string, string];
      pendingWrites.delete(key);
      try {
        await uploadSerializedState(key, serialized);
        setStatus("connected");
        retryCount = 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : "The server rejected the update.";
        console.error(`Server sync failed for ${key}:`, error);
        if (!pendingWrites.has(key)) pendingWrites.set(key, serialized);
        setStatus("error");
        notifySyncError(message);
        retryCount += 1;
        scheduleRetry();
        return;
      }
    }
  })().finally(() => {
    flushPromise = null;
  });

  return flushPromise;
}

function scheduleRetry() {
  if (retryTimer) return;
  const delay = Math.min(2_000 * 2 ** retryCount, 30_000);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flushWrites();
  }, delay);
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    retryCount = 0;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    void flushWrites();
  });
}

function collectLocalState() {
  return Object.fromEntries(
    SHARED_KEYS.flatMap((key) => {
      const value = localStorage.getItem(key);
      return value === null ? [] : [[key, JSON.parse(value)]];
    }),
  );
}

export const sharedStorage = {
  getItem(key: string) {
    return memoryValues.get(key) ?? localStorage.getItem(key);
  },

  setItem(key: string, value: string) {
    persistLocalSnapshot(key, value);
    memoryValues.set(key, value);
    if (remoteEnabled && (SHARED_KEYS as readonly string[]).includes(key)) {
      pendingWrites.set(key, value);
      void flushWrites();
    }
  },

  removeItem(key: string) {
    memoryValues.delete(key);
    localStorage.removeItem(key);
  },

  clear() {
    for (const key of SHARED_KEYS) {
      memoryValues.delete(key);
      localStorage.removeItem(key);
    }
  },

  async hydrate() {
    setStatus("connecting");
    const response = await apiRequest<{ state: Record<string, unknown> }>("/api/state");
    const entries = Object.entries(response.state);
    const serverKeys = new Set(entries.map(([key]) => key));
    const mergeKeys = new Set(["mahaffeys_tickets", "mahaffeys_pull_yard_vehicles"]);

    for (const [key, serverValue] of entries) {
      if (!(SHARED_KEYS as readonly string[]).includes(key)) continue;
      const localSerialized = localStorage.getItem(key);
      const localValue = localSerialized ? JSON.parse(localSerialized) as unknown : null;
      const mergedValue = mergeKeys.has(key) && localValue
        ? mergeRecords(localValue, serverValue)
        : serverValue;
      const value = removeLegacyDemoData(key, mergedValue);
      const serialized = JSON.stringify(value);
      persistLocalSnapshot(key, serialized);
      memoryValues.set(key, serialized);
      if (serialized !== JSON.stringify(serverValue)) pendingWrites.set(key, serialized);
    }

    for (const [key, localValue] of Object.entries(collectLocalState())) {
      if (serverKeys.has(key)) continue;
      const value = removeLegacyDemoData(key, localValue);
      const serialized = JSON.stringify(value);
      persistLocalSnapshot(key, serialized);
      memoryValues.set(key, serialized);
      pendingWrites.set(key, serialized);
    }

    remoteEnabled = true;
    setStatus("connected");
    if (pendingWrites.size > 0) void flushWrites();
  },

  disconnect() {
    remoteEnabled = false;
    setStatus("local");
  },

  async importState(state: Record<string, unknown>) {
    for (const [key, value] of Object.entries(state)) {
      if (!(SHARED_KEYS as readonly string[]).includes(key)) continue;
      const serialized = JSON.stringify(value);
      await uploadSerializedState(key, serialized);
      persistLocalSnapshot(key, serialized);
      memoryValues.set(key, serialized);
    }
    remoteEnabled = true;
    setStatus("connected");
  },

  getStatus() {
    return connectionStatus;
  },

  subscribe(listener: StatusListener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export type { ConnectionStatus };
