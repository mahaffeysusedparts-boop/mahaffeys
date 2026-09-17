import { defineHandler } from "nitro";
import { createError, getRequestHeaders, getRequestURL } from "nitro/h3";
import { requireAdmin } from "../../../utils/auth";
import { auditFor, recordAudit } from "../../../utils/audit";
import { logoutAlarmCom } from "../../../utils/alarmComClient";

export default defineHandler(async (event) => {
  const user = await requireAdmin(event);
  const origin = getRequestHeaders(event).origin;
  try {
    if (!origin || new URL(origin).host !== getRequestURL(event).host) throw new Error("origin mismatch");
  } catch {
    throw createError({ statusCode: 403, statusMessage: "Same-origin request required" });
  }

  await logoutAlarmCom();
  await recordAudit(auditFor(user, { action: "adc.logout", entity: "alarmcom" }));
  return { status: "NEEDS_LOGIN" as const };
});
