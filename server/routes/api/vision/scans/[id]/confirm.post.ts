import { randomUUID } from "node:crypto";
import { defineHandler } from "nitro";
import { createError, getRouterParam, readBody } from "nitro/h3";
import { requireUser } from "../../../../../utils/auth";
import { query } from "../../../../../utils/db";
import { getVisionScan } from "../../../../../utils/vision-scans";

interface ConfirmationBody { selections?: Record<string, unknown>; linkedRecordType?: "ticket" | "vehicle" | "inventory"; linkedRecordId?: string }
export default defineHandler(async (event) => {
  const user = await requireUser(event);
  const id = getRouterParam(event, "id") || "";
  const body = await readBody<ConfirmationBody>(event);
  if (!body?.selections || typeof body.selections !== "object") throw createError({ statusCode: 400, statusMessage: "Select the reviewed values to confirm" });
  const existing = await query("SELECT id FROM vision_scans WHERE id = $1 AND deleted_at IS NULL", [id]);
  if (!existing.rows[0]) throw createError({ statusCode: 404, statusMessage: "Vision scan not found" });
  await query("INSERT INTO vision_confirmations (id, scan_id, confirmed_by, selections, linked_record_type, linked_record_id) VALUES ($1, $2, $3, $4, $5, $6)", [randomUUID(), id, user.id, JSON.stringify(body.selections), body.linkedRecordType || null, body.linkedRecordId || null]);
  await query("UPDATE vision_scans SET status = 'confirmed', confirmed_at = NOW(), linked_record_type = $2, linked_record_id = $3 WHERE id = $1", [id, body.linkedRecordType || null, body.linkedRecordId || null]);
  return getVisionScan(id);
});
