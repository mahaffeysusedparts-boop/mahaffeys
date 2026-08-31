import { defineHandler } from "nitro";
import { createError, getRequestHeaders, getRequestURL } from "nitro/h3";
import { requireAdmin } from "../../../../utils/auth";
import { getStoplightStatus, runStoplightTest } from "../../../../utils/stoplight";

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

  try {
    await runStoplightTest(user.id);
  } catch (error) {
    throw createError({
      statusCode: 502,
      statusMessage: error instanceof Error ? error.message : "The test sequence failed",
    });
  }

  return { ok: true, status: await getStoplightStatus() };
});
