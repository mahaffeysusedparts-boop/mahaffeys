import { defineHandler } from "nitro";
import { requireAdmin } from "../../../../utils/auth";
import { auditFor, recordAudit } from "../../../../utils/audit";
import { exec } from "node:child_process";

export default defineHandler(async (event) => {
  const user = await requireAdmin(event);
  // Record audit entry before attempting restart
  await recordAudit(auditFor(user, {
    action: "server.restart",
    entity: "server",
    detail: { reason: "manual restart requested from server admin" },
  }));
  // Attempt to restart the service via PM2
  return new Promise((resolve) => {
    exec("pm2 restart mahaffeys", (error, stdout, stderr) => {
      if (error) {
        console.error(`[restart] PM2 restart error:`, error, stderr);
        resolve({ ok: false, message: "PM2 restart failed: " + (stderr || error.message) });
      } else {
        console.log(`[restart] PM2 restart initiated:`, stdout);
        resolve({ ok: true, message: "Restart request sent to PM2" });
      }
    });
  });
});