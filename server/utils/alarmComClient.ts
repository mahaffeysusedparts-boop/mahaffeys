/**
 * Alarm.com cloud bridge client (unofficial web API).
 *
 * Alarm.com exposes no public consumer camera API, so this client speaks the
 * same private JSON API the alarm.com web app uses (the approach of the
 * Home Assistant `alarmdotcom` integration). Because it is unofficial, every
 * endpoint URL lives in ADC_ENDPOINTS below and every failure surfaces as a
 * typed AdcError — if alarm.com changes shape, patch the constants/parsers in
 * this file only.
 *
 * Security posture:
 *  - Passwords and one-time codes exist only in transit / process memory
 *    (pending 2FA credentials are kept in RAM with a short TTL, never in the
 *    database). Only session cookies are persisted, in app_state.
 *  - All requests run server-side; browser code only ever talks to our
 *    same-origin /api/adc proxy routes.
 */
import {
  getAdcConnection,
  saveAdcConnection,
  type AdcConnection,
} from "./alarmComConfig";

// ---------------------------------------------------------------------------
// Endpoint registry — single place to patch when alarm.com changes.
// ---------------------------------------------------------------------------

export const ADC_WEB_BASE = "https://www.alarm.com";
const ADC_API_BASE = `${ADC_WEB_BASE}/web/api`;

export const ADC_ENDPOINTS = {
  identity: `${ADC_API_BASE}/auth/identity/get`,
  login: `${ADC_API_BASE}/auth/login`,
  logout: `${ADC_API_BASE}/auth/logout`,
  keepAlive: `${ADC_API_BASE}/auth/keepAlive`,
  twoFactorIssue: `${ADC_API_BASE}/auth/twoFactor/issue`,
  twoFactorAuthenticate: `${ADC_API_BASE}/auth/twoFactor/authenticate`,
  cameras: `${ADC_API_BASE}/cameras/cameras`,
  snapshot: (deviceId: string) => `${ADC_API_BASE}/cameras/cameras/${encodeURIComponent(deviceId)}/fullframe`,
  clips: `${ADC_API_BASE}/media/mediaItems`,
} as const;

const ADC_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const REQUEST_TIMEOUT_MS = 15_000;
/** Snapshot proxy rate limit: per-camera minimum interval between ADC hits. */
export const ADC_SNAPSHOT_MIN_INTERVAL_MS = 5_000;
/** Trust a verified session for this long before re-probing keepAlive. */
const SESSION_RECHECK_INTERVAL_MS = 10 * 60_000;
/** Health probes (status endpoint) are rate limited to one network hit each… */
const HEALTH_PROBE_INTERVAL_MS = 30_000;
/** Pending 2FA credentials are dropped from memory after this long. */
const PENDING_CREDENTIALS_TTL_MS = 10 * 60_000;

// ---------------------------------------------------------------------------
// Typed errors
// ---------------------------------------------------------------------------

export type AdcErrorReason = "NEEDS_LOGIN" | "NEEDS_OTP" | "ADC_UNAVAILABLE" | "CAMERA_OFFLINE" | "INVALID_RESPONSE";

export class AdcError extends Error {
  readonly reason: AdcErrorReason;
  readonly detail?: string;

  constructor(reason: AdcErrorReason, message: string, detail?: string) {
    super(message);
    this.name = "AdcError";
    this.reason = reason;
    this.detail = detail;
  }
}

export function isAdcError(error: unknown): error is AdcError {
  return error instanceof AdcError;
}

/** HTTP status the API routes should map each failure reason to. */
export function adcErrorStatusCode(reason: AdcErrorReason): number {
  switch (reason) {
    case "NEEDS_LOGIN":
    case "NEEDS_OTP":
      return 503;
    case "CAMERA_OFFLINE":
      return 502;
    case "ADC_UNAVAILABLE":
      return 504;
    case "INVALID_RESPONSE":
      return 502;
  }
}

// ---------------------------------------------------------------------------
// Cookie jar (pure helpers — unit tested)
// ---------------------------------------------------------------------------

export type AdcCookieJar = Record<string, string>;

/** Apply one raw `Set-Cookie` header line onto a jar (honouring deletion). */
export function applySetCookieLine(jar: AdcCookieJar, line: string): void {
  const parts = line.split(";");
  const [nameRaw, ...valueRest] = parts[0].split("=");
  const name = nameRaw.trim();
  if (!name) return;
  const value = valueRest.join("=").trim();

  let deleteCookie = value === "";
  for (const part of parts.slice(1)) {
    const [attrRaw, ...attrRest] = part.split("=");
    const attr = attrRaw.trim().toLowerCase();
    const attrValue = attrRest.join("=").trim();
    if (attr === "max-age" && attrValue !== "" && Number(attrValue) <= 0) deleteCookie = true;
    if (attr === "expires" && attrValue) {
      const expires = new Date(attrValue);
      if (!Number.isNaN(expires.getTime()) && expires.getTime() <= Date.now()) deleteCookie = true;
    }
  }

  if (deleteCookie) delete jar[name];
  else jar[name] = value;
}

export function applySetCookieLines(jar: AdcCookieJar, lines: string[]): void {
  for (const line of lines) applySetCookieLine(jar, line);
}

export function cookieHeader(jar: AdcCookieJar): string {
  return Object.entries(jar)
    .filter(([name]) => name)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function extractSetCookieLines(headers: Headers): string[] {
  const getter = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getter === "function") return getter.call(headers);
  const combined = headers.get("set-cookie");
  return combined ? [combined] : [];
}

// ---------------------------------------------------------------------------
// Response parsing (pure helpers — unit tested)
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** alarm.com wraps payloads as { result: … } / { data: … } depending on era. */
export function unwrapAdcPayload(json: unknown): unknown {
  if (isRecord(json)) {
    for (const key of ["result", "data", "value"]) {
      const inner = json[key];
      if (inner !== null && typeof inner === "object") return inner;
    }
  }
  return json;
}

export interface AdcIdentityProbe {
  requiresTwoFactor: boolean;
  twoFactorType?: number;
  deviceId?: string;
  captchaRequired: boolean;
  message?: string;
}

/** Interpret the identity/login probe response (2FA demand, captcha, errors). */
export function parseIdentityResponse(json: unknown): AdcIdentityProbe {
  const payload = unwrapAdcPayload(json) as unknown;
  const probe: AdcIdentityProbe = { requiresTwoFactor: false, captchaRequired: false };

  if (!isRecord(payload)) return probe;

  for (const key of ["twoFactorAuthenticationRequired", "newDeviceTwoFactorRequired", "requiresTwoFactorAuthentication", "requires2FA"]) {
    if (payload[key] === true) probe.requiresTwoFactor = true;
  }
  if (payload.captchaRequired === true || payload.requiresCaptcha === true) probe.captchaRequired = true;
  if (typeof payload.twoFactorType === "number") probe.twoFactorType = payload.twoFactorType;
  for (const key of ["deviceId", "twoFactorDeviceId"]) {
    const value = payload[key];
    if (typeof value === "string" && value) probe.deviceId ??= value;
    else if (typeof value === "number") probe.deviceId ??= String(value);
  }

  const directMessage = payload.errorMessage ?? payload.message;
  if (typeof directMessage === "string" && directMessage) probe.message = directMessage;
  const errors = payload.errors;
  if (!probe.message && Array.isArray(errors)) {
    const first = errors.find((item) => isRecord(item) && typeof item.message === "string") as { message?: string } | undefined;
    if (first?.message) probe.message = first.message;
  }
  return probe;
}

function responseContentType(response: Response): string {
  return (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
}

/**
 * Explain a failed alarm.com auth call truthfully instead of always blaming
 * the password. The real-world failure modes:
 *  - JSON error (HTTP 400/401) → alarm.com's own message ("Invalid username
 *    or password", SSO-only account, locked out, …)
 *  - HTML page (HTTP 403/429/503) → Cloudflare bot protection blocked this
 *    server — a CORRECT password still looks "rejected"
 *  - anything else → keep the HTTP status visible so endpoint drift is
 *    diagnosable straight from the admin UI banner
 */
export function authFailureMessage(response: Response, json: unknown, fallback: string): string {
  if (responseContentType(response).includes("text/html")) {
    if (response.status === 403 || response.status === 429 || response.status === 503) {
      return `Alarm.com's bot protection blocked this server's connection (Cloudflare, HTTP ${response.status}) — wait a few minutes and try again, or attempt the sign-in from the yard's network`;
    }
    return `Alarm.com answered with a web page instead of its API (HTTP ${response.status}) — the bridge endpoints may have moved`;
  }
  const parsed = parseIdentityResponse(json).message;
  if (parsed) return parsed;
  if (response.status === 429) return "Alarm.com is rate limiting this server — wait a few minutes and try again";
  return `${fallback} (HTTP ${response.status})`;
}

export interface AdcCameraDevice {
  deviceId: string;
  name: string;
  location?: string;
}

function toCameraDevice(item: Record<string, unknown>): AdcCameraDevice | null {
  const id = item.id ?? item.deviceId ?? item.entityId;
  if (id === undefined || id === null || id === "") return null;
  const deviceId = String(id);
  const name = item.name ?? item.description ?? item.label;
  const locationSource = item.location;
  const location =
    typeof locationSource === "string" && locationSource.trim()
      ? locationSource.trim()
      : isRecord(locationSource) && typeof (locationSource as { name?: unknown }).name === "string"
        ? String((locationSource as { name: string }).name)
        : undefined;
  return {
    deviceId,
    name: typeof name === "string" && name.trim() ? name.trim() : `Alarm.com camera ${deviceId}`,
    location,
  };
}

/** Pull the camera device list out of any plausible response envelope. */
export function parseCamerasResponse(json: unknown): AdcCameraDevice[] {
  const payload = unwrapAdcPayload(json);
  const found = findCameraArray(payload, 0);
  return found ?? [];
}

function findCameraArray(value: unknown, depth: number): AdcCameraDevice[] | null {
  if (Array.isArray(value)) {
    const mapped = value
      .filter((item) => isRecord(item))
      .map((item) => toCameraDevice(item as Record<string, unknown>))
      .filter((device): device is AdcCameraDevice => device !== null);
    if (mapped.length > 0 && mapped.length >= Math.ceil(value.length / 2)) return mapped;
    return null;
  }
  if (depth >= 4 || !isRecord(value)) return null;
  // Prefer the conventional keys first…
  for (const key of ["cameras", "data", "items", "results"]) {
    if (key in value) {
      const result = findCameraArray(value[key], depth + 1);
      if (result) return result;
    }
  }
  // …then fall back to a shallow structural search.
  for (const child of Object.values(value)) {
    const result = findCameraArray(child, depth + 1);
    if (result) return result;
  }
  return null;
}

export interface AdcClip {
  clipId: string;
  deviceId?: string;
  name?: string;
  startTime?: string;
  durationSeconds?: number;
  videoUrl: string;
}

const CLIP_URL_KEYS = ["url", "videoUrl", "downloadUrl", "fileUrl", "mediaUrl"] as const;

function toClip(item: Record<string, unknown>): AdcClip | null {
  const videoUrl = CLIP_URL_KEYS.map((key) => item[key]).find(
    (value): value is string => typeof value === "string" && /^https?:\/\//.test(value),
  );
  if (!videoUrl) return null;
  const id = item.id ?? item.clipId ?? item.mediaId ?? item.guid;
  if (id === undefined || id === null || id === "") return null;
  const cameraId = item.cameraId ?? (isRecord(item.camera) ? (item.camera as { id?: unknown }).id : undefined);
  const duration = Number(item.duration ?? item.durationSeconds);
  return {
    clipId: String(id),
    deviceId: cameraId !== undefined && cameraId !== null ? String(cameraId) : undefined,
    name: typeof item.name === "string" && item.name ? item.name : typeof item.title === "string" ? item.title : undefined,
    startTime: [item.startTime, item.startDate, item.createdDate, item.createdAt].find(
      (value): value is string => typeof value === "string" && value,
    ),
    durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : undefined,
    videoUrl,
  };
}

/** Pull motion clips out of any plausible media-library response envelope. */
export function parseClipsResponse(json: unknown): AdcClip[] {
  const payload = unwrapAdcPayload(json);
  const found = findClipArray(payload, 0);
  return found ?? [];
}

function findClipArray(value: unknown, depth: number): AdcClip[] | null {
  if (Array.isArray(value)) {
    const mapped = value
      .filter((item) => isRecord(item))
      .map((item) => toClip(item as Record<string, unknown>))
      .filter((clip): clip is AdcClip => clip !== null);
    if (mapped.length > 0 && mapped.length >= Math.ceil(value.length / 2)) return mapped;
    return null;
  }
  if (depth >= 4 || !isRecord(value)) return null;
  for (const key of ["clips", "mediaItems", "data", "items", "results"]) {
    if (key in value) {
      const result = findClipArray(value[key], depth + 1);
      if (result) return result;
    }
  }
  for (const child of Object.values(value)) {
    const result = findClipArray(child, depth + 1);
    if (result) return result;
  }
  return null;
}

// ---------------------------------------------------------------------------
// HTTP layer
// ---------------------------------------------------------------------------

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function adcFetch(
  url: string,
  options: { jar: AdcCookieJar; method?: string; body?: string; accept?: string },
): Promise<Response> {
  const headers: Record<string, string> = {
    "User-Agent": ADC_USER_AGENT,
    Accept: options.accept ?? "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    Origin: ADC_WEB_BASE,
    Referer: `${ADC_WEB_BASE}/web/login`,
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json; charset=UTF-8";
  const cookie = cookieHeader(options.jar);
  if (cookie) headers.Cookie = cookie;

  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body,
      redirect: "follow",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    applySetCookieLines(options.jar, extractSetCookieLines(response.headers));
    return response;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new AdcError("ADC_UNAVAILABLE", "Could not reach alarm.com", detail);
  }
}

/**
 * Load the login page once before authenticating — exactly what a browser
 * does — so alarm.com's edge hands out its afg / Cloudflare cookies before
 * any API call. A raw API POST without those cookies is the classic way a
 * CORRECT password gets "rejected". Best-effort: failure never blocks login.
 */
async function primeWebSession(jar: AdcCookieJar): Promise<void> {
  try {
    await adcFetch(`${ADC_WEB_BASE}/web/login`, {
      jar,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    });
  } catch {
    /* best-effort */
  }
}

/** 401/403 from alarm.com means the persisted session died — record that. */
async function assertNotAuthFailure(response: Response): Promise<void> {
  if (response.status !== 401 && response.status !== 403) return;
  const connection = await getAdcConnection();
  if (connection) {
    await saveAdcConnection({ ...connection, status: "NEEDS_LOGIN", errorMessage: "Session expired — sign in again" });
  }
  throw new AdcError("NEEDS_LOGIN", "The Alarm.com session expired — reconnect it in Server Admin");
}

async function requireConnectedSession(): Promise<AdcConnection> {
  const connection = await getAdcConnection();
  if (!connection || Object.keys(connection.cookies).length === 0) {
    throw new AdcError("NEEDS_LOGIN", "Alarm.com is not connected — an administrator must sign in");
  }
  if (connection.status === "NEEDS_OTP") {
    throw new AdcError("NEEDS_LOGIN", "Alarm.com is waiting for its 2FA code — finish connecting it in Server Admin");
  }
  if (
    !connection.lastVerifiedAt ||
    Date.now() - new Date(connection.lastVerifiedAt).getTime() > SESSION_RECHECK_INTERVAL_MS
  ) {
    const healthy = await probeKeepAlive(connection);
    if (!healthy) throw new AdcError("NEEDS_LOGIN", "The Alarm.com session expired — reconnect it in Server Admin");
  }
  return connection;
}

async function probeKeepAlive(connection: AdcConnection): Promise<boolean> {
  const response = await adcFetch(ADC_ENDPOINTS.keepAlive, {
    jar: connection.cookies,
    method: "POST",
    body: "{}",
  });
  if (response.status === 401 || response.status === 403) {
    await saveAdcConnection({ ...connection, status: "NEEDS_LOGIN", errorMessage: "Session expired — sign in again" });
    return false;
  }
  if (response.ok) {
    await saveAdcConnection({ ...connection, status: "CONNECTED", errorMessage: undefined, lastVerifiedAt: new Date().toISOString() });
    return true;
  }
  // Network-level failure — keep the previous state instead of killing the session.
  return connection.status === "CONNECTED";
}

// ---------------------------------------------------------------------------
// Login state machine
// ---------------------------------------------------------------------------

/**
 * Credentials for a half-finished 2FA login. Kept ONLY in process memory with
 * a TTL — never written to the database or logs.
 */
let pendingCredentials: { username: string; password: string; expiresAt: number } | null = null;

function stashPendingCredentials(username: string, password: string) {
  pendingCredentials = { username, password, expiresAt: Date.now() + PENDING_CREDENTIALS_TTL_MS };
}

function takePendingCredentials(): { username: string; password: string } | null {
  if (!pendingCredentials) return null;
  if (Date.now() > pendingCredentials.expiresAt) {
    pendingCredentials = null;
    return null;
  }
  const { username, password } = pendingCredentials;
  return { username, password };
}

function clearPendingCredentials() {
  pendingCredentials = null;
}

async function postJson(url: string, jar: AdcCookieJar, body: Record<string, unknown>): Promise<{ response: Response; json: unknown }> {
  const response = await adcFetch(url, { jar, method: "POST", body: JSON.stringify(body) });
  return { response, json: await readJsonBody(response) };
}

/** Step 1 of login: probe identity; returns NEEDS_OTP state if ADC demands 2FA. */
export async function loginAlarmCom(username: string, password: string): Promise<AdcConnection> {
  const connection: AdcConnection = { status: "NEEDS_LOGIN", username, cookies: {} };
  const jar = connection.cookies;

  // Seed browser cookies first — the edge expects them on later API calls.
  await primeWebSession(jar);

  const { response, json } = await postJson(ADC_ENDPOINTS.identity, jar, { username, password });
  const probe = parseIdentityResponse(json);

  if (probe.captchaRequired) {
    await saveAdcConnection({ ...connection, status: "ERROR", errorMessage: "Alarm.com requested a CAPTCHA challenge — wait a few minutes and try again" });
    throw new AdcError("NEEDS_LOGIN", "Alarm.com requested a CAPTCHA challenge — wait a few minutes and try again");
  }
  if (!response.ok) {
    const message = authFailureMessage(response, json, "Alarm.com rejected the sign-in");
    await saveAdcConnection({ ...connection, status: "NEEDS_LOGIN", errorMessage: message });
    throw new AdcError("NEEDS_LOGIN", message, `identity check → HTTP ${response.status} (${responseContentType(response)})`);
  }
  if (probe.requiresTwoFactor) {
    // Ask ADC to text/e-mail the one-time code. Accounts that auto-send (or
    // remember this device) will simply already have the code waiting; a
    // failure here is non-fatal because many accounts deliver automatically.
    try {
      await postJson(ADC_ENDPOINTS.twoFactorIssue, jar, {
        twoFactorType: probe.twoFactorType ?? 0,
        ...(probe.deviceId ? { deviceId: probe.deviceId } : {}),
      });
    } catch {
      /* best-effort — the code may already be on its way */
    }
    stashPendingCredentials(username, password);
    connection.status = "NEEDS_OTP";
    connection.twoFactorDeviceId = probe.deviceId;
    connection.errorMessage = undefined;
    await saveAdcConnection(connection);
    return connection;
  }

  return completeLogin(username, password, jar);
}

/** Final login call after any 2FA step; verifies the session on success. */
async function completeLogin(username: string, password: string, jar: AdcCookieJar): Promise<AdcConnection> {
  const { response, json } = await postJson(ADC_ENDPOINTS.login, jar, {
    username,
    password,
    isConsumer: true, // mirrors the web client payload (consumer accounts); ignored otherwise
  });
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    const message = authFailureMessage(response, json, "Alarm.com rejected the sign-in");
    await saveAdcConnection({ status: "NEEDS_LOGIN", username, cookies: jar, errorMessage: message });
    throw new AdcError("NEEDS_LOGIN", message, `login → HTTP ${response.status} (${responseContentType(response)})`);
  }
  if (!response.ok) {
    throw new AdcError("ADC_UNAVAILABLE", `Alarm.com login failed (HTTP ${response.status})`);
  }

  const connection: AdcConnection = {
    status: "CONNECTED",
    username,
    cookies: jar,
    errorMessage: undefined,
  };
  // Verify the jar actually carries an authenticated session.
  const verified = await probeKeepAlive(connection);
  if (!verified) {
    throw new AdcError("NEEDS_LOGIN", "Alarm.com accepted the login but the session did not persist");
  }
  clearPendingCredentials();
  const stored = await getAdcConnection();
  return { ...connection, lastSyncAt: stored?.lastSyncAt, cameraCount: stored?.cameraCount };
}

/** Step 2 of login: submit the 6-digit two-factor code. */
export async function submitAdcOtp(code: string): Promise<AdcConnection> {
  const connection = await getAdcConnection();
  if (!connection || connection.status !== "NEEDS_OTP") {
    throw new AdcError("NEEDS_LOGIN", "No pending Alarm.com two-factor prompt — start the sign-in again");
  }
  const credentials = takePendingCredentials();
  if (!credentials) {
    throw new AdcError("NEEDS_LOGIN", "The login attempt expired (passwords are never stored) — sign in again");
  }

  const jar = connection.cookies;
  const { response, json } = await postJson(ADC_ENDPOINTS.twoFactorAuthenticate, jar, {
    oneTimePassword: code,
    rememberDevice: true,
    ...(connection.twoFactorDeviceId ? { deviceId: connection.twoFactorDeviceId } : {}),
  });
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    const message = authFailureMessage(response, json, "Alarm.com rejected that verification code");
    throw new AdcError("NEEDS_OTP", message, `twoFactor/authenticate → HTTP ${response.status} (${responseContentType(response)})`);
  }
  if (!response.ok) {
    throw new AdcError("ADC_UNAVAILABLE", `Alarm.com two-factor check failed (HTTP ${response.status})`);
  }

  return completeLogin(credentials.username, credentials.password, jar);
}

export async function logoutAlarmCom(): Promise<void> {
  const connection = await getAdcConnection();
  if (connection && Object.keys(connection.cookies).length > 0) {
    try {
      await adcFetch(ADC_ENDPOINTS.logout, { jar: connection.cookies, method: "POST", body: "{}" });
    } catch {
      /* best-effort — clear locally regardless */
    }
  }
  clearPendingCredentials();
  snapshotCache.clear();
  await saveAdcConnection({ status: "NEEDS_LOGIN", username: connection?.username, cookies: {} });
}

// ---------------------------------------------------------------------------
// Session health
// ---------------------------------------------------------------------------

export interface AdcHealthSummary {
  status: AdcConnection["status"];
  username?: string;
  lastVerifiedAt?: string;
  lastSyncAt?: string;
  cameraCount?: number;
  errorMessage?: string;
}

let lastHealthProbe = { at: 0, summary: null as AdcHealthSummary | null };

/** Connection state for banners; network probe is rate limited to 1/30s. */
export async function checkAdcHealth(options: { force?: boolean } = {}): Promise<AdcHealthSummary> {
  const connection = await getAdcConnection();

  if (!connection || Object.keys(connection.cookies).length === 0) {
    const summary: AdcHealthSummary = {
      status: connection?.status === "NEEDS_OTP" ? "NEEDS_OTP" : "NEEDS_LOGIN",
      username: connection?.username,
      lastSyncAt: connection?.lastSyncAt,
      cameraCount: connection?.cameraCount,
      errorMessage: connection?.errorMessage,
    };
    lastHealthProbe = { at: Date.now(), summary };
    return summary;
  }
  if (connection.status === "NEEDS_OTP") {
    const summary: AdcHealthSummary = {
      status: "NEEDS_OTP",
      username: connection.username,
      lastSyncAt: connection.lastSyncAt,
      cameraCount: connection.cameraCount,
      errorMessage: connection.errorMessage,
    };
    lastHealthProbe = { at: Date.now(), summary };
    return summary;
  }

  if (!options.force && lastHealthProbe.summary && Date.now() - lastHealthProbe.at < HEALTH_PROBE_INTERVAL_MS) {
    return lastHealthProbe.summary;
  }

  await probeKeepAlive(connection);
  const fresh = await getAdcConnection();
  const summary: AdcHealthSummary = {
    status: fresh?.status ?? "NEEDS_LOGIN",
    username: fresh?.username,
    lastVerifiedAt: fresh?.lastVerifiedAt,
    lastSyncAt: fresh?.lastSyncAt,
    cameraCount: fresh?.cameraCount,
    errorMessage: fresh?.errorMessage,
  };
  lastHealthProbe = { at: Date.now(), summary };
  return summary;
}

// ---------------------------------------------------------------------------
// Cameras, snapshots, clips
// ---------------------------------------------------------------------------

export async function listAdcCameras(): Promise<AdcCameraDevice[]> {
  const connection = await requireConnectedSession();
  const response = await adcFetch(ADC_ENDPOINTS.cameras, { jar: connection.cookies });
  await assertNotAuthFailure(response);
  if (!response.ok) {
    throw new AdcError("ADC_UNAVAILABLE", `Alarm.com camera list failed (HTTP ${response.status})`);
  }
  const cameras = parseCamerasResponse(await readJsonBody(response));
  if (cameras.length === 0) {
    throw new AdcError("INVALID_RESPONSE", "Alarm.com returned no recognizable cameras", ADC_ENDPOINTS.cameras);
  }
  return cameras;
}

export interface AdcSnapshotFrame {
  body: ArrayBuffer;
  contentType: string;
  capturedAt: number;
  fromCache: boolean;
}

/** Raw snapshot fetch — always the freshest frame the cloud can serve. */
export async function getAdcSnapshot(deviceId: string): Promise<{ body: ArrayBuffer; contentType: string }> {
  if (!/^[\w-]{1,64}$/.test(deviceId)) throw new AdcError("INVALID_RESPONSE", "Invalid Alarm.com device id");
  const connection = await requireConnectedSession();
  const response = await adcFetch(ADC_ENDPOINTS.snapshot(deviceId), {
    jar: connection.cookies,
    accept: "image/jpeg,image/png,image/*;q=0.8",
  });
  await assertNotAuthFailure(response);
  if (response.status === 404 || response.status === 410) {
    throw new AdcError("CAMERA_OFFLINE", "That Alarm.com camera is offline or unavailable");
  }
  if (!response.ok) {
    throw new AdcError("ADC_UNAVAILABLE", `Alarm.com snapshot failed (HTTP ${response.status})`);
  }
  const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!contentType.startsWith("image/")) {
    throw new AdcError("INVALID_RESPONSE", "Alarm.com snapshot returned a non-image response", contentType);
  }
  const body = await response.arrayBuffer();
  if (body.byteLength === 0) {
    throw new AdcError("CAMERA_OFFLINE", "That Alarm.com camera returned an empty frame");
  }
  return { body, contentType: contentType || "image/jpeg" };
}

const snapshotCache = new Map<string, { body: ArrayBuffer; contentType: string; capturedAt: number }>();
const inflightSnapshots = new Map<string, Promise<AdcSnapshotFrame>>();

/**
 * Rate-limited snapshot used by the proxy route: if the freshest frame is
 * younger than ADC_SNAPSHOT_MIN_INTERVAL_MS it is served from cache, and
 * concurrent requests for the same camera share one upstream fetch. A wall of
 * refreshing tiles therefore cannot hammer alarm.com.
 */
export async function getAdcSnapshotCached(deviceId: string): Promise<AdcSnapshotFrame> {
  const cached = snapshotCache.get(deviceId);
  if (cached && Date.now() - cached.capturedAt < ADC_SNAPSHOT_MIN_INTERVAL_MS) {
    return { ...cached, fromCache: true };
  }
  const inflight = inflightSnapshots.get(deviceId);
  if (inflight) return inflight;

  const promise = (async (): Promise<AdcSnapshotFrame> => {
    try {
      const frame = await getAdcSnapshot(deviceId);
      const entry = { body: frame.body, contentType: frame.contentType, capturedAt: Date.now() };
      snapshotCache.set(deviceId, entry);
      return { ...entry, fromCache: false };
    } finally {
      inflightSnapshots.delete(deviceId);
    }
  })();
  inflightSnapshots.set(deviceId, promise);
  return promise;
}

export async function listAdcClips(deviceId?: string): Promise<AdcClip[]> {
  const connection = await requireConnectedSession();
  const params = new URLSearchParams({ pageSize: "50" });
  if (deviceId) params.set("cameraIds", deviceId);
  const response = await adcFetch(`${ADC_ENDPOINTS.clips}?${params.toString()}`, { jar: connection.cookies });
  await assertNotAuthFailure(response);
  if (!response.ok) {
    throw new AdcError("ADC_UNAVAILABLE", `Alarm.com clip list failed (HTTP ${response.status})`);
  }
  const clips = parseClipsResponse(await readJsonBody(response));
  if (clips.length === 0) {
    throw new AdcError("INVALID_RESPONSE", "Alarm.com returned no recognizable clips", ADC_ENDPOINTS.clips);
  }
  return clips.sort((a, b) => (b.startTime ?? "").localeCompare(a.startTime ?? ""));
}

/** Resolve one clip id to its (signed) video URL and stream the MP4 bytes. */
export async function getAdcClipVideo(clipId: string): Promise<{ body: ArrayBuffer; contentType: string }> {
  const connection = await requireConnectedSession();
  const params = new URLSearchParams({ pageSize: "100" });
  const response = await adcFetch(`${ADC_ENDPOINTS.clips}?${params.toString()}`, { jar: connection.cookies });
  await assertNotAuthFailure(response);
  if (!response.ok) {
    throw new AdcError("ADC_UNAVAILABLE", `Alarm.com clip lookup failed (HTTP ${response.status})`);
  }
  const clip = parseClipsResponse(await readJsonBody(response)).find((item) => item.clipId === clipId);
  if (!clip) throw new AdcError("CAMERA_OFFLINE", "That clip is no longer available on alarm.com");

  const videoResponse = await adcFetch(clip.videoUrl, { jar: connection.cookies, accept: "video/mp4,video/*;q=0.8,*/*;q=0.5" });
  if (!videoResponse.ok) {
    throw new AdcError("ADC_UNAVAILABLE", `Alarm.com clip download failed (HTTP ${videoResponse.status})`);
  }
  const contentType = (videoResponse.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const body = await videoResponse.arrayBuffer();
  if (body.byteLength === 0) throw new AdcError("ADC_UNAVAILABLE", "Alarm.com clip download returned no data");
  return { body, contentType: contentType.startsWith("video/") || contentType === "application/octet-stream" ? contentType || "video/mp4" : "video/mp4" };
}

/** Record a successful sync (device names/count) on the stored connection. */
export async function markAdcSynced(cameraCount: number) {
  const connection = await getAdcConnection();
  if (!connection) return;
  await saveAdcConnection({
    ...connection,
    lastSyncAt: new Date().toISOString(),
    cameraCount,
    errorMessage: connection.status === "ERROR" ? undefined : connection.errorMessage,
  });
}
