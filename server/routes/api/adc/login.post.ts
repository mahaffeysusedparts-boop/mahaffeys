import { defineHandler } from "nitro";
import { createError, getRequestHeaders, getRequestURL, readBody } from "nitro/h3";
import { requireAdmin } from "../../../utils/auth";
import { auditFor, recordAudit } from "../../../utils/audit";
import { isAdcError, loginAlarmCom, submitAdcOtp } from "../../../utils/alarmComClient";

function assertSameOrigin(event: Parameters<typeof getRequestHeaders>[0]) {
  const origin = getRequestHeaders(event).origin;
  try {
    if (!origin || new URL(origin).host !== getRequestURL(event).host) throw new Error("origin mismatch");
  } catch {
    throw createError({ statusCode: 403, statusMessage: "Same-origin request required" });
  }
}

export default defineHandler(async (event) => {
  const user = await requireAdmin(event);
  assertSameOrigin(event);

  const body = await readBody<{ username?: string; password?: string; otp?: string }>(event);
  const otp = (body.otp || "").trim();

  try {
    // Two-step flow: username+password first, then the 6-digit code ADC sent.
    if (otp) {
      if (!/^\d{4,8}$/.test(otp)) {
        throw createError({ statusCode: 400, statusMessage: "Enter the 4–8 digit code alarm.com sent you" });
      }
      const connection = await submitAdcOtp(otp);
      await recordAudit(auditFor(user, {
        action: "adc.otp_verified",
        entity: "alarmcom",
        detail: { username: connection.username },
      }));
      return { status: connection.status, username: connection.username };
    }

    const username = (body.username || "").trim().slice(0, 120);
    const password = body.password || "";
    if (!username || !password) {
      throw createError({ statusCode: 400, statusMessage: "Alarm.com username and password are required" });
    }

    const connection = await loginAlarmCom(username, password);
    await recordAudit(auditFor(user, {
      action: "adc.login",
      entity: "alarmcom",
      detail: { username, status: connection.status },
    }));
    return { status: connection.status, username: connection.username };
  } catch (error) {
    // Credentials/OTP travel only in this request — never logged or stored.
    if (isAdcError(error)) {
      throw createError({ statusCode: 400, statusMessage: error.message });
    }
    throw error;
  }
});
