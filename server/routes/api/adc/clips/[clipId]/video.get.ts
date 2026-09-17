import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { requireUser } from "../../../../../utils/auth";
import { adcErrorStatusCode, getAdcClipVideo, isAdcError } from "../../../../../utils/alarmComClient";

/** Streams (proxies) one recorded MP4 from alarm.com to approved users. */
export default defineHandler(async (event) => {
  await requireUser(event);
  const clipId = getRouterParam(event, "clipId") || "";
  if (!clipId || !/^[\w-]{1,64}$/.test(clipId)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid Alarm.com clip id" });
  }

  try {
    const video = await getAdcClipVideo(clipId);
    return new Response(video.body, {
      headers: {
        "Content-Type": video.contentType,
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": `inline; filename="adc-clip-${clipId}.mp4"`,
      },
    });
  } catch (error) {
    if (isAdcError(error)) {
      throw createError({ statusCode: adcErrorStatusCode(error.reason), statusMessage: error.message });
    }
    throw error;
  }
});
