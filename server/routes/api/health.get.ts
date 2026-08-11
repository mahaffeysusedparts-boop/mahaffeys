import { defineHandler } from "nitro";
import { query } from "../../utils/db";

export default defineHandler(async () => {
  await query("SELECT 1");
  return { ok: true, database: "postgresql", timestamp: new Date().toISOString() };
});
