import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { requireAdmin } from "../../../utils/auth";
import { removeNetworkPrinter } from "../../../utils/networkPrinters";
import { auditFor, recordAudit } from "../../../utils/audit";

export default defineHandler(async (event) => {
  const user = await requireAdmin(event);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Printer id is required" });
  try {
    await removeNetworkPrinter(id);
    await recordAudit(auditFor(user, {
      action: "admin.printer_remove",
      entity: "printer",
      entityId: id,
    }));
    return { removed: true };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    throw createError({ statusCode: 500, statusMessage: "Could not remove the network printer" });
  }
});
