import { defineHandler } from "nitro";
import { createError, getRequestHeaders, getRequestURL, readBody } from "nitro/h3";
import { requireAdmin } from "../../../../utils/auth";
import { listSerialPorts, probeTcpScale, serverScale } from "../../../../utils/scale";
import { saveScaleConfig, type ScaleConfig } from "../../../../utils/scaleConfig";

const SUPPORTED_BAUD_RATES = new Set([2400, 4800, 9600, 19200]);
const HOST_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9.-]{0,253}$/;

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

  const body = await readBody<{
    type?: string;
    path?: string;
    baudRate?: number;
    host?: string;
    port?: number;
  }>(event);

  let config: ScaleConfig;

  if (body.type === "tcp") {
    const host = (body.host || "").trim();
    const port = Number(body.port);
    if (!HOST_PATTERN.test(host)) {
      throw createError({ statusCode: 400, statusMessage: "Enter a valid TCP hostname or IP address" });
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw createError({ statusCode: 400, statusMessage: "Enter a TCP port between 1 and 65535" });
    }

    const probe = await probeTcpScale(host, port);
    if (!probe.reachable) {
      throw createError({
        statusCode: 404,
        statusMessage: probe.detail || `Could not reach the scale at ${host}:${port}. Check the indicator's IP address and TCP port.`,
      });
    }

    config = await saveScaleConfig({ type: "tcp", host, port }, user.id);
  } else {
    const ports = await listSerialPorts();
    if (!body.path || !ports.includes(body.path)) {
      throw createError({ statusCode: 400, statusMessage: "Select a serial port currently available on the server" });
    }
    if (!body.baudRate || !SUPPORTED_BAUD_RATES.has(body.baudRate)) {
      throw createError({ statusCode: 400, statusMessage: "Select a supported baud rate" });
    }

    config = await saveScaleConfig({ type: "serial", path: body.path, baudRate: body.baudRate }, user.id);
  }

  await serverScale.start(config);

  return {
    configured: true,
    config,
    status: serverScale.getStatus(),
  };
});
