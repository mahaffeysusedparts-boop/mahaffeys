import { defineHandler } from "nitro";
import { requireAdmin } from "../../../../utils/auth";
import { getStorageSnapshot } from "../../../../utils/linuxStorage";

export default defineHandler(async (event) => {
  await requireAdmin(event);
  return getStorageSnapshot();
});
