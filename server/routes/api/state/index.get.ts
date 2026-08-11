import { defineHandler } from "nitro";
import { requireUser } from "../../../utils/auth";
import { getDatabase } from "../../../utils/db";

export default defineHandler((event) => {
  requireUser(event);
  const rows = getDatabase().prepare("SELECT key, value, updated_at FROM app_state").all() as Array<{ key: string; value: string; updated_at: string }>;
  return {
    state: Object.fromEntries(rows.map((row) => [row.key, JSON.parse(row.value)])),
    updatedAt: rows.reduce<string | null>((latest, row) => !latest || row.updated_at > latest ? row.updated_at : latest, null),
  };
});
