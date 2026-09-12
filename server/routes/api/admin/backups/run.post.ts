import { defineHandler } from "nitro";
import { requireAdmin } from "../../../../utils/auth";
import { auditFor, recordAudit } from "../../../../utils/audit";
import { isDatabaseConfigured, runBackup } from "../../../../utils/backups";

export default defineHandler(async (event) => {
  const admin = await requireAdmin(event);
  if (!isDatabaseConfigured()) {
    return { ok: false, message: "No database is configured on this server — backups are disabled here." };
  }
  const result = await runBackup();
  await recordAudit(auditFor(admin, {
    action: "backup.run",
    entity: "backups",
    entityId: result.fileName,
    detail: { recordCount: result.recordCount, sizeBytes: result.sizeBytes, trigger: "manual" },
  }));
  return { ok: true, ...result };
});
