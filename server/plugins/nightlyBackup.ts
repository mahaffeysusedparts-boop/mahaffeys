import { definePlugin } from "nitro";
import { isDatabaseConfigured, runBackup } from "../utils/backups";

/**
 * Nightly app-state backups.
 *
 * Runs once at boot and then on a daily timer aligned to 02:00 local time.
 * Silently disabled when no database is configured (dev machines).
 */

const BACKUP_HOUR = 2;

function msUntilNextRun(from = new Date()): number {
  const next = new Date(from);
  next.setHours(BACKUP_HOUR, 0, 0, 0);
  if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - from.getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

export default definePlugin(() => {
  if (!isDatabaseConfigured()) {
    console.log("[backups] NITRO_DATABASE_URL not set — nightly backups disabled");
    return;
  }

  const run = async (trigger: string) => {
    try {
      const result = await runBackup();
      console.log(`[backups] ${trigger}: wrote ${result.fileName} (${result.recordCount} records, ${result.sizeBytes} bytes)`);
    } catch (error) {
      console.warn(`[backups] ${trigger} failed:`, error instanceof Error ? error.message : error);
    }
  };

  void run("boot");
  const timer = setTimeout(function tick() {
    void run("nightly");
    setTimeout(tick, DAY_MS);
  }, msUntilNextRun());

  if (typeof timer.unref === "function") timer.unref();
});
