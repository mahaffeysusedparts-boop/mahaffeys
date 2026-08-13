import { defineHandler } from "nitro";
import { createError, getRequestHeaders, getRequestURL, readBody } from "nitro/h3";
import { requireAdmin } from "../../../../utils/auth";
import { getStorageSnapshot, runMdadm, validateArrayPath, validateDevicePath } from "../../../../utils/linuxStorage";

const RAID_MINIMUMS: Record<string, number> = { "1": 2, "5": 3, "6": 4, "10": 4 };

export default defineHandler(async (event) => {
  const user = await requireAdmin(event);
  const origin = getRequestHeaders(event).origin;
  let sameOrigin = false;
  try {
    sameOrigin = !!origin && new URL(origin).host === getRequestURL(event).host;
  } catch {
    sameOrigin = false;
  }
  if (!sameOrigin) {
    throw createError({ statusCode: 403, statusMessage: "Same-origin request required" });
  }

  const body = await readBody<{ array?: string; level?: string; devices?: unknown[]; confirmation?: string }>(event);
  const array = validateArrayPath(body?.array);
  const level = typeof body?.level === "string" ? body.level : "";
  if (!RAID_MINIMUMS[level]) throw createError({ statusCode: 400, statusMessage: "Supported RAID levels are 1, 5, 6, and 10" });
  const devices = Array.isArray(body?.devices) ? [...new Set(body.devices.map(validateDevicePath))] : [];
  if (devices.length < RAID_MINIMUMS[level] || (level === "10" && devices.length % 2 !== 0)) {
    throw createError({ statusCode: 400, statusMessage: `RAID ${level} requires ${level === "10" ? "an even number of at least 4" : `at least ${RAID_MINIMUMS[level]}`} drives` });
  }
  if (body?.confirmation !== "CREATE") throw createError({ statusCode: 400, statusMessage: "Type CREATE to confirm array creation" });

  const snapshot = await getStorageSnapshot();
  if (snapshot.arrays.some((existing) => existing.path === array)) throw createError({ statusCode: 409, statusMessage: `${array} already exists` });
  const eligible = new Set(snapshot.disks.filter((disk) => disk.eligible).map((disk) => disk.path));
  if (devices.some((device) => !eligible.has(device))) {
    throw createError({ statusCode: 409, statusMessage: "Every selected drive must be empty, unmounted, and outside an existing array" });
  }

  await runMdadm(["--create", array, `--level=${level}`, `--raid-devices=${devices.length}`, "--metadata=1.2", "--run", ...devices]);
  return { accepted: true, message: `${array} RAID ${level} created`, requestedBy: user.username };
});
