import { defineHandler } from "nitro";
import { createError, getRequestHeaders, getRequestURL } from "nitro/h3";
import { requireAdmin } from "../../../utils/auth";
import { auditFor, recordAudit } from "../../../utils/audit";
import { isAdcError, listAdcCameras, markAdcSynced } from "../../../utils/alarmComClient";
import { getAdcCameraConfigs, saveAdcCameraConfigs, type AdcCameraConfig } from "../../../utils/alarmComConfig";

export default defineHandler(async (event) => {
  const user = await requireAdmin(event);
  const origin = getRequestHeaders(event).origin;
  try {
    if (!origin || new URL(origin).host !== getRequestURL(event).host) throw new Error("origin mismatch");
  } catch {
    throw createError({ statusCode: 403, statusMessage: "Same-origin request required" });
  }

  let devices;
  try {
    devices = await listAdcCameras();
  } catch (error) {
    if (isAdcError(error)) {
      throw createError({ statusCode: 400, statusMessage: error.message });
    }
    throw error;
  }

  // Merge the fresh device list with existing assignments; new cameras default
  // to OTHER + active, removed cameras drop out (their assignments die with them).
  const existing = await getAdcCameraConfigs();
  const byDevice = new Map(existing.map((camera) => [camera.deviceId, camera]));
  const merged: AdcCameraConfig[] = devices.map((device) => {
    const prior = byDevice.get(device.deviceId);
    return {
      deviceId: device.deviceId,
      name: device.name,
      location: device.location,
      assignment: prior?.assignment ?? "OTHER",
      isActive: prior?.isActive ?? true,
      notes: prior?.notes,
    };
  });

  await saveAdcCameraConfigs(merged, user.id);
  await markAdcSynced(merged.length);
  await recordAudit(auditFor(user, {
    action: "adc.sync",
    entity: "alarmcom",
    detail: { cameraCount: merged.length, cameras: merged.map((camera) => `${camera.name} (${camera.location ?? "no location"})`) },
  }));

  return { syncedAt: new Date().toISOString(), cameras: merged };
});
