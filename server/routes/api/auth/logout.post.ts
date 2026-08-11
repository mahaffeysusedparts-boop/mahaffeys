import { defineHandler } from "nitro";
import { clearSession } from "../../../utils/auth";

export default defineHandler(async (event) => {
  await clearSession(event);
  return { ok: true };
});
