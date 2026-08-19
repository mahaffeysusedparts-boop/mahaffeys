import { defineHandler } from "nitro";
import { createError, getRequestHeaders, getRequestURL, readBody } from "nitro/h3";
import { requireAdmin } from "../../../../utils/auth";
import { listSerialPorts, serverScale } from "../../../../utils/scale";
import { saveScaleConfig } from "../../../../utils/scaleConfig";

const SUPPORTED_BAUD_RATES = new Set([2400, 4800, 9600, 19200]);

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

  const body = await readBody<{ path?: string; baudRate?: number }>(event);
  const ports = await listSerialPorts();
  if (!body.path || !ports.includes(body.path)) {
    throw createError({ statusCode: 400, statusMessage: "Select a serial port currently available on the server" });
  }
  if (!body.baudRate || !SUPPORTED_BAUD_RATES.has(body.baudRate)) {
    throw createError({ statusCode: 400, statusMessage: "Select a supported baud rate" });
  }

  const config = await saveScaleConfig({ path: body.path, baudRate: body.baudRate }, user.id);
  await serverScale.start(config);

  return {
    configured: true,
    config,
    status: serverScale.getStatus(),
  };
});
