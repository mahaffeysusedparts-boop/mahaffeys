import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { query } from "./db";

/**
 * Server-side app-state backups.
 *
 * Every backup is a JSON snapshot in the same shape as the client JSON
 * backup (key → value), plus a meta block with record counts and a SHA-256
 * checksum. Files land in NITRO_BACKUP_DIR (default ./data/backups) and are
 * pruned to the newest NITRO_BACKUP_RETENTION (default 30) files.
 */

const BACKUP_FILE_PATTERN = /^app-state-\d{8}-\d{4}\.json$/;

export function isDatabaseConfigured() {
  return Boolean(process.env.NITRO_DATABASE_URL || process.env.DATABASE_URL);
}

export function getBackupDir() {
  return resolve(process.env.NITRO_BACKUP_DIR || "./data/backups");
}

export function getRetentionCount() {
  const parsed = Number.parseInt(process.env.NITRO_BACKUP_RETENTION || process.env.NITRO_BACKUP_RETENTION_DAYS || "30", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

export interface BackupResult {
  fileName: string;
  recordCount: number;
  sizeBytes: number;
}

/** Dumps every app_state row to one timestamped JSON file, then prunes old files. */
export async function runBackup(): Promise<BackupResult> {
  const result = await query<{ key: string; value: unknown }>("SELECT key, value FROM app_state ORDER BY key");
  const state: Record<string, unknown> = {};
  const keyCounts: Record<string, number> = {};
  for (const row of result.rows) {
    state[row.key] = row.value;
    keyCounts[row.key] = Array.isArray(row.value) ? row.value.length : 1;
  }

  const checksum = createHash("sha256").update(JSON.stringify(state)).digest("hex");
  const snapshot = {
    meta: {
      generatedAt: new Date().toISOString(),
      recordCount: result.rows.length,
      keyCounts,
      checksum,
      format: "mahaffeys-app-state-v1",
    },
    state,
  };

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fileName = `app-state-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;

  const dir = getBackupDir();
  await mkdir(dir, { recursive: true });
  const content = JSON.stringify(snapshot, null, 2);
  const path = join(dir, fileName);
  await writeFile(path, content, "utf8");
  const sizeBytes = Buffer.byteLength(content, "utf8");

  await pruneBackups();

  return { fileName, recordCount: result.rows.length, sizeBytes };
}

export interface BackupFileInfo {
  name: string;
  sizeBytes: number;
  createdAt: string;
  recordCount: number | null;
}

/** Lists backup files newest-first with sizes and (best-effort) record counts. */
export async function listBackups(): Promise<BackupFileInfo[]> {
  const dir = getBackupDir();
  let names: string[];
  try {
    names = (await readdir(dir)).filter((name) => BACKUP_FILE_PATTERN.test(name));
  } catch {
    return [];
  }
  if (names.length === 0) return [];

  const files = await Promise.all(
    names.map(async (name) => {
      const info = await stat(join(dir, name));
      return { name, sizeBytes: info.size, createdAt: info.mtime.toISOString(), recordCount: null as number | null };
    }),
  );
  files.sort((a, b) => b.name.localeCompare(a.name));

  // Record counts come from each file's meta block (bounded admin read).
  await Promise.all(
    files.map(async (file) => {
      try {
        const raw = await readFile(join(dir, file.name), "utf8");
        const meta = (JSON.parse(raw) as { meta?: { recordCount?: number } }).meta;
        file.recordCount = typeof meta?.recordCount === "number" ? meta.recordCount : null;
      } catch {
        /* corrupt or partially-written file — leave count null */
      }
    }),
  );
  return files;
}

/** Keeps only the newest N backup files (N = retention setting). */
export async function pruneBackups(): Promise<number> {
  const { unlink } = await import("node:fs/promises");
  const dir = getBackupDir();
  let names: string[];
  try {
    names = (await readdir(dir)).filter((name) => BACKUP_FILE_PATTERN.test(name)).sort();
  } catch {
    return 0;
  }
  const excess = names.slice(0, Math.max(0, names.length - getRetentionCount()));
  for (const name of excess) {
    try {
      await unlink(join(dir, name));
    } catch {
      /* already gone */
    }
  }
  return excess.length;
}

/**
 * Reads one backup file by exact name. The name is validated against the
 * strict file pattern so path traversal is impossible.
 */
export async function readBackupFile(name: string): Promise<{ content: string; sizeBytes: number } | null> {
  if (!BACKUP_FILE_PATTERN.test(name)) return null;
  const dir = getBackupDir();
  const path = join(dir, name);
  try {
    const content = await readFile(path, "utf8");
    return { content, sizeBytes: Buffer.byteLength(content, "utf8") };
  } catch {
    return null;
  }
}
