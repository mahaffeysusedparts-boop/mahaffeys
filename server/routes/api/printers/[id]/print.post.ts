import { gunzip } from "node:zlib";
import { promisify } from "node:util";
import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { requireUser } from "../../../../utils/auth";
import { submitPrintJob } from "../../../../utils/networkPrinters";
import { auditFor, recordAudit } from "../../../../utils/audit";

const gunzipAsync = promisify(gunzip);

async function readPrintableHtml(body: { html?: unknown; htmlGzipBase64?: unknown }) {
  if (typeof body.html === "string") return body.html;
  if (typeof body.htmlGzipBase64 !== "string" || body.htmlGzipBase64.length === 0) return "";
  try {
    const inflated = await gunzipAsync(Buffer.from(body.htmlGzipBase64, "base64"));
    return inflated.toString("utf8");
  } catch {
    throw createError({ statusCode: 400, statusMessage: "The compressed print document could not be read" });
  }
}

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  const id = event.context.params?.id;
  if (!id) throw createError({ statusCode: 400, statusMessage: "Printer id is required" });
  const body = await readBody<{ html?: string; htmlGzipBase64?: string; documentName?: string }>(event, { limit: 24 * 1024 * 1024 });
  const html = await readPrintableHtml(body ?? {});
  if (html.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "A printable HTML document is required" });
  }
  try {
    const result = await submitPrintJob(id, html);
    await recordAudit(auditFor(user, {
      action: "print.submit",
      entity: "printer",
      entityId: id,
      detail: { documentName: body.documentName || "print-job", queued: result.queued },
    }));
    return result;
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    throw createError({ statusCode: 500, statusMessage: "Could not send the print job to the network printer" });
  }
});
