import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";
import { requireUser } from "../../../utils/auth";
import { query } from "../../../utils/db";
import { getVisionScan } from "../../../utils/vision-scans";

export default defineHandler(async (event) => {
  await requireUser(event);
  const limit = Math.min(Number(getQuery(event).limit) || 8, 30);
  const rows = await query<{ id: string }>("SELECT id FROM vision_scans WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT $1", [limit]);
  return Promise.all(rows.rows.map((row) => getVisionScan(row.id)));
});
