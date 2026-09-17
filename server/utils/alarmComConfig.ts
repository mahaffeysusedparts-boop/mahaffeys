import { query } from "./db";

/**
 * Persistence for the Alarm.com camera bridge.
 *
 * Mirrors the proven scaleConfig.ts pattern: JSON blobs in `app_state`,
 * module-level cache, strict normalization on read, upsert on write.
 *
 * Two keys:
 *  - mahaffeys_adc_connection: session cookie jar + login state machine
 *    (credentials themselves are NEVER persisted — only cookies)
 *  - mahaffeys_adc_cameras: per-device yard assignment / active / notes
 */

export type AdcConnectionStatus = "NEEDS_LOGIN" | "NEEDS_OTP" | "CONNECTED" | "ERROR";

export interface AdcConnection {
  status: AdcConnectionStatus;
  username?: string;
  /** Session cookies (the "trusted device" state lives here as a cookie). */
  cookies: Record<string, string>;
  /** Pending 2FA challenge device id (set while status === "NEEDS_OTP"). */
  twoFactorDeviceId?: string;
  errorMessage?: string;
  lastVerifiedAt?: string;
  lastSyncAt?: string;
  cameraCount?: number;
}

export type AdcCameraAssignment =
  | "SCALE_DESK"
  | "SELLER_FACE"
  | "LICENSE_PLATE"
  | "CARGO_BAY"
  | "YARD_OVERVIEW"
  | "OTHER";

export interface AdcCameraConfig {
  deviceId: string;
  /** Last known display name from alarm.com (refreshed on sync). */
  name: string;
  location?: string;
  assignment: AdcCameraAssignment;
  isActive: boolean;
  notes?: string;
}

export interface AdcCameraConfigPatch {
  assignment?: AdcCameraAssignment;
  isActive?: boolean;
  notes?: string | null;
}

interface AppStateRow {
  value: unknown;
}

const CONNECTION_KEY = "mahaffeys_adc_connection";
const CAMERAS_KEY = "mahaffeys_adc_cameras";

const ASSIGNMENTS = new Set<AdcCameraAssignment>([
  "SCALE_DESK",
  "SELLER_FACE",
  "LICENSE_PLATE",
  "CARGO_BAY",
  "YARD_OVERVIEW",
  "OTHER",
]);

export function isAdcAssignment(value: unknown): value is AdcCameraAssignment {
  return typeof value === "string" && ASSIGNMENTS.has(value as AdcCameraAssignment);
}

function asIso(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

export function normalizeAdcConnection(value: unknown): AdcConnection | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const status = raw.status;
  if (status !== "NEEDS_LOGIN" && status !== "NEEDS_OTP" && status !== "CONNECTED" && status !== "ERROR") {
    return null;
  }
  const cookies =
    raw.cookies && typeof raw.cookies === "object" && !Array.isArray(raw.cookies)
      ? Object.fromEntries(
          Object.entries(raw.cookies as Record<string, unknown>)
            .filter(([, cookieValue]) => typeof cookieValue === "string")
            .map(([cookieName, cookieValue]) => [String(cookieName).trim(), String(cookieValue)] as const),
        )
      : {};
  return {
    status,
    username: typeof raw.username === "string" && raw.username ? raw.username : undefined,
    cookies,
    twoFactorDeviceId: typeof raw.twoFactorDeviceId === "string" && raw.twoFactorDeviceId ? raw.twoFactorDeviceId : undefined,
    errorMessage: typeof raw.errorMessage === "string" && raw.errorMessage ? raw.errorMessage : undefined,
    lastVerifiedAt: asIso(raw.lastVerifiedAt),
    lastSyncAt: asIso(raw.lastSyncAt),
    cameraCount: typeof raw.cameraCount === "number" && Number.isFinite(raw.cameraCount) ? raw.cameraCount : undefined,
  };
}

export function normalizeAdcCameraConfigs(value: unknown): AdcCameraConfig[] {
  if (!Array.isArray(value)) return [];
  const cameras: AdcCameraConfig[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const deviceId = typeof raw.deviceId === "string" || typeof raw.deviceId === "number" ? String(raw.deviceId) : "";
    if (!deviceId || /^[\w-]{1,64}$/.test(deviceId) === false) continue;
    const assignment = isAdcAssignment(raw.assignment) ? raw.assignment : "OTHER";
    cameras.push({
      deviceId,
      name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 120) : `Alarm.com camera ${deviceId}`,
      location: typeof raw.location === "string" && raw.location.trim() ? raw.location.trim().slice(0, 160) : undefined,
      assignment,
      isActive: raw.isActive === undefined ? true : raw.isActive === true,
      notes: typeof raw.notes === "string" && raw.notes.trim() ? raw.notes.trim().slice(0, 500) : undefined,
    });
  }
  return cameras;
}

let cachedConnection: AdcConnection | null = null;
let cachedConnectionLoaded = false;
let cachedCameras: AdcCameraConfig[] | null = null;

async function readStateKey(key: string): Promise<unknown> {
  const result = await query<AppStateRow>("SELECT value FROM app_state WHERE key = $1", [key]);
  return result.rows[0]?.value ?? null;
}

async function writeStateKey(key: string, value: unknown, userId: string | null) {
  await query(
    `INSERT INTO app_state (key, value, updated_at, updated_by) VALUES ($1, $2::jsonb, $3, $4)
     ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by`,
    [key, JSON.stringify(value), new Date(), userId],
  );
}

export async function getAdcConnection(): Promise<AdcConnection | null> {
  if (cachedConnectionLoaded) return cachedConnection;
  cachedConnection = normalizeAdcConnection(await readStateKey(CONNECTION_KEY));
  cachedConnectionLoaded = true;
  return cachedConnection;
}

export async function saveAdcConnection(connection: AdcConnection, userId: string | null = null) {
  const normalized = normalizeAdcConnection(connection);
  if (!normalized) throw new Error("Invalid Alarm.com connection state");
  await writeStateKey(CONNECTION_KEY, normalized, userId);
  cachedConnection = normalized;
  return normalized;
}

export async function getAdcCameraConfigs(): Promise<AdcCameraConfig[]> {
  if (cachedCameras) return cachedCameras;
  cachedCameras = normalizeAdcCameraConfigs(await readStateKey(CAMERAS_KEY));
  return cachedCameras;
}

export async function saveAdcCameraConfigs(cameras: AdcCameraConfig[], userId: string) {
  const normalized = normalizeAdcCameraConfigs(cameras);
  await writeStateKey(CAMERAS_KEY, normalized, userId);
  cachedCameras = normalized;
  return normalized;
}

/** Apply a partial update (assignment / active / notes) to one device. */
export async function updateAdcCameraConfig(deviceId: string, patch: AdcCameraConfigPatch, userId: string) {
  const cameras = await getAdcCameraConfigs();
  const index = cameras.findIndex((camera) => camera.deviceId === deviceId);
  if (index < 0) return null;
  const current = cameras[index];
  const next: AdcCameraConfig = {
    ...current,
    assignment: isAdcAssignment(patch.assignment) ? patch.assignment : current.assignment,
    isActive: typeof patch.isActive === "boolean" ? patch.isActive : current.isActive,
    notes:
      patch.notes === undefined
        ? current.notes
        : patch.notes === null || !patch.notes.trim()
          ? undefined
          : patch.notes.trim().slice(0, 500),
  };
  cameras[index] = next;
  await saveAdcCameraConfigs(cameras, userId);
  return next;
}

/** Drop in-memory caches (used by tests / forced reloads). */
export function clearAdcConfigCache() {
  cachedConnection = null;
  cachedConnectionLoaded = false;
  cachedCameras = null;
}
