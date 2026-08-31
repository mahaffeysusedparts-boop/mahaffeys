import { query } from "./db";
import { getStoplightConfig, type StoplightConfig, type StoplightPreset } from "./stoplightConfig";

export type StoplightState = "red" | "green" | "off";

export type StoplightStatus = {
  configured: boolean;
  preset?: StoplightPreset;
  host?: string;
  redChannel?: number;
  greenChannel?: number;
  state: StoplightState;
  /** true/false after the first command attempt this boot; null = never tried */
  relayReachable: boolean | null;
  lastError?: string;
  lastCommandAt?: string;
  lastCommandBy?: string;
  updatedAt: string;
};

interface AppStateRow {
  value: unknown;
}

const STATE_KEY = "mahaffeys_stoplight_state";
const COMMAND_TIMEOUT_MS = 4000;

type RuntimeState = Pick<StoplightStatus, "state" | "relayReachable" | "lastError" | "lastCommandAt" | "lastCommandBy">;

let runtimeState: RuntimeState | null = null;

function isValidRuntimeState(value: unknown): value is RuntimeState {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  if (state.state !== "red" && state.state !== "green" && state.state !== "off") return false;
  return state.relayReachable === null || typeof state.relayReachable === "boolean";
}

async function loadRuntimeState(): Promise<RuntimeState> {
  if (runtimeState) return runtimeState;
  const result = await query<AppStateRow>(
    "SELECT value FROM app_state WHERE key = $1",
    [STATE_KEY],
  );
  const stored = result.rows[0]?.value;
  runtimeState = isValidRuntimeState(stored)
    ? stored
    : { state: "off", relayReachable: null };
  return runtimeState;
}

async function persistRuntimeState(byUserId?: string) {
  if (!runtimeState) return;
  await query(`
    INSERT INTO app_state (key, value, updated_at, updated_by) VALUES ($1, $2::jsonb, $3, $4)
    ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by
  `, [STATE_KEY, JSON.stringify(runtimeState), new Date(), byUserId ?? null]);
}

export async function getStoplightStatus(): Promise<StoplightStatus> {
  const [config, state] = await Promise.all([getStoplightConfig(), loadRuntimeState()]);
  return {
    configured: config !== null,
    preset: config?.preset,
    host: config?.host,
    redChannel: config?.redChannel,
    greenChannel: config?.greenChannel,
    state: state.state,
    relayReachable: state.relayReachable,
    lastError: state.lastError,
    lastCommandAt: state.lastCommandAt,
    lastCommandBy: state.lastCommandBy,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Builds the HTTP URL that switches one lamp on or off, based on the relay
 * vendor preset. Channels are 1-based numbers as printed on the relay board.
 */
export function buildCommandUrl(config: StoplightConfig, color: "red" | "green", on: boolean): string {
  const channel = color === "red" ? config.redChannel : config.greenChannel;
  switch (config.preset) {
    case "tasmota":
      return `http://${config.host}/cm?cmnd=${encodeURIComponent(`Power${channel} ${on ? "On" : "Off"}`)}`;
    case "shelly_gen1":
      return `http://${config.host}/relay/${channel - 1}?turn=${on ? "on" : "off"}`;
    case "shelly_gen2":
      return `http://${config.host}/rpc/Switch.Set?id=${channel - 1}&on=${on ? "true" : "false"}`;
    case "custom": {
      const template = color === "red"
        ? (on ? config.redOnUrl : config.redOffUrl)
        : (on ? config.greenOnUrl : config.greenOffUrl);
      return (template ?? "")
        .replace(/\{host\}/g, config.host)
        .replace(/\{ch\}/g, String(channel));
    }
  }
}

async function sendCommand(config: StoplightConfig, color: "red" | "green", on: boolean) {
  const url = buildCommandUrl(config, color, on);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COMMAND_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {};
    if (config.username) {
      const credentials = Buffer.from(`${config.username}:${config.password ?? ""}`).toString("base64");
      headers.Authorization = `Basic ${credentials}`;
    }
    const response = await fetch(url, { headers, signal: controller.signal, cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Relay answered HTTP ${response.status} for ${color.toUpperCase()} ${on ? "ON" : "OFF"}`);
    }
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError"
      ? "timed out"
      : error instanceof Error ? error.message : "network failure";
    throw new Error(`${color === "red" ? "Red" : "Green"} lamp ${on ? "ON" : "OFF"} failed at ${config.host}: ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}

async function applyState(config: StoplightConfig, state: StoplightState, byUserId?: string) {
  await loadRuntimeState();
  const steps: Array<{ color: "red" | "green"; on: boolean }> = [];
  if (state === "red") steps.push({ color: "green", on: false }, { color: "red", on: true });
  else if (state === "green") steps.push({ color: "red", on: false }, { color: "green", on: true });
  else steps.push({ color: "red", on: false }, { color: "green", on: false });

  try {
    for (const step of steps) {
      await sendCommand(config, step.color, step.on);
    }
    runtimeState = {
      state,
      relayReachable: true,
      lastError: undefined,
      lastCommandAt: new Date().toISOString(),
      lastCommandBy: byUserId,
    };
  } catch (error) {
    runtimeState = {
      state: runtimeState?.state ?? "off",
      relayReachable: false,
      lastError: error instanceof Error ? error.message : "The relay could not be reached",
      lastCommandAt: new Date().toISOString(),
      lastCommandBy: byUserId,
    };
    await persistRuntimeState(byUserId);
    throw error;
  }
  await persistRuntimeState(byUserId);
}

/** Commands are serialized so overlapping desk/admin clicks never interleave. */
let commandChain: Promise<unknown> = Promise.resolve();

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = commandChain.then(job, job);
  commandChain = run.catch(() => {});
  return run;
}

async function requireConfig() {
  const config = await getStoplightConfig();
  if (!config) throw new Error("Stoplight relay is not configured — set it up on the Server Admin page first");
  return config;
}

export function commandStoplight(state: StoplightState, byUserId?: string) {
  return enqueue(async () => {
    const config = await requireConfig();
    await applyState(config, state, byUserId);
  });
}

/**
 * Verifies a relay configuration by switching both lamps to a safe OFF state.
 * Used when saving admin configuration — refuses to keep unreachable settings.
 */
export function probeStoplight(config: StoplightConfig, byUserId?: string) {
  return enqueue(async () => {
    await applyState(config, "off", byUserId);
  });
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Brief red/green flash sequence so an admin can confirm the wiring. */
export function runStoplightTest(byUserId?: string) {
  return enqueue(async () => {
    const config = await requireConfig();
    await applyState(config, "red", byUserId);
    await delay(1300);
    await applyState(config, "off", byUserId);
    await delay(450);
    await applyState(config, "green", byUserId);
    await delay(1300);
    await applyState(config, "off", byUserId);
  });
}
