import { defineHandler } from "nitro";
import { requireUser } from "../../../utils/auth";
import { checkAdcHealth, isAdcError, listAdcCameras } from "../../../utils/alarmComClient";
import { getAdcCameraConfigs } from "../../../utils/alarmComConfig";
import type { IpCamera } from "../../../../src/types/scrap";

/**
 * Alarm.com cameras as IpCamera-shaped objects so every existing consumer
 * (camera grid, compliance picker, LPR) can treat them like any other cam.
 * The snapshot URL is a same-origin proxy route, never an alarm.com URL.
 */
function adcSnapshotProxyUrl(deviceId: string) {
  return `/api/adc/cameras/${encodeURIComponent(deviceId)}/snapshot.jpg`;
}

export default defineHandler(async (event) => {
  await requireUser(event);

  const health = await checkAdcHealth();

  // Prefer live device names; fall back to the last-synced names when the
  // session is down so the wall can still render (with an expired banner).
  let devices: Awaited<ReturnType<typeof listAdcCameras>> | null = null;
  let warning: string | undefined;
  try {
    devices = await listAdcCameras();
  } catch (error) {
    if (isAdcError(error)) warning = error.message;
    else throw error;
  }

  const configs = await getAdcCameraConfigs();
  const cameras: IpCamera[] = configs.map((config) => {
    const device = devices?.find((item) => item.deviceId === config.deviceId);
    return {
      id: `adc-${config.deviceId}`,
      name: device?.name || config.name,
      ipAddress: "alarm.com",
      streamUrl: adcSnapshotProxyUrl(config.deviceId),
      snapshotUrl: adcSnapshotProxyUrl(config.deviceId),
      cameraType: "SNAPSHOT",
      assignment: config.assignment,
      isActive: config.isActive,
      notes: config.notes,
      createdAt: health.lastSyncAt ?? new Date(0).toISOString(),
      provider: "ALARM_COM",
      adcDeviceId: config.deviceId,
      adcLocation: device?.location || config.location,
    };
  });

  return { status: health.status, cameras, warning };
});
