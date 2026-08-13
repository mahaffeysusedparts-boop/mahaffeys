import { randomUUID } from "node:crypto";
import { defineHandler } from "nitro";
import { createError, readMultipartFormData } from "nitro/h3";
import { requireUser } from "../../../utils/auth";
import { query } from "../../../utils/db";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  const parts = await readMultipartFormData(event);
  const upload = parts?.find((part) => part.name === "file" && part.filename);

  if (!upload?.data?.length || !upload.filename) {
    throw createError({ statusCode: 400, statusMessage: "Choose an image to upload" });
  }

  const contentType = upload.type?.toLowerCase() || "";
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw createError({ statusCode: 415, statusMessage: "Only JPEG, PNG, WebP, and GIF images are allowed" });
  }
  if (upload.data.length > MAX_FILE_SIZE) {
    throw createError({ statusCode: 413, statusMessage: "Images must be 10 MB or smaller" });
  }

  const id = randomUUID();
  const fileName = upload.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "upload";
  await query(`
    INSERT INTO media_uploads (id, file_name, content_type, byte_size, content, uploaded_by)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [id, fileName, contentType, upload.data.length, upload.data, user.id]);

  return {
    id,
    url: `/api/uploads/${id}`,
    fileName,
    contentType,
    byteSize: upload.data.length,
  };
});
