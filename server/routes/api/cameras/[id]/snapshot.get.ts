import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { requireUser } from "../../../../utils/auth";
import { grabRtspFrame, loadCameraById, resolveRtspSource } from "../../../../utils/rtspProxy";

/** Single JPEG frame from an RTSP camera — powers snapshots & compliance captures. */
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
    const frame = await grabRtspFrame(source);
    return new Response(new Uint8Array(frame), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store, private",
      },
    });
  } catch (error) {
    throw createError({ statusCode: 502, statusMessage: error instanceof Error ? error.message : "RTSP snapshot failed" });
  }
});
