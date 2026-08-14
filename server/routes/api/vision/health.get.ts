import { defineHandler } from "nitro";
import { requireUser } from "../../../utils/auth";
import { query } from "../../../utils/db";

export default defineHandler(async (event) => {
  await requireUser(event);
  let database = false; let worker = false; let nhtsa = false;
  try { await query("SELECT 1"); database = true; } catch { /* reported below */ }
  try { const response = await fetch(`${(process.env.NITRO_VISION_WORKER_URL || "http://vision-worker:8000").replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(2_500) }); worker = response.ok; } catch { /* private worker offline */ }
  try { const response = await fetch("https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json", { method: "HEAD", signal: AbortSignal.timeout(3_500) }); nhtsa = response.ok; } catch { /* external decode unavailable */ }
  return { database, worker, nhtsa, status: !database || !worker ? "processing_unavailable" : !nhtsa ? "nhtsa_unavailable" : "online" };
});
