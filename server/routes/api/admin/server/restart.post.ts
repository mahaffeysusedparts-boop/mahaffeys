import { defineHandler } from "nitro";
import { createError, getRequestHeaders, getRequestURL } from "nitro/h3";
import { requireAdmin } from "../../../../utils/auth";

export default defineHandler(async (event) => {
  const user = await requireAdmin(event);
  const headers = getRequestHeaders(event);
  const origin = headers.origin;
  let isSameOrigin = false;

  try {
    isSameOrigin = !!origin && new URL(origin).host === getRequestURL(event).host;
  } catch {
    isSameOrigin = false;
  }

  if (!isSameOrigin) {
    throw createError({ statusCode: 403, statusMessage: "Same-origin request required" });
  }

  if (process.env.NODE_ENV !== "production") {
    throw createError({ statusCode: 409, statusMessage: "Restart is only available in production" });
  }

  setTimeout(() => process.exit(1), 500);

  return {
    accepted: true,
    message: "Mahaffeys is restarting",
    requestedBy: user.username,
  };
});
