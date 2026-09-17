import { defineHandler } from "nitro";
import { createError, getRouterParam, readBody } from "nitro/h3";
import { requireAdmin } from "../../../../../utils/auth";
import { auditFor, recordAudit } from "../../../../../utils/audit";
import { isAdcAssignment, updateAdcCameraConfig } from "../../../../../utils/alarmComConfig";

/** Assignment / active / notes for one Alarm.com camera (URLs stay bridge-managed). */
export default defineHandler(async (event) => {
  const user = await requireAdmin(event);
  const deviceId = getRouterParam(event, "deviceId") || "";
  if (!deviceId || !/^[\w-]{1,64}$/.test(deviceId)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid Alarm.com camera id" });
  }

  const body = await readBody<{ assignment?: string; isActive?: boolean; notes?: string | null }>(event);
  if (body.assignment !== undefined && !isAdcAssignment(body.assignment)) {
    throw createError({ statusCode: 400, statusMessage: "Unknown yard assignment" });
  }
  if (body.isActive !== undefined && typeof body.isActive !== "boolean") {
    throw createError({ statusCode: 400, statusMessage: "isActive must be true or false" });
  }
  if (body.notes !== undefined && body.notes !== null && typeof body.notes !== "string") {
    throw createError({ statusCode: 400, statusMessage: "notes must be text" });
  }

  const updated = await updateAdcCameraConfig(deviceId, {
    assignment: isAdcAssignment(body.assignment) ? body.assignment : undefined,
    isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    notes: body.notes,
  }, user.id);

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: "That Alarm.com camera has not been synced yet" });
  }

  await recordAudit(auditFor(user, {
    action: "adc.camera_config",
    entity: "alarmcom_camera",
    entityId: deviceId,
    detail: { name: updated.name, assignment: updated.assignment, isActive: updated.isActive },
  }));

  return { camera: updated };
});
