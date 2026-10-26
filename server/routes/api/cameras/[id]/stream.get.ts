import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { requireUser } from "../../../../utils/auth";
import { loadCameraById, resolveRtspSource, startRtspMjpegRestream } from "../../../../utils/rtspProxy";
import { proxyHttpCamera } from "../../../../utils/httpCameraProxy";

export default defineHandler(async (event) => {
  await requireUser(event);
  const camera = await loadCameraById(getRouterParam(event, "id")).catch(() => {
    throw createError({ statusCode: 404, statusMessage: "Camera not found or is paused" });
  });
  const source = resolveRtspSource(camera);
  if (!source && camera.cameraType === "HLS") {
    throw createError({ statusCode: 409, statusMessage: "Configure this camera's RTSP source for server-managed live viewing" });
  }
  try {
    if (source) return await startRtspMjpegRestream(source);
    return await proxyHttpCamera(camera, camera.cameraType === "SNAPSHOT", event.req.signal);
  } catch {
    throw createError({ statusCode: 502, statusMessage: "Camera live view unavailable; check the camera URL, credentials and server network access" });
  }
});
