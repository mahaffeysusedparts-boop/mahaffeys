import { defineHandler } from "nitro";
import { requireAdmin } from "../../../../utils/auth";
import { auditFor, recordAudit } from "../../../../utils/audit";
import { getBackupDir, getRetentionCount, listBackups } from "../../../../utils/backups";

export default defineHandler(async (event) => {
  const admin = await requireAdmin(event);
  const backups = await listBackups();
  await recordAudit(auditFor(admin, {
    action: "backup.list",
    entity: "backups",
    detail: { count: backups.length, dir: getBackupDir() },
  }));
  return {
    dir: getBackupDir(),
    retention: getRetentionCount(),
    backups,
  };
});
