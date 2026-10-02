import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { requireUser } from "../../../../utils/auth";
import { loadCameraById, resolveRtspSource, startRtspMjpegRestream } from "../../../../utils/rtspProxy";

/**
 * Live MJPEG restream of one RTSP camera (e.g. 3xLogic without an NVR).
 * Rendered directly by an <img> tag — the session cookie authenticates it.
 */
export default defineHandler(async (event) => {
  await requireUser(event);

  let source: string | null;
  try {
    const camera = await loadCameraById(getRouterParam(event, "id"));
    source = resolveRtspSource(camera);
  } catch (error) {
    throw createError({ statusCode: 404, statusMessage: error instanceof Error ? error.message : "Camera not found" });
  }

  if (!source) {
    throw createError({ statusCode: 409, statusMessage: "This camera has no RTSP stream URL configured" });
  }

  try {
    return await startRtspMjpegRestream(source);
  } catch (error) {
    throw createError({ statusCode: 502, statusMessage: error instanceof Error ? error.message : "RTSP restream failed" });
  }
});
