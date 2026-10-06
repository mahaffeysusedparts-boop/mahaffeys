import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { requireAdmin } from "../../../utils/auth";
import { addNetworkPrinter } from "../../../utils/networkPrinters";
import { auditFor, recordAudit } from "../../../utils/audit";

export default defineHandler(async (event) => {
  const user = await requireAdmin(event);
  const body = await readBody<{ name?: string; host?: string; queuePath?: string; kind?: string }>(event);
  try {
    const printer = await addNetworkPrinter(body);
    await recordAudit(auditFor(user, {
      action: "admin.printer_add",
      entity: "printer",
      entityId: printer.id,
      detail: { name: printer.name, host: printer.host, kind: printer.kind },
    }));
    return printer;
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    throw createError({ statusCode: 500, statusMessage: "Could not add the network printer" });
  }
});
