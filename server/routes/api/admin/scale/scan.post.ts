import { defineHandler } from "nitro";
import { createError, getRequestHeaders, getRequestURL } from "nitro/h3";
import { requireAdmin } from "../../../../utils/auth";
import { serverScale } from "../../../../utils/scale";
import { saveScaleConfig } from "../../../../utils/scaleConfig";

export default defineHandler(async (event) => {
  const user = await requireAdmin(event);
  const origin = getRequestHeaders(event).origin;

  try {
    if (!origin || new URL(origin).host !== getRequestURL(event).host) {
      throw new Error("origin mismatch");
    }
  } catch {
    throw createError({ statusCode: 403, statusMessage: "Same-origin request required" });
  }

  const detection = await serverScale.scan();
  if (!detection) {
    throw createError({
      statusCode: 404,
      statusMessage: "No IQ710 weight stream was detected. Confirm the scale is transmitting continuously and try again.",
    });
  }

  const config = await saveScaleConfig({ path: detection.path, baudRate: detection.baudRate }, user.id);
  return {
    detected: true,
    config,
    sample: detection.sample,
    status: serverScale.getStatus(),
  };
});
