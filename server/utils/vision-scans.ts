import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createError } from "nitro/h3";
import { query } from "./db";
import { normalizePlate } from "./lpr";
import { decodeVinWithNhtsa } from "./nhtsa-vpic";
import { findVinCandidates, validateVin } from "./vin";

export type VisionPurpose = "vehicle" | "plate" | "scrap";

export interface WorkerCandidate { text: string; confidence: number; kind: "vin" | "plate" | "material" | "contamination" }
export interface WorkerResult { raw_text?: string; candidates?: WorkerCandidate[]; materials?: Array<{ label: string; confidence: number }>; contamination_flags?: Array<{ label: string; confidence: number }>; model_version?: string }
interface LprServiceResult { plate?: string; text?: string; confidence?: number; region?: string; model_version?: string }

async function recognizeImage(scan: { purpose: VisionPurpose; storage_path: string }) {
  const image = await readFile(scan.storage_path);
  const form = new FormData();
  form.set("image", new Blob([image]), "scan-image");

  if (scan.purpose === "plate" && process.env.NITRO_LPR_SERVICE_URL) {
    try {
      const headers = process.env.NITRO_LPR_API_TOKEN
        ? { Authorization: `Bearer ${process.env.NITRO_LPR_API_TOKEN}` }
        : undefined;
      const response = await fetch(process.env.NITRO_LPR_SERVICE_URL, {
        method: "POST",
        headers,
        body: form,
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error("LPR service response was not successful");
      const result = await response.json() as LprServiceResult;
      const plate = result.plate || result.text || "";
      if (plate) {
        return {
          raw_text: plate,
          candidates: [{ text: plate, confidence: result.confidence ?? 0, kind: "plate" as const }],
          model_version: result.model_version || "high-accuracy-lpr",
        } satisfies WorkerResult;
      }
    } catch {
      // Fall through to the on-premises worker when the optional LPR service is unavailable.
    }
  }

  form.set("purpose", scan.purpose);

  const workerUrl = process.env.NITRO_VISION_WORKER_URL || "http://vision-worker:8000";
  const response = await fetch(`${workerUrl.replace(/\/$/, "")}/analyze`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("worker response was not successful");
  return response.json() as Promise<WorkerResult>;
}

export async function analyzeVisionScan(scan: { id: string; purpose: VisionPurpose; storage_path: string }) {
  let worker: WorkerResult;
  try {
    worker = await recognizeImage(scan);
  } catch {
    await query("UPDATE vision_scans SET status = 'failed', error_message = 'Vision recognition unavailable. Retry when the configured service is online.' WHERE id = $1", [scan.id]);
    return;
  }

  const rawText = worker.raw_text || "";
  const candidates = worker.candidates || [];
  const vinText = candidates.find((candidate) => candidate.kind === "vin")?.text || findVinCandidates(rawText)[0] || "";
  const vin = vinText ? validateVin(vinText) : null;
  let decode = null;
  if (vin?.valid) {
    try { decode = await decodeVinWithNhtsa(vin.normalized); } catch { /* local result remains reviewable */ }
  }
  const plateCandidate = candidates.find((candidate) => candidate.kind === "plate")?.text || "";
  const plateText = plateCandidate ? normalizePlate(plateCandidate) : null;
  const confidence = candidates.length ? Math.max(...candidates.map((candidate) => candidate.confidence)) : 0;
  await query("INSERT INTO vision_results (scan_id, raw_ocr_text, normalized_vin, vin_valid, vin_warnings, plate_text, decode, materials, contamination_flags) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (scan_id) DO UPDATE SET raw_ocr_text = EXCLUDED.raw_ocr_text, normalized_vin = EXCLUDED.normalized_vin, vin_valid = EXCLUDED.vin_valid, vin_warnings = EXCLUDED.vin_warnings, plate_text = EXCLUDED.plate_text, decode = EXCLUDED.decode, materials = EXCLUDED.materials, contamination_flags = EXCLUDED.contamination_flags, updated_at = NOW()", [scan.id, rawText, vin?.normalized || null, vin?.valid || false, JSON.stringify(vin?.warnings || []), plateText, decode ? JSON.stringify(decode) : null, JSON.stringify(worker.materials || []), JSON.stringify(worker.contamination_flags || [])]);
  for (const candidate of candidates) await query("INSERT INTO vision_candidates (id, scan_id, field_name, candidate_text, confidence, source) VALUES ($1, $2, $3, $4, $5, 'vision_worker')", [randomUUID(), scan.id, candidate.kind, candidate.text, candidate.confidence]);
  await query("UPDATE vision_scans SET status = 'review_required', confidence = $2, worker_model_version = $3, processed_at = NOW(), error_message = $4 WHERE id = $1", [scan.id, confidence, worker.model_version || null, vin?.valid || !vinText ? null : "VIN requires operator review before official decoding."]);
}

export async function getVisionScan(id: string) {
  const result = await query<any>(`SELECT s.*, r.raw_ocr_text, r.normalized_vin, r.vin_valid, r.vin_warnings, r.plate_text, r.plate_state, r.decode, r.materials, r.contamination_flags FROM vision_scans s LEFT JOIN vision_results r ON r.scan_id = s.id WHERE s.id = $1 AND s.deleted_at IS NULL`, [id]);
  if (!result.rows[0]) throw createError({ statusCode: 404, statusMessage: "Vision scan not found" });
  const scan = result.rows[0];
  const candidates = await query<any>("SELECT field_name, candidate_text, confidence, source FROM vision_candidates WHERE scan_id = $1 ORDER BY confidence DESC", [id]);
  return { id: scan.id, purpose: scan.purpose, status: scan.status, confidence: Number(scan.confidence || 0), createdAt: scan.created_at, processedAt: scan.processed_at, errorMessage: scan.error_message, imageUrl: `/api/vision/scans/${scan.id}/image`, linkedRecordType: scan.linked_record_type, linkedRecordId: scan.linked_record_id, result: { rawOcrText: scan.raw_ocr_text || "", normalizedVin: scan.normalized_vin, vinValid: scan.vin_valid, vinWarnings: scan.vin_warnings || [], plateText: scan.plate_text, decode: scan.decode, materials: scan.materials || [], contaminationFlags: scan.contamination_flags || [], candidates: candidates.rows.map((candidate) => ({ field: candidate.field_name, text: candidate.candidate_text, confidence: Number(candidate.confidence), source: candidate.source })) } };
}
