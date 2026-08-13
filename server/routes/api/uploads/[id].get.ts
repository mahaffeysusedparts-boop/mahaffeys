import { defineHandler } from "nitro";
import { createError, getRouterParam, setResponseHeader } from "nitro/h3";
import { requireUser } from "../../../utils/auth";
import { query } from "../../../utils/db";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface MediaRow {
  file_name: string;
  content_type: string;
  content: Buffer;
}

export default defineHandler(async (event) => {
  await requireUser(event);
  const id = getRouterParam(event, "id");
  if (!id || !UUID_PATTERN.test(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid upload ID" });
  }

  const result = await query<MediaRow>(
    "SELECT file_name, content_type, content FROM media_uploads WHERE id = $1",
    [id],
  );
  const media = result.rows[0];
  if (!media) throw createError({ statusCode: 404, statusMessage: "Upload not found" });

  const safeFileName = media.file_name.replace(/["\\\r\n]/g, "_");
  setResponseHeader(event, "Content-Type", media.content_type);
  setResponseHeader(event, "Content-Disposition", `inline; filename="${safeFileName}"`);
  setResponseHeader(event, "Cache-Control", "private, max-age=31536000, immutable");
  setResponseHeader(event, "X-Content-Type-Options", "nosniff");
  return media.content;
});
