import { query } from "./db";

export type StoplightPreset = "tasmota" | "shelly_gen1" | "shelly_gen2" | "custom";

export type StoplightConfig = {
  preset: StoplightPreset;
  host: string;
  redChannel: number;
  greenChannel: number;
  username?: string;
  password?: string;
  redOnUrl?: string;
  redOffUrl?: string;
  greenOnUrl?: string;
  greenOffUrl?: string;
};

interface AppStateRow {
  value: unknown;
}

const STATE_KEY = "mahaffeys_stoplight_config";
const HOST_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9.-]{0,253}$/;
const PRESETS: StoplightPreset[] = ["tasmota", "shelly_gen1", "shelly_gen2", "custom"];
let cachedConfig: StoplightConfig | null = null;
let stoplightConfigLoaded = false;

export function isStoplightPreset(value: unknown): value is StoplightPreset {
  return typeof value === "string" && (PRESETS as string[]).includes(value);
}

/**
 * Custom-mode URL templates must be absolute http(s) URLs. `{host}` and `{ch}`
 * placeholders are substituted at command time.
 */
export function isValidUrlTemplate(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 500
    && /^https?:\/\//i.test(value)
    && !/\s/.test(value);
}

export function isValidStoplightConfig(value: unknown): value is StoplightConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as Record<string, unknown>;

  if (!isStoplightPreset(config.preset)) return false;
  if (typeof config.host !== "string" || !HOST_PATTERN.test(config.host)) return false;

  const channel = (input: unknown) => Number.isInteger(input) && (input as number) >= 1 && (input as number) <= 16;
  if (!channel(config.redChannel) || !channel(config.greenChannel)) return false;

  if (config.username !== undefined && (typeof config.username !== "string" || config.username.length > 100)) return false;
  if (config.password !== undefined && (typeof config.password !== "string" || config.password.length > 100)) return false;

  if (config.preset === "custom") {
    return isValidUrlTemplate(config.redOnUrl) && isValidUrlTemplate(config.redOffUrl)
      && isValidUrlTemplate(config.greenOnUrl) && isValidUrlTemplate(config.greenOffUrl);
  }

  return true;
}

export async function getStoplightConfig(): Promise<StoplightConfig | null> {
  if (stoplightConfigLoaded) return cachedConfig;

  const result = await query<AppStateRow>(
    "SELECT value FROM app_state WHERE key = $1",
    [STATE_KEY],
  );
  const stored = result.rows[0]?.value;
  cachedConfig = isValidStoplightConfig(stored) ? stored : null;
  stoplightConfigLoaded = true;
  return cachedConfig;
}

export async function saveStoplightConfig(config: StoplightConfig, userId: string) {
  if (!isValidStoplightConfig(config)) throw new Error("Invalid stoplight relay configuration");
  const now = new Date();
  await query(`
    INSERT INTO app_state (key, value, updated_at, updated_by) VALUES ($1, $2::jsonb, $3, $4)
    ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by
  `, [STATE_KEY, JSON.stringify(config), now, userId]);
  cachedConfig = config;
  stoplightConfigLoaded = true;
  return config;
}
