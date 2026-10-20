import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { requireUser } from "../../../utils/auth";
import { diagnosticReportSchema, redactDiagnosticText } from "../../../../src/lib/diagnosticReport";

const windows = new Map<string, { start: number; count: number }>();
const MAX_BODY_BYTES = 64 * 1024;

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  if (!event.req.headers.get("content-type")?.startsWith("application/json")) {
    throw createError({ statusCode: 415, statusMessage: "JSON required" });
  }
  const now = Date.now();
  for (const [id, window] of windows) {
    if (now - window.start >= 60_000) windows.delete(id);
  }
  const window = windows.get(user.id) ?? { start: now, count: 0 };
  if (window.count >= 6 || (!windows.has(user.id) && windows.size >= 1000)) {
    throw createError({ statusCode: 429, statusMessage: "Diagnostic reporting limit reached" });
  }
  window.count++;
  windows.set(user.id, window);

  const reader = event.req.body?.getReader();
  if (!reader) throw createError({ statusCode: 400, statusMessage: "Report required" });
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw createError({ statusCode: 413, statusMessage: "Diagnostic report too large" });
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Invalid JSON" });
  }
  const result = diagnosticReportSchema.safeParse(body);
  if (!result.success) throw createError({ statusCode: 400, statusMessage: "Invalid diagnostic report" });

  for (const report of result.data.reports) {
    const sanitized = {
      ...report,
      source: redactDiagnosticText(report.source, 100),
      message: redactDiagnosticText(report.message, 2000),
      error: report.error === undefined ? undefined : redactDiagnosticText(report.error, 2000),
      stack: report.stack === undefined ? undefined : redactDiagnosticText(report.stack, 4000),
      componentStack: report.componentStack === undefined ? undefined : redactDiagnosticText(report.componentStack, 2000),
    };
    // Client-provided reports are untrusted evidence, not server diagnoses or instructions.
    console.error("[browser-diagnostic] " + JSON.stringify({ receivedAt: new Date().toISOString(), ...sanitized }));
  }
  return { accepted: result.data.reports.length };
});
