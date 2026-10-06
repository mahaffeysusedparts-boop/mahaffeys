import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { requireUser } from "../../../../utils/auth";
import { submitPrintJob } from "../../../../utils/networkPrinters";
import { auditFor, recordAudit } from "../../../../utils/audit";

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  const id = event.context.params?.id;
  if (!id) throw createError({ statusCode: 400, statusMessage: "Printer id is required" });
  const body = await readBody<{ html: string; documentName?: string }>(event);
  if (typeof body?.html !== "string" || body.html.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "A printable HTML document is required" });
  }
  try {
    const result = await submitPrintJob(id, body.html);
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
