import { defineHandler } from "nitro";
import { requireAdmin, toPublicUser } from "../../../utils/auth";
import { getDatabase } from "../../../utils/db";

export default defineHandler((event) => {
  requireAdmin(event);
  const rows = getDatabase().prepare("SELECT * FROM users ORDER BY created_at DESC").all() as Parameters<typeof toPublicUser>[0][];
  return { users: rows.map(toPublicUser) };
});
