import { readFile, statfs } from "node:fs/promises";
import { cpus, freemem, hostname, loadavg, totalmem, uptime } from "node:os";
import { defineHandler } from "nitro";
import { requireAdmin } from "../../../utils/auth";

const APP_NAME = "mahaffeys";
const LOG_LINE_LIMIT = 200;

async function readLog(path: string) {
  try {
    const content = await readFile(path, "utf8");
    return content.split("\n").filter(Boolean).slice(-LOG_LINE_LIMIT);
  } catch {
    return [];
  }
}

async function readDiskStats() {
  try {
    return await statfs("/var/www/mahaffeys");
  } catch {
    return statfs(process.cwd());
  }
}

export default defineHandler(async (event) => {
  await requireAdmin(event);

  const home = process.env.HOME || "/home/jhilliard";
  const logDirectory = process.env.PM2_HOME || `${home}/.pm2`;
  const [disk, outputLines, errorLines] = await Promise.all([
    readDiskStats(),
    readLog(`${logDirectory}/logs/${APP_NAME}-out.log`),
    readLog(`${logDirectory}/logs/${APP_NAME}-error.log`),
  ]);

  const diskTotal = disk.blocks * disk.bsize;
  const diskFree = disk.bavail * disk.bsize;
  const memoryTotal = totalmem();
  const memoryFree = freemem();

  return {
    service: {
      name: APP_NAME,
      status: "online",
      manager: process.env.pm_id !== undefined ? "PM2" : "systemd / direct",
      pid: process.pid,
      processUptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || "development",
    },
    host: {
      hostname: hostname(),
      uptimeSeconds: Math.floor(uptime()),
      cpuCount: cpus().length,
      loadAverage: loadavg(),
      memoryTotal,
      memoryUsed: memoryTotal - memoryFree,
      diskTotal,
      diskUsed: diskTotal - diskFree,
    },
    logs: {
      output: outputLines,
      errors: errorLines,
      available: outputLines.length > 0 || errorLines.length > 0,
    },
    checkedAt: new Date().toISOString(),
  };
});
