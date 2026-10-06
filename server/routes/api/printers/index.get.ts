import { defineHandler } from "nitro";
import { requireUser } from "../../../utils/auth";
import { listNetworkPrinters } from "../../../utils/networkPrinters";

export default defineHandler(async (event) => {
  await requireUser(event);
  return listNetworkPrinters();
});
