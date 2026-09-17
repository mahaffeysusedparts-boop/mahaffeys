import { defineHandler } from "nitro";
import { createError, getQuery } from "nitro/h3";
import { requireUser } from "../../../utils/auth";
import { isAdcError, listAdcClips } from "../../../utils/alarmComClient";

/** Recent motion-triggered recordings for one camera (or all cameras). */
export default defineHandler(async (event) => {
  await requireUser(event);

  const deviceId = getQuery(event).deviceId;
  const target = typeof deviceId === "string" && /^[\w-]{1,64}$/.test(deviceId) ? deviceId : undefined;

  try {
    const clips = await listAdcClips(target);
    // Signed video URLs are internal to the bridge — clients stream through
    // the same-origin /api/adc/clips/<id>/video proxy instead.
    return {
      clips: clips.map((clip) => ({
        clipId: clip.clipId,
        deviceId: clip.deviceId,
        name: clip.name,
        startTime: clip.startTime,
        durationSeconds: clip.durationSeconds,
        videoUrl: `/api/adc/clips/${encodeURIComponent(clip.clipId)}/video`,
      })),
    };
  } catch (error) {
    if (isAdcError(error)) {
      throw createError({ statusCode: 502, statusMessage: error.message });
    }
    throw error;
  }
});
