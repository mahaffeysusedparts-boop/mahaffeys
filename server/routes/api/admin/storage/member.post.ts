import { defineHandler } from "nitro";
import { createError, getRequestHeaders, getRequestURL, readBody } from "nitro/h3";
import { requireAdmin } from "../../../../utils/auth";
import { getStorageSnapshot, runMdadm, validateArrayPath, validateDevicePath } from "../../../../utils/linuxStorage";

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

  const body = await readBody<{ action?: "prepare" | "add"; array?: string; device?: string; confirmation?: string }>(event);
  const arrayPath = validateArrayPath(body?.array);
  const devicePath = validateDevicePath(body?.device);
  if (body?.confirmation !== "HOTSWAP") throw createError({ statusCode: 400, statusMessage: "Type HOTSWAP to confirm this operation" });

  const snapshot = await getStorageSnapshot();
  const array = snapshot.arrays.find((item) => item.path === arrayPath);
  if (!array) throw createError({ statusCode: 404, statusMessage: "RAID array not found" });

  if (body.action === "prepare") {
    if (!array.members.some((member) => member.path === devicePath)) throw createError({ statusCode: 409, statusMessage: "That drive is not a member of this array" });
    await runMdadm(["--manage", arrayPath, "--fail", devicePath]);
    await runMdadm(["--manage", arrayPath, "--remove", devicePath]);
    return { accepted: true, message: `${devicePath} is ready for physical removal`, requestedBy: user.username };
  }

  if (body.action === "add") {
    const disk = snapshot.disks.find((item) => item.path === devicePath);
    if (!disk?.eligible) throw createError({ statusCode: 409, statusMessage: "Replacement drive must be empty and unmounted" });
    await runMdadm(["--manage", arrayPath, "--add", devicePath]);
    return { accepted: true, message: `${devicePath} added to ${arrayPath}`, requestedBy: user.username };
  }

  throw createError({ statusCode: 400, statusMessage: "Choose prepare or add" });
});
