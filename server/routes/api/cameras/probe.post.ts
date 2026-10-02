import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { requireUser } from "../../../utils/auth";
import { embedRtspCredentials, grabRtspFrame } from "../../../utils/rtspProxy";

/**
 * Pre-save RTSP connection test: grabs one frame from a candidate URL so the
 * operator can confirm the path/credentials before the camera is stored.
 */
export default defineHandler(async (event) => {
  await requireUser(event);

  const body = await readBody<{ rtspUrl?: string; username?: string; password?: string }>(event);
  const raw = (body?.rtspUrl ?? "").trim();
  if (!raw.toLowerCase().startsWith("rtsp://")) {
    throw createError({ statusCode: 400, statusMessage: "A rtsp:// stream URL is required" });
  }

  let source: string;
  try {
    source = embedRtspCredentials(raw, body?.username, body?.password);
  } catch {
    throw createError({ statusCode: 400, statusMessage: "That RTSP URL is not valid" });
  }

  try {
    const frame = await grabRtspFrame(source);
    return { ok: true, frameBytes: frame.byteLength };
  } catch (error) {
    throw createError({ statusCode: 502, statusMessage: error instanceof Error ? error.message : "RTSP connection failed" });
  }
});
