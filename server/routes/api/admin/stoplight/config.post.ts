import { defineHandler } from "nitro";
import { createError, getRequestHeaders, getRequestURL, readBody } from "nitro/h3";
import { requireAdmin } from "../../../../utils/auth";
import { auditFor, recordAudit } from "../../../../utils/audit";
import { getStoplightConfig, isValidStoplightConfig, isValidUrlTemplate, isStoplightPreset, saveStoplightConfig, type StoplightConfig } from "../../../../utils/stoplightConfig";
import { getStoplightStatus, probeStoplight } from "../../../../utils/stoplight";

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

  const body = await readBody<Record<string, unknown>>(event);

  if (!isStoplightPreset(body?.preset)) {
    throw createError({ statusCode: 400, statusMessage: "Choose a supported relay type" });
  }

  const host = typeof body.host === "string" ? body.host.trim() : "";
  if (!HOST_PATTERN.test(host)) {
    throw createError({ statusCode: 400, statusMessage: "Enter the relay board's IP address or hostname" });
  }

  const channel = (input: unknown, label: string) => {
    const value = Number(input);
    if (!Number.isInteger(value) || value < 1 || value > 16) {
      throw createError({ statusCode: 400, statusMessage: `${label} channel must be a relay number between 1 and 16` });
    }
    return value;
  };
  const redChannel = channel(body.redChannel, "Red light");
  const greenChannel = channel(body.greenChannel, "Green light");

  if (redChannel === greenChannel) {
    throw createError({ statusCode: 400, statusMessage: "Red and green lights must use two different relay channels" });
  }

  const existing = await getStoplightConfig();
  const username = typeof body.username === "string" && body.username.trim() ? body.username.trim().slice(0, 100) : existing?.username;
  // Blank password keeps the previously saved credentials.
  const password = typeof body.password === "string" && body.password ? body.password.slice(0, 100) : existing?.password;

  const candidate: StoplightConfig = {
    preset: body.preset,
    host,
    redChannel,
    greenChannel,
    username,
    password,
  };

  if (body.preset === "custom") {
    for (const [key, label] of [
      ["redOnUrl", "Red ON"],
      ["redOffUrl", "Red OFF"],
      ["greenOnUrl", "Green ON"],
      ["greenOffUrl", "Green OFF"],
    ] as const) {
      const value = typeof body[key] === "string" ? (body[key] as string).trim() : "";
      if (!isValidUrlTemplate(value)) {
        throw createError({
          statusCode: 400,
          statusMessage: `${label} URL must be a complete http:// or https:// address (use {host} and {ch} placeholders)`,
        });
      }
      candidate[key] = value;
    }
  }

  if (!isValidStoplightConfig(candidate)) {
    throw createError({ statusCode: 400, statusMessage: "Relay configuration is incomplete" });
  }

  try {
    // Refuse to activate a relay the server cannot reach; both lamps go safe-off.
    await probeStoplight(candidate, user.id);
  } catch (error) {
    throw createError({
      statusCode: 404,
      statusMessage: error instanceof Error
        ? `${error.message}. Check the relay IP, channel numbers, and that the board accepts HTTP commands.`
        : "Could not reach the relay board",
    });
  }

  const config = await saveStoplightConfig(candidate, user.id);

  await recordAudit(auditFor(user, {
    action: "admin.stoplight_config",
    entity: "stoplight",
    detail: { preset: config.preset, host: config.host, redChannel: config.redChannel, greenChannel: config.greenChannel },
  }));

  return {
    configured: true,
    config: { ...config, password: undefined, hasPassword: Boolean(config.password) },
    status: await getStoplightStatus(),
  };
});
