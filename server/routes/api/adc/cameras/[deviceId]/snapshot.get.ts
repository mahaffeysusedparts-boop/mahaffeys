import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { requireUser } from "../../../../../utils/auth";
import { adcErrorStatusCode, getAdcSnapshotCached, isAdcError } from "../../../../../utils/alarmComClient";

/**
 * Same-origin snapshot proxy — what the camera wall tiles, the compliance
 * capture canvas, and fullscreen views consume. Enforces the per-camera
 * rate limit (cached frame served inside the minimum interval).
 */
export default defineHandler(async (event) => {
  await requireUser(event);
  const deviceId = getRouterParam(event, "deviceId") || "";
  if (!deviceId || !/^[\w-]{1,64}$/.test(deviceId)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid Alarm.com camera id" });
  }

  try {
    const frame = await getAdcSnapshotCached(deviceId);
    return new Response(frame.body, {
      headers: {
        "Content-Type": frame.contentType,
        "Cache-Control": "no-store, private",
        "X-Adc-Captured-At": String(frame.capturedAt),
        "X-Adc-Frame-Cached": frame.fromCache ? "1" : "0",
        "X-Entrance-Camera-Id": `adc-${deviceId}`,
      },
    });
  } catch (error) {
    if (isAdcError(error)) {
      throw createError({ statusCode: adcErrorStatusCode(error.reason), statusMessage: error.message });
    }
    throw error;
  }
});
