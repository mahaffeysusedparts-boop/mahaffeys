import { apiRequest } from "./apiClient";
import { toast } from "sonner";
import { diagnosticLogger } from "./diagnosticLogger";
import { offlineQueue } from "./offlineQueue";

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
  "mahaffeys_yard_layout",
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
  "mahaffeys_tools",
  "mahaffeys_tool_checkouts",
  "mahaffeys_operations_goals",
  "mahaffeys_operations_alert_rules",
  "mahaffeys_operations_alerts",
  "mahaffeys_operations_summaries",
] as const;

type SharedKey = typeof SHARED_KEYS[number];

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

const MTIME_KEY_SUFFIX = "__mtime__";

// Schema normalization map for corrupt data recovery
const SCHEMA_DEFAULTS: Record<string, unknown> = {
  mahaffeys_metals: [],
  mahaffeys_car_rates: [],
  mahaffeys_customers: [],
  mahaffeys_tickets: [],
  mahaffeys_settings: {},
  mahaffeys_nmvtis_logs: [],
  mahaffeys_cat_codes: [],
  mahaffeys_container_drops: [],
  mahaffeys_cash_drawer: [],
  mahaffeys_yard_bays: [],
  mahaffeys_yard_layout: [],
  mahaffeys_pull_parts: [],
  mahaffeys_pull_yard_vehicles: [],
  mahaffeys_removed_inventory_vehicles: [],
  mahaffeys_core_returns: [],
  mahaffeys_admission_passes: [],
  mahaffeys_ip_cameras: [],
  mahaffeys_shipments: [],
  mahaffeys_mills: [],
  mahaffeys_timeclock: [],
  mahaffeys_checklists: [],
  mahaffeys_tasks: [],
  mahaffeys_equipment: [],
  mahaffeys_maintenance_logs: [],
  mahaffeys_rate_history: [],
  mahaffeys_tools: [],
  mahaffeys_tool_checkouts: [],
  mahaffeys_operations_goals: {},
  mahaffeys_operations_alert_rules: [],
  mahaffeys_operations_alerts: [],
  mahaffeys_operations_summaries: [],
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
type KeyListener = (key: string) => void;

let connectionStatus: ConnectionStatus = "local";
let remoteEnabled = false;
const listeners = new Set<StatusListener>();
const keyListeners = new Set<KeyListener>();

// Single-pass media stripper.
const MEDIA_PREFIX = /^data:(image|video|audio)\//i;
const BASE64_CHAR_DENSITY = /[A-Za-z0-9+/=_-]{160,}/;

function stripMedia(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (value.length > 240 && BASE64_CHAR_DENSITY.test(value)) return undefined;
    if (MEDIA_PREFIX.test(value)) return undefined;
    return value;
  }
  if (Array.isArray(value)) {
    const result: unknown[] = [];
    for (let i = 0; i < value.length; i += 1) {
      const stripped = stripMedia(value[i]);
      if (stripped !== undefined) result.push(stripped);
    }
    return result;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      const stripped = stripMedia(obj[key]);
      if (stripped !== undefined) out[key] = stripped;
    }
    return out;
  }
  return value;
}

function compactSerializedValue(serialized: string): string {
  try {
    return JSON.stringify(stripMedia(JSON.parse(serialized))) ?? serialized;
  } catch {
    return serialized;
  }
}

function isQuotaError(error: unknown) {
  return error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED");
}

// ---------------------------------------------------------------------------
// Local quota management
// ---------------------------------------------------------------------------
// localStorage caps out around 5 MB per origin while the shared dataset keeps
// growing. The server is the source of truth, so under quota pressure we
// progressively clear the coldest LOCAL history (resolved alerts, old
// summaries, oldest completed tickets). hydrate() re-merges whatever the
// server still holds, so this only shrinks this workstation's offline cache —
// open and recent records are always kept and in-session data lives in memory.

const CLOSED_TICKET_STATUSES = new Set(["COMPLETED", "VOIDED"]);

function attemptSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (!isQuotaError(error)) throw error;
    return false;
  }
}

function trimList(key: string, keep: (rows: Record<string, unknown>[]) => Record<string, unknown>[]): boolean {
  const stored = localStorage.getItem(key);
  if (!stored) return false;
  try {
    const rows = JSON.parse(stored);
    if (!Array.isArray(rows)) return false;
    const records = rows.filter((row): row is Record<string, unknown> => isRecord(row));
    const kept = keep(records);
    if (kept.length >= rows.length) return false;
    localStorage.setItem(key, JSON.stringify(kept));
    return true;
  } catch {
    return false;
  }
}

function keepNewest(field: string, limit: number) {
  return (rows: Record<string, unknown>[]) =>
    [...rows]
      .sort((a, b) => String(b[field] ?? "").localeCompare(String(a[field] ?? "")))
      .slice(0, limit);
}

function keepSince(field: string, days: number) {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  return (rows: Record<string, unknown>[]) => rows.filter((row) => String(row[field] ?? "") >= cutoff);
}

function trimResolvedAlerts(): boolean {
  return trimList("mahaffeys_operations_alerts", (rows) => {
    const active = rows.filter((row) => row.status !== "RESOLVED");
    const resolved = rows.filter((row) => row.status === "RESOLVED");
    return [...active, ...keepNewest("updatedAt", 250)(resolved)];
  });
}

function trimClosedCheckouts(days: number): boolean {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  return trimList("mahaffeys_tool_checkouts", (rows) =>
    rows.filter((row) => !row.checkedInAt || String(row.checkedInAt) >= cutoff),
  );
}

function evictClosedTickets(olderThanDays: number): boolean {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString();
  return trimList("mahaffeys_tickets", (rows) =>
    rows.filter((row) => {
      if (!CLOSED_TICKET_STATUSES.has(String(row.status ?? ""))) return true;
      const closedAt = String(row.updatedAt ?? row.createdAt ?? "");
      return !closedAt || closedAt >= cutoff;
    }),
  );
}

function evictionStages(): Array<{ label: string; run: () => boolean }> {
  return [
    {
      label: "cleared old resolved alerts, manager summaries, rate history, punch history, and returned tool checkouts",
      run: () => {
        const trimmed = [
          trimResolvedAlerts(),
          trimList("mahaffeys_operations_summaries", keepNewest("date", 45)),
          trimList("mahaffeys_rate_history", keepNewest("changedAt", 365)),
          trimList("mahaffeys_timeclock", keepSince("clockInAt", 120)),
          trimClosedCheckouts(180),
        ];
        return trimmed.some(Boolean);
      },
    },
    { label: "cleared completed tickets older than 90 days from this device", run: () => evictClosedTickets(90) },
    { label: "cleared completed tickets older than 14 days from this device", run: () => evictClosedTickets(14) },
    { label: "cleared completed tickets older than 1 day from this device", run: () => evictClosedTickets(1) },
  ];
}

let lastEvictionNotice = 0;
function notifyLocalEviction(detail: string) {
  const now = Date.now();
  if (now - lastEvictionNotice < 15 * 60_000) return;
  lastEvictionNotice = now;
  toast.warning("Device storage was full — oldest history cleared locally", {
    description: `${detail}. Everything is still saved on the server; this only affects this workstation's offline copy.`,
    duration: 10_000,
  });
}

function writeMtime(key: string) {
  try {
    localStorage.setItem(`${key}${MTIME_KEY_SUFFIX}`, String(Date.now()));
  } catch { /* best effort */ }
}

function compactExistingSnapshots() {
  for (const key of SHARED_KEYS) {
    const stored = localStorage.getItem(key);
    if (!stored) continue;
    const compacted = compactSerializedValue(stored);
    if (compacted.length < stored.length) {
      try { localStorage.setItem(key, compacted); } catch { /* best effort */ }
    }
  }
}

function persistLocalSnapshot(key: string, serialized: string) {
  const compacted = compactSerializedValue(serialized);
  if (attemptSetItem(key, compacted)) {
    writeMtime(key);
    return;
  }

  compactExistingSnapshots();
  if (attemptSetItem(key, compacted)) {
    writeMtime(key);
    return;
  }

  const applied: string[] = [];
  for (const stage of evictionStages()) {
    if (stage.run()) applied.push(stage.label);
    if (attemptSetItem(key, compacted)) break;
  }

  if (localStorage.getItem(key) !== compacted) {
    // Even after clearing cold history this snapshot does not fit locally.
    // The value stays in memory and is still queued for server upload, so no
    // work is lost — this workstation just cannot cache it until browser
    // storage is freed.
    diagnosticLogger.error(
      "sharedStorage",
      `Cannot cache ${key} locally — browser storage quota exceeded`,
      undefined,
      { snapshotBytes: compacted.length, evictions: applied.join("; ") || "none" },
    );
    notifyLocalEviction("Newest data is kept in memory and synced to the server");
    return;
  }

  diagnosticLogger.warn("sharedStorage", `Local quota pressure on ${key} — cold history cleared from this device`, {
    evictions: applied.join("; "),
    snapshotBytes: compacted.length,
  });
  notifyLocalEviction(applied.join("; "));
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

// Workstation state machine: a record that advanced further on another device
// (e.g. a ticket COMPLETED there) must win over this browser's stale copy.
const STATUS_RANK: Record<string, number> = { DRAFT: 0, PENDING: 1, COMPLETED: 2, VOIDED: 2 };
const GROWING_ARRAY_FIELDS = ["scrapLines", "weightTransactions"];
const PENDING_WEIGH_FIELDS = ["scaleGrossInWeight", "scaleGrossInAt", "scaleTareOutWeight", "scaleTareOutAt"];

function mergeRecord(localRecord: Record<string, unknown>, serverRecord: Record<string, unknown>) {
  const localUpdatedAt = Date.parse(String(localRecord.updatedAt ?? "")) || 0;
  const serverUpdatedAt = Date.parse(String(serverRecord.updatedAt ?? "")) || 0;
  if (localUpdatedAt || serverUpdatedAt) {
    return serverUpdatedAt > localUpdatedAt
      ? { ...localRecord, ...serverRecord }
      : { ...serverRecord, ...localRecord };
  }
  const localRank = STATUS_RANK[String(localRecord.status ?? "")] ?? 0;
  const serverRank = STATUS_RANK[String(serverRecord.status ?? "")] ?? 0;
  const serverWins = serverRank > localRank;
  const merged: Record<string, unknown> = serverWins ? { ...localRecord, ...serverRecord } : { ...serverRecord, ...localRecord };
  for (const field of ["carRecord", "complianceCaptures"]) {
    if (isRecord(serverRecord[field]) && isRecord(localRecord[field])) {
      merged[field] = { ...serverRecord[field], ...localRecord[field] };
    }
  }
  for (const field of GROWING_ARRAY_FIELDS) {
    if (Array.isArray(serverRecord[field]) && Array.isArray(localRecord[field]) && serverRecord[field].length > localRecord[field].length) {
      merged[field] = serverRecord[field];
    }
  }
  for (const field of PENDING_WEIGH_FIELDS) {
    if (serverRecord[field] != null && localRecord[field] == null) merged[field] = serverRecord[field];
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

let lastErrorToast = 0;
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

function setStatus(status: ConnectionStatus) {
  connectionStatus = status;
  listeners.forEach((listener) => listener(status));
}

function notifyKey(key: string) {
  keyListeners.forEach((listener) => {
    try { listener(key); } catch { /* ignore listener errors */ }
  });
}

// ---------------------------------------------------------------------------
// Corrupt Data Self-Healing
// ---------------------------------------------------------------------------
// Wrapped storage parsing with try-catch fallback and schema normalization
// prevents corrupt strings from halting application startup.

function safeParseJSON(key: string, raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    diagnosticLogger.warn("sharedStorage", `Corrupt JSON detected for key "${key}"`, {
      error: error instanceof Error ? error.message : String(error),
      key,
      rawLength: raw.length,
    });

    // Attempt schema normalization - restore defaults
    const defaultVal = SCHEMA_DEFAULTS[key];
    if (defaultVal !== undefined) {
      diagnosticLogger.info("sharedStorage", `Restoring default schema for key "${key}"`);
      try {
        localStorage.setItem(key, JSON.stringify(defaultVal));
      } catch { /* ignore */ }
      return defaultVal;
    }

    // No schema default - return null and let caller handle it
    return null;
  }
}

// ---------------------------------------------------------------------------
// Upload queue + debouncing
// ---------------------------------------------------------------------------

const pendingWrites = new Map<string, string>();
let flushPromise: Promise<void> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_DEBOUNCE_MS = 200;
const MAX_RETRY_DELAY_MS = 30_000;

function isQuotaErrorSafe(error: unknown) {
  return error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED");
}

async function flushWrites(): Promise<void> {
  if (flushPromise) return flushPromise;

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  flushPromise = (async () => {
    while (pendingWrites.size > 0) {
      const batch = [...pendingWrites.entries()];
      pendingWrites.clear();

      for (const [key, serialized] of batch) {
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
    }
  })().finally(() => {
    flushPromise = null;
  });

  return flushPromise;
}

function scheduleRetry() {
  if (retryTimer) return;
  const delay = Math.min(2_000 * 2 ** retryCount, MAX_RETRY_DELAY_MS);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flushWrites();
  }, delay);
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushWrites();
  }, FLUSH_DEBOUNCE_MS);
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    retryCount = 0;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    void flushWrites();
  });

  // Keep multiple tabs on the same workstation synchronized immediately.
  window.addEventListener("storage", (event) => {
    if (!event.key || !(SHARED_KEYS as readonly string[]).includes(event.key)) return;
    notifyKey(event.key);
    window.dispatchEvent(new CustomEvent("mahaffeys:remote-sync", { detail: { key: event.key } }));
  });
}

function collectLocalState() {
  return Object.fromEntries(
    SHARED_KEYS.flatMap((key) => {
      const value = localStorage.getItem(key);
      return value === null ? [] : [[key, safeParseJSON(key, value)]];
    }),
  );
}

// mtime helper so other modules can sort/inspect the data layer.
function readMtime(key: string): number {
  if (typeof localStorage === "undefined") return 0;
  return Number(localStorage.getItem(`${key}${MTIME_KEY_SUFFIX}`) || 0);
}

export const sharedStorage = {
  getItem(key: string) {
    return localStorage.getItem(key);
  },

  setItem(key: string, value: string) {
    persistLocalSnapshot(key, value);
    notifyKey(key);
    if (remoteEnabled && (SHARED_KEYS as readonly string[]).includes(key)) {
      pendingWrites.set(key, value);
      if (connectionStatus === "connected") {
        scheduleFlush();
      }
    }
  },

  removeItem(key: string) {
    localStorage.removeItem(key);
    notifyKey(key);
  },

  clear() {
    for (const key of SHARED_KEYS) {
      localStorage.removeItem(key);
      localStorage.removeItem(`${key}${MTIME_KEY_SUFFIX}`);
      notifyKey(key);
    }
  },

  async hydrate() {
    setStatus("connecting");
    const response = await apiRequest<{ state: Record<string, unknown> }>("/api/state");
    const entries = Object.entries(response.state);
    const serverKeys = new Set(entries.map(([key]) => key));
    const mergeKeys = new Set(["mahaffeys_tickets", "mahaffeys_pull_yard_vehicles", "mahaffeys_yard_layout", "mahaffeys_tools", "mahaffeys_tool_checkouts"]);

    for (const [key, serverValue] of entries) {
      if (!(SHARED_KEYS as readonly string[]).includes(key)) continue;
      const localRaw = localStorage.getItem(key);
      const localValue = localRaw ? safeParseJSON(key, localRaw) : null;
      const mergedValue = mergeKeys.has(key) && localValue
        ? mergeRecords(localValue, serverValue)
        : serverValue;
      const value = removeLegacyDemoData(key, mergedValue);
      const serialized = JSON.stringify(value);
      persistLocalSnapshot(key, serialized);
      notifyKey(key);
      if (serialized !== JSON.stringify(serverValue)) pendingWrites.set(key, serialized);
    }

    for (const [key, localValue] of Object.entries(collectLocalState())) {
      if (serverKeys.has(key)) continue;
      const value = removeLegacyDemoData(key, localValue);
      const serialized = JSON.stringify(value);
      persistLocalSnapshot(key, serialized);
      notifyKey(key);
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
      notifyKey(key);
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

  subscribeKey(listener: KeyListener) {
    keyListeners.add(listener);
    return () => {
      keyListeners.delete(listener);
    };
  },

  async flushNow() {
    return flushWrites();
  },

  readMtime(key: SharedKey | string) {
    return readMtime(key);
  },
};

export type { ConnectionStatus };