import { defineHandler } from "nitro";
import { clearSession } from "../../../utils/auth";

export default defineHandler((event) => {
  clearSession(event);
  return { ok: true };
});
