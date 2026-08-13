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
  "mahaffeys_core_returns",
  "mahaffeys_admission_passes",
  "mahaffeys_ip_cameras",
] as const;

type ConnectionStatus = "local" | "connecting" | "connected" | "error";
type StatusListener = (status: ConnectionStatus) => void;

let connectionStatus: ConnectionStatus = "local";
let remoteEnabled = false;
const listeners = new Set<StatusListener>();
const pendingWrites = new Map<string, string>();
let flushPromise: Promise<void> | null = null;
let retryCount = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let lastErrorToast = 0;

function setStatus(status: ConnectionStatus) {
  connectionStatus = status;
  listeners.forEach((listener) => listener(status));
}

function mergeRecords(localValue: unknown, serverValue: unknown) {
  if (!Array.isArray(localValue) || !Array.isArray(serverValue)) return serverValue;
  const localRecords = localValue.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && "id" in item);
  const localIds = new Set(localRecords.map((item) => String(item.id)));
  return [...localRecords, ...serverValue.filter((item) => {
    return Boolean(item) && typeof item === "object" && "id" in item && !localIds.has(String((item as Record<string, unknown>).id));
  })];
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
        await apiRequest(`/api/state/${encodeURIComponent(key)}`, {
          method: "PUT",
          body: JSON.stringify({ value: JSON.parse(serialized) }),
        });
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
    return localStorage.getItem(key);
  },

  setItem(key: string, value: string) {
    localStorage.setItem(key, value);
    if (remoteEnabled && (SHARED_KEYS as readonly string[]).includes(key)) {
      pendingWrites.set(key, value);
      void flushWrites();
    }
  },

  removeItem(key: string) {
    localStorage.removeItem(key);
  },

  clear() {
    for (const key of SHARED_KEYS) {
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
      const value = mergeKeys.has(key) && localValue
        ? mergeRecords(localValue, serverValue)
        : serverValue;
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
      if (serialized !== JSON.stringify(serverValue)) pendingWrites.set(key, serialized);
    }

    for (const [key, value] of Object.entries(collectLocalState())) {
      if (!serverKeys.has(key)) pendingWrites.set(key, JSON.stringify(value));
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
    await apiRequest("/api/state/import", { method: "POST", body: JSON.stringify({ state }) });
    for (const [key, value] of Object.entries(state)) {
      if ((SHARED_KEYS as readonly string[]).includes(key)) localStorage.setItem(key, JSON.stringify(value));
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
