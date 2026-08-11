import { defineHandler } from "nitro";
import { requireAdmin, toPublicUser, type UserRow } from "../../../utils/auth";
import { query } from "../../../utils/db";

export default defineHandler(async (event) => {
  await requireAdmin(event);
  const result = await query<UserRow>("SELECT * FROM users ORDER BY created_at DESC");
  return { users: result.rows.map(toPublicUser) };
});
