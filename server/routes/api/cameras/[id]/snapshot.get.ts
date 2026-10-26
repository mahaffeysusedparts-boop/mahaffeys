import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { requireUser } from "../../../../utils/auth";
import { grabRtspFrame, loadCameraById, resolveRtspSource } from "../../../../utils/rtspProxy";
import { proxyHttpCamera } from "../../../../utils/httpCameraProxy";

export default defineHandler(async (event) => {
  await requireUser(event);
  const camera = await loadCameraById(getRouterParam(event, "id")).catch(() => {
    throw createError({ statusCode: 404, statusMessage: "Camera not found or is paused" });
  });
  const source = resolveRtspSource(camera);
  try {
    if (!source) return await proxyHttpCamera(camera, true, event.req.signal);
    const frame = await grabRtspFrame(source);
    return new Response(new Uint8Array(frame), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    throw createError({ statusCode: 502, statusMessage: "Camera snapshot unavailable; check the snapshot URL, credentials and server network access" });
  }
});
