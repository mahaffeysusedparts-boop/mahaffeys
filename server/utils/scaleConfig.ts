import { query } from "./db";

export type SerialScaleConfig = {
  type: "serial";
  path: string;
  baudRate: number;
};

export type TcpScaleConfig = {
  type: "tcp";
  host: string;
  port: number;
};

export type ScaleConfig = SerialScaleConfig | TcpScaleConfig;

interface ScaleConfigRow {
  value: unknown;
}

const STATE_KEY = "mahaffeys_scale_config";
const PATH_PATTERN = /^\/dev\/[a-zA-Z0-9._/-]+$/;
const HOST_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9.-]{0,253}$/;
let cachedConfig: ScaleConfig | null = null;

export function isValidScaleConfig(value: unknown): value is ScaleConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as Record<string, unknown>;

  if (config.type === "tcp") {
    return typeof config.host === "string" && HOST_PATTERN.test(config.host)
      && Number.isInteger(config.port)
      && (config.port as number) >= 1 && (config.port as number) <= 65535;
  }

  const isSerial = config.type === "serial" || (!("type" in config) && typeof config.path === "string");
  return isSerial
    && typeof config.path === "string" && PATH_PATTERN.test(config.path)
    && Number.isInteger(config.baudRate)
    && (config.baudRate as number) > 0;
}

function normalize(value: unknown): ScaleConfig | null {
  if (!isValidScaleConfig(value)) return null;
  const config = value as Record<string, unknown>;
  if (config.type === "tcp") {
    return { type: "tcp", host: config.host as string, port: config.port as number };
  }
  return { type: "serial", path: config.path as string, baudRate: config.baudRate as number };
}

export async function getScaleConfig(fallback: ScaleConfig) {
  if (cachedConfig) return cachedConfig;

  const result = await query<ScaleConfigRow>(
    "SELECT value FROM app_state WHERE key = $1",
    [STATE_KEY],
  );
  cachedConfig = normalize(result.rows[0]?.value) || fallback;
  return cachedConfig;
}

export async function saveScaleConfig(config: ScaleConfig, userId: string) {
  if (!isValidScaleConfig(config)) throw new Error("Invalid scale connection configuration");
  const now = new Date();
  await query(`
    INSERT INTO app_state (key, value, updated_at, updated_by) VALUES ($1, $2::jsonb, $3, $4)
    ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by
  `, [STATE_KEY, JSON.stringify(config), now, userId]);
  cachedConfig = config;
  return config;
}
