import { defineHandler } from "nitro";
import { createError, getRouterParam, setResponseHeader } from "nitro/h3";
import { requireAdmin } from "../../../../utils/auth";
import { auditFor, recordAudit } from "../../../../utils/audit";
import { readBackupFile } from "../../../../utils/backups";

export default defineHandler(async (event) => {
  const admin = await requireAdmin(event);
  const file = getRouterParam(event, "file");
  if (!file) throw createError({ statusCode: 400, statusMessage: "Backup file name is required" });

  // The reader validates the strict app-state-YYYYMMDD-HHmm.json pattern, so
  // no traversal payload can escape the backup directory.
  const backup = await readBackupFile(file);
  if (!backup) throw createError({ statusCode: 404, statusMessage: "Backup file not found" });

  await recordAudit(auditFor(admin, {
    action: "backup.download",
    entity: "backups",
    entityId: file,
    detail: { sizeBytes: backup.sizeBytes },
  }));

  setResponseHeader(event, "Content-Type", "application/json");
  setResponseHeader(event, "Content-Disposition", `attachment; filename="${file}"`);
  return backup.content;
});
