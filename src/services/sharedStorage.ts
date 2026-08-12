import { apiRequest } from "./apiClient";

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

function setStatus(status: ConnectionStatus) {
  connectionStatus = status;
  listeners.forEach((listener) => listener(status));
}

async function flushWrites() {
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
      } catch {
        pendingWrites.set(key, serialized);
        setStatus("error");
        break;
      }
    }
  })().finally(() => {
    flushPromise = null;
  });
  return flushPromise;
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
    if (entries.length > 0) {
      for (const [key, value] of entries) {
        if ((SHARED_KEYS as readonly string[]).includes(key)) {
          localStorage.setItem(key, JSON.stringify(value));
        }
      }
    } else {
      const localState = collectLocalState();
      await Promise.all(Object.entries(localState).map(([key, value]) =>
        apiRequest(`/api/state/${encodeURIComponent(key)}`, {
          method: "PUT",
          body: JSON.stringify({ value }),
        }),
      ));
    }
    remoteEnabled = true;
    setStatus("connected");
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