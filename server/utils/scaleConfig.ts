import { query } from "./db";

export type ScaleConfig = {
  path: string;
  baudRate: number;
};

interface ScaleConfigRow {
  value: unknown;
}

const STATE_KEY = "mahaffeys_scale_config";
let cachedConfig: ScaleConfig | null = null;

function isScaleConfig(value: unknown): value is ScaleConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as Record<string, unknown>;
  return typeof config.path === "string"
    && /^\/dev\/[a-zA-Z0-9._/-]+$/.test(config.path)
    && typeof config.baudRate === "number"
    && Number.isInteger(config.baudRate)
    && config.baudRate > 0;
}

export async function getScaleConfig(fallback: ScaleConfig) {
  if (cachedConfig) return cachedConfig;

  const result = await query<ScaleConfigRow>(
    "SELECT value FROM app_state WHERE key = $1",
    [STATE_KEY],
  );
  const saved = result.rows[0]?.value;
  cachedConfig = isScaleConfig(saved) ? saved : fallback;
  return cachedConfig;
}

export async function saveScaleConfig(config: ScaleConfig, userId: string) {
  if (!isScaleConfig(config)) throw new Error("Invalid scale serial configuration");
  const now = new Date();
  await query(`
    INSERT INTO app_state (key, value, updated_at, updated_by) VALUES ($1, $2::jsonb, $3, $4)
    ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by
  `, [STATE_KEY, JSON.stringify(config), now, userId]);
  cachedConfig = config;
  return config;
}
