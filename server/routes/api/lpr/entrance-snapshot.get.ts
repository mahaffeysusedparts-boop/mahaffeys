import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { requireUser } from "../../../utils/auth";
import { query } from "../../../utils/db";
import { getAdcSnapshot, isAdcError } from "../../../utils/alarmComClient";
import { getAdcCameraConfigs } from "../../../utils/alarmComConfig";

interface EntranceCamera {
  id: string;
  ipAddress: string;
  streamUrl: string;
  snapshotUrl?: string;
  cameraType: "MJPEG" | "SNAPSHOT" | "HLS" | "RTSP_STREAM";
  assignment: string;
  username?: string;
  password?: string;
  isActive: boolean;
}

interface CameraStateRow {
  value: unknown;
}

function configuredHost(camera: EntranceCamera) {
  const value = camera.ipAddress.trim();
  try {
    return new URL(value.includes("://") ? value : `http://${value}`).hostname;
  } catch {
    return "";
  }
}

/** Serve a frame from the Alarm.com scale camera through the cloud bridge. */
async function serveAlarmComEntrance(deviceId: string) {
  try {
    const frame = await getAdcSnapshot(deviceId); // freshest available frame, bypassing the tile cache
    return new Response(frame.body, {
      headers: {
        "Content-Type": frame.contentType,
        "Cache-Control": "no-store, private",
        "X-Entrance-Camera-Id": `adc-${deviceId}`,
        "X-Entrance-Camera-Provider": "ALARM_COM",
      },
    });
  } catch (error) {
    if (isAdcError(error)) {
      throw createError({ statusCode: 503, statusMessage: `Alarm.com scale camera unavailable: ${error.message}` });
    }
    throw error;
  }
}

export default defineHandler(async (event) => {
  await requireUser(event);

  // Alarm.com cameras live server-side (mahaffeys_adc_cameras) rather than in
  // the workstation-synced local camera list. A purpose-built local LAN camera
  // always wins when both claim the LICENSE_PLATE assignment (lower latency);
  // the cloud camera also covers the "local cam has no snapshot URL" case.
  const adcCameras = await getAdcCameraConfigs();
  const adcEntrance = adcCameras.find((camera) => camera.isActive && camera.assignment === "LICENSE_PLATE");

  const result = await query<CameraStateRow>("SELECT value FROM app_state WHERE key = 'mahaffeys_ip_cameras'");
  const cameras = Array.isArray(result.rows[0]?.value) ? result.rows[0].value as EntranceCamera[] : [];
  const camera = cameras.find((item) => item.isActive && item.assignment === "LICENSE_PLATE");

  if (!camera) {
    if (adcEntrance) return serveAlarmComEntrance(adcEntrance.deviceId);
    throw createError({ statusCode: 404, statusMessage: "No active scale entrance license plate camera is configured" });
  }

  const source = camera.snapshotUrl || (camera.cameraType === "SNAPSHOT" ? camera.streamUrl : "");
  if (!source) {
    if (adcEntrance) return serveAlarmComEntrance(adcEntrance.deviceId);
    throw createError({ statusCode: 409, statusMessage: "The entrance camera needs an HTTP snapshot URL for automatic LPR" });
  }

  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw createError({ statusCode: 400, statusMessage: "The entrance camera snapshot URL is invalid" });
  }
  const allowedProtocols = ["http:", "https:"];
  if (!allowedProtocols.includes(url.protocol) || url.hostname !== configuredHost(camera)) {
    throw createError({ statusCode: 400, statusMessage: "The snapshot URL must use the configured camera host" });
  }

  const headers: Record<string, string> = { Accept: "image/jpeg,image/png,image/webp" };
  if (camera.username) {
    const credentials = `${camera.username}:${camera.password ?? ""}`;
    headers.Authorization = `Basic ${Buffer.from(credentials).toString("base64")}`;
  }

  const response = await fetch(url, { headers, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw createError({ statusCode: 502, statusMessage: "The scale entrance camera did not return a snapshot" });
  const contentType = response.headers.get("content-type")?.split(";")[0] || "";
  if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(contentType)) {
    throw createError({ statusCode: 502, statusMessage: "The entrance camera returned an unsupported image format" });
  }
  const image = await response.arrayBuffer();
  if (!image.byteLength || image.byteLength > 10 * 1024 * 1024) {
    throw createError({ statusCode: 502, statusMessage: "The entrance camera snapshot is empty or too large" });
  }

  return new Response(image, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store, private",
      "X-Entrance-Camera-Id": camera.id,
      "X-Entrance-Camera-Provider": "LOCAL",
    },
  });
});
