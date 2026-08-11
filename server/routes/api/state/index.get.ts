import { defineHandler } from "nitro";
import { requireUser } from "../../../utils/auth";
import { query } from "../../../utils/db";

interface StateRow {
  key: string;
  value: unknown;
  updated_at: Date | string;
}

export default defineHandler(async (event) => {
  await requireUser(event);
  const result = await query<StateRow>("SELECT key, value, updated_at FROM app_state");
  const timestamps = result.rows.map((row) => row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at);
  return {
    state: Object.fromEntries(result.rows.map((row) => [row.key, row.value])),
    updatedAt: timestamps.sort().at(-1) || null,
  };
});
