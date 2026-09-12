import { defineHandler } from "nitro";
import { clearSession, getSessionUser } from "../../../utils/auth";
import { auditFor, recordAudit } from "../../../utils/audit";

export default defineHandler(async (event) => {
  const user = await getSessionUser(event);
  await clearSession(event);
  await recordAudit(auditFor(user, {
    action: "auth.logout",
    entity: "auth",
    entityId: user?.id ?? null,
  }));
  return { ok: true };
});
