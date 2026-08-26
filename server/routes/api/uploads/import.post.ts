import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { requireAdmin } from "../../../utils/auth";
import { query } from "../../../utils/db";

// Restores embedded backup photos into media_uploads while preserving their
// original UUIDs, so /api/uploads/<id> URLs stored in tickets and customers
// keep resolving after a backup is copied to another server.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_MEDIA_COUNT = 5000;
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

interface MediaImportEntry {
  id?: string;
  fileName?: string;
  contentType?: string;
  contentBase64?: string;
}

export default defineHandler(async (event) => {
  const admin = await requireAdmin(event);
  const body = await readBody<{ media?: MediaImportEntry[] }>(event, { limit: 500 * 1024 * 1024 });
  if (!Array.isArray(body.media) || body.media.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "media array is required" });
  }
  if (body.media.length > MAX_MEDIA_COUNT) {
    throw createError({ statusCode: 400, statusMessage: `Backups may contain at most ${MAX_MEDIA_COUNT} images` });
  }

  for (const entry of body.media) {
    const id = String(entry.id || "");
    const contentType = String(entry.contentType || "").toLowerCase();
    const fileName = String(entry.fileName || "upload").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "upload";
    const base64 = String(entry.contentBase64 || "");

    if (!UUID_PATTERN.test(id)) {
      throw createError({ statusCode: 400, statusMessage: `Invalid media id: ${id}` });
    }
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw createError({ statusCode: 415, statusMessage: `Unsupported image type for media ${id}` });
    }
    const content = Buffer.from(base64, "base64");
    if (content.length === 0) {
      throw createError({ statusCode: 400, statusMessage: `Missing image data for media ${id}` });
    }
    if (content.length > MAX_FILE_SIZE) {
      throw createError({ statusCode: 413, statusMessage: `Image ${id} is larger than 10 MB` });
    }

    await query(
      `
      INSERT INTO media_uploads (id, file_name, content_type, byte_size, content, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        file_name = EXCLUDED.file_name,
        content_type = EXCLUDED.content_type,
        byte_size = EXCLUDED.byte_size,
        content = EXCLUDED.content
      `,
      [id, fileName, contentType, content.length, content, admin.id],
    );
  }

  return { ok: true, restored: body.media.length };
});
