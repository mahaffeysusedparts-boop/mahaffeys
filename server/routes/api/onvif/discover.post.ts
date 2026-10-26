import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { requireUser } from "../../../utils/auth";
import { discoverOnvifStream } from "../../../utils/onvifClient";

/**
 * Discovers the RTSP stream URL for an ONVIF camera.
 *
 * The app server makes the SOAP calls directly to the camera over the LAN,
 * so the browser never needs direct camera access. Returns the resolved
 * rtsp:// URL plus profile metadata so the caller can save it as an RTSP
 * camera (which the existing rtspProxy will then restream to the browser).
 */
export default defineHandler(async (event) => {
  await requireUser(event);

  const body = await readBody<{
    host: string;
    port?: number;
    username?: string;
    password?: string;
    path?: string;
  }>(event);

  const host = (body?.host ?? "").trim();
  if (!host) {
    throw createError({ statusCode: 400, statusMessage: "Camera host (IP address) is required" });
  }

  try {
    const result = await discoverOnvifStream({
      host,
      port: body?.port,
      username: body?.username,
      password: body?.password,
      path: body?.path,
    });

    return {
      ok: true,
      rtspUrl: result.rtspUrl,
      profileToken: result.profileToken,
      profileName: result.profileName,
      mediaServiceUrl: result.mediaServiceUrl,
    };
  } catch (error) {
    throw createError({
      statusCode: 502,
      statusMessage: error instanceof Error ? error.message : "ONVIF discovery failed",
    });
  }
});
