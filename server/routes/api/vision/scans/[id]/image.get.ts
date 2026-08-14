import { readFile } from "node:fs/promises";
import { defineHandler } from "nitro";
import { createError, getRouterParam, setHeader } from "nitro/h3";
import { requireUser } from "../../../../../utils/auth";
import { query } from "../../../../../utils/db";

export default defineHandler(async (event) => {
  await requireUser(event);
  const id = getRouterParam(event, "id") || "";
  const result = await query<{ storage_path: string; content_type: string }>("SELECT storage_path, content_type FROM vision_scans WHERE id = $1 AND deleted_at IS NULL", [id]);
  const scan = result.rows[0];
  if (!scan) throw createError({ statusCode: 404, statusMessage: "Image not found" });
  setHeader(event, "Content-Type", scan.content_type);
  setHeader(event, "Cache-Control", "private, max-age=300");
  return readFile(scan.storage_path);
});
