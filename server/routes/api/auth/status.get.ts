import { defineHandler } from "nitro";
import { query } from "../../../utils/db";
import { getSessionUser } from "../../../utils/auth";

export default defineHandler(async (event) => {
  const result = await query<{ count: string }>("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 'approved'");
  return { user: await getSessionUser(event), hasAdmin: Number(result.rows[0]?.count || 0) > 0 };
});
