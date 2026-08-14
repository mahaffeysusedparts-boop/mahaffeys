import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { requireUser } from "../../../../../utils/auth";
import { query } from "../../../../../utils/db";
import { analyzeVisionScan, getVisionScan, type VisionPurpose } from "../../../../../utils/vision-scans";

export default defineHandler(async (event) => {
  await requireUser(event);
  const id = getRouterParam(event, "id") || "";
  const found = await query<{ purpose: VisionPurpose; storage_path: string; status: string }>("SELECT purpose, storage_path, status FROM vision_scans WHERE id = $1 AND deleted_at IS NULL", [id]);
  const scan = found.rows[0];
  if (!scan) throw createError({ statusCode: 404, statusMessage: "Vision scan not found" });
  if (scan.status === "confirmed") throw createError({ statusCode: 409, statusMessage: "Confirmed scans cannot be retried" });
  await query("DELETE FROM vision_candidates WHERE scan_id = $1; DELETE FROM vision_results WHERE scan_id = $1; UPDATE vision_scans SET status = 'processing', error_message = NULL WHERE id = $1", [id]);
  await analyzeVisionScan({ id, purpose: scan.purpose, storage_path: scan.storage_path });
  return getVisionScan(id);
});
