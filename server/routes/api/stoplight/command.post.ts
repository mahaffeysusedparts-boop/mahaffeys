import { defineHandler } from "nitro";
import { createError, getRequestHeaders, getRequestURL, readBody } from "nitro/h3";
import { requireUser } from "../../../utils/auth";
import { commandStoplight, getStoplightStatus } from "../../../utils/stoplight";

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  const origin = getRequestHeaders(event).origin;

  try {
    if (!origin || new URL(origin).host !== getRequestURL(event).host) {
      throw new Error("origin mismatch");
    }
  } catch {
    throw createError({ statusCode: 403, statusMessage: "Same-origin request required" });
  }

  const body = await readBody<{ state?: string }>(event);
  if (body?.state !== "red" && body?.state !== "green" && body?.state !== "off") {
    throw createError({ statusCode: 400, statusMessage: "state must be red, green, or off" });
  }

  try {
    await commandStoplight(body.state, user.id);
  } catch (error) {
    throw createError({
      statusCode: 502,
      statusMessage: error instanceof Error ? error.message : "The stoplight relay did not respond",
    });
  }

  return getStoplightStatus();
});
