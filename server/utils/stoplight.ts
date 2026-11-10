import { query } from "./db";
import { getStoplightConfig, type StoplightConfig, type StoplightPreset } from "./stoplightConfig";
import { readRelayOutputs, relayRequest, type RelayOutputState } from "./stoplightRelay";

export type StoplightState = "red" | "green" | "off";

export type StoplightStatus = {
  configured: boolean;
  preset?: StoplightPreset;
  host?: string;
  redChannel?: number;
  greenChannel?: number;
  state: RelayOutputState | "unknown";
  relayReachable: boolean | null;
  lastError?: string;
  lastCommandAt?: string;
  lastCommandBy?: string;
  verifiedAt?: string;
  updatedAt: string;
};

type CommandRecord = Pick<StoplightStatus, "lastCommandAt" | "lastCommandBy">;
const STATE_KEY = "mahaffeys_stoplight_state";
let commandRecord: CommandRecord | null = null;

async function loadCommandRecord(): Promise<CommandRecord> {
  if (commandRecord) return commandRecord;
  const result = await query<{ value: CommandRecord | null }>(
    "SELECT value FROM app_state WHERE key = $1", [STATE_KEY],
  );
  const stored = result.rows[0]?.value;
  // Persisted command state is not evidence of the current physical output.
  commandRecord = {
    lastCommandAt: typeof stored?.lastCommandAt === "string" ? stored.lastCommandAt : undefined,
    lastCommandBy: typeof stored?.lastCommandBy === "string" ? stored.lastCommandBy : undefined,
  };
  return commandRecord;
}

async function persistCommandRecord(byUserId?: string) {
  await query(`
    INSERT INTO app_state (key, value, updated_at, updated_by) VALUES ($1, $2::jsonb, $3, $4)
    ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by
  `, [STATE_KEY, JSON.stringify(commandRecord), new Date(), byUserId ?? null]);
}

/** Commands and reads are serialized so no read sees half of a software switch. */
let commandChain: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = commandChain.then(job, job);
  commandChain = run.catch(() => {});
  return run;
}

let statusInFlight: Promise<StoplightStatus> | null = null;
export function getStoplightStatus(): Promise<StoplightStatus> {
  // Concurrent desks share a read, but every subsequent poll gets fresh hardware data.
  if (statusInFlight) return statusInFlight;
  statusInFlight = enqueue(async () => {
    const [config, record] = await Promise.all([getStoplightConfig(), loadCommandRecord()]);
    const status: StoplightStatus = {
      configured: config !== null,
      preset: config?.preset,
      host: config?.host,
      redChannel: config?.redChannel,
      greenChannel: config?.greenChannel,
      ...record,
      state: "unknown",
      relayReachable: null,
      updatedAt: new Date().toISOString(),
    };
    if (config) {
      try {
        status.state = await readRelayOutputs(config);
        status.relayReachable = true;
        status.verifiedAt = new Date().toISOString();
        if (status.state === "conflict") status.lastError = "Both relay outputs are ON. Check the manual switch and wiring; do not signal the driver to proceed.";
      } catch (error) {
        status.relayReachable = config.preset === "custom" ? null : false;
        status.lastError = error instanceof Error ? error.message : "Relay output feedback is unavailable";
      }
    }
    status.updatedAt = new Date().toISOString();
    return status;
  }).finally(() => { statusInFlight = null; });
  return statusInFlight;
}

/** Channels are 1-based numbers as printed on the relay board. */
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
      return (template ?? "").replace(/\{host\}/g, config.host).replace(/\{ch\}/g, String(channel));
    }
  }
}

async function sendCommand(config: StoplightConfig, color: "red" | "green", on: boolean) {
  try {
    await relayRequest(config, buildCommandUrl(config, color, on));
  } catch (error) {
    const reason = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
      ? "timed out" : error instanceof Error ? error.message : "network failure";
    throw new Error(`${color === "red" ? "Red" : "Green"} lamp ${on ? "ON" : "OFF"} failed at ${config.host}: ${reason}`);
  }
}

async function applyState(config: StoplightConfig, state: StoplightState, byUserId?: string) {
  await loadCommandRecord();
  const steps: Array<{ color: "red" | "green"; on: boolean }> = [];
  if (state === "red") steps.push({ color: "green", on: false }, { color: "red", on: true });
  else if (state === "green") steps.push({ color: "red", on: false }, { color: "green", on: true });
  else steps.push({ color: "red", on: false }, { color: "green", on: false });

  try {
    for (const step of steps) await sendCommand(config, step.color, step.on);
    if (config.preset !== "custom") {
      const observed = await readRelayOutputs(config);
      if (observed !== state) {
        throw new Error(`Requested ${state.toUpperCase()}, but relay reports ${observed.toUpperCase()}. Check the manual switch or relay override.`);
      }
    }
  } finally {
    commandRecord = { lastCommandAt: new Date().toISOString(), lastCommandBy: byUserId };
    await persistCommandRecord(byUserId);
  }
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

/** Saving settings switches both outputs OFF and verifies feedback where supported. */
export function probeStoplight(config: StoplightConfig, byUserId?: string) {
  return enqueue(async () => { await applyState(config, "off", byUserId); });
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
