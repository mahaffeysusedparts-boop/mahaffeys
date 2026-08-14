import { defineHandler } from "nitro";
import { getRouterParam } from "nitro/h3";
import { requireUser } from "../../../../utils/auth";
import { getVisionScan } from "../../../../utils/vision-scans";
export default defineHandler(async (event) => { await requireUser(event); return getVisionScan(getRouterParam(event, "id") || ""); });
