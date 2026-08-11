import { defineHandler } from "nitro";
import { getDatabase } from "../../utils/db";

export default defineHandler(() => {
  getDatabase().prepare("SELECT 1").get();
  return { ok: true, database: "connected", timestamp: new Date().toISOString() };
});
