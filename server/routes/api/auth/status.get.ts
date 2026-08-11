import { defineHandler } from "nitro";
import { getDatabase } from "../../../utils/db";
import { getSessionUser } from "../../../utils/auth";

export default defineHandler((event) => {
  const row = getDatabase().prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 'approved'").get() as { count: number };
  return { user: getSessionUser(event), hasAdmin: row.count > 0 };
});
