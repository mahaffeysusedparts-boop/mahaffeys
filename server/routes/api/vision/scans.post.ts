import { randomUUID } from "node:crypto";
import { defineHandler } from "nitro";
import { createError, readMultipartFormData } from "nitro/h3";
import { requireUser } from "../../../utils/auth";
import { query } from "../../../utils/db";
import { persistVisionImage } from "../../../utils/vision-storage";
import { analyzeVisionScan, getVisionScan, type VisionPurpose } from "../../../utils/vision-scans";

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  const parts = await readMultipartFormData(event);
  const file = parts?.find((part) => part.name === "image" && part.filename);
  const purpose = parts?.find((part) => part.name === "purpose")?.data.toString() as VisionPurpose | undefined;
  if (!file?.filename || !purpose || !["vehicle", "plate", "scrap"].includes(purpose)) throw createError({ statusCode: 400, statusMessage: "Provide an image and scan purpose" });
  const saved = await persistVisionImage(file);
  const id = randomUUID();
  try {
    await query("INSERT INTO vision_scans (id, purpose, status, original_file_name, storage_path, content_type, byte_size, checksum_sha256, width, height, uploaded_by, retention_delete_after) VALUES ($1, $2, 'processing', $3, $4, $5, $6, $7, $8, $9, $10, NOW() + ($11 || ' days')::interval)", [id, purpose, saved.originalFileName, saved.storagePath, saved.contentType, saved.byteSize, saved.checksum, saved.width, saved.height, user.id, String(Number(process.env.NITRO_VISION_RETENTION_DAYS || 90))]);
    await analyzeVisionScan({ id, purpose, storage_path: saved.storagePath });
  } catch (error) {
    await query("UPDATE vision_scans SET status = 'failed', error_message = 'Unable to process this scan.' WHERE id = $1", [id]).catch(() => undefined);
    throw error;
  }
  return getVisionScan(id);
});
