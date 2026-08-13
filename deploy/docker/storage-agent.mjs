import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { readdir, readFile, realpath } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PORT = 3010;
const DEVICE_PATTERN = /^\/dev\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const ARRAY_PATTERN = /^\/dev\/md[0-9]+$/;

async function command(program, args) {
  try {
    return await execFileAsync(program, args, { timeout: 20_000, maxBuffer: 4 * 1024 * 1024 });
  } catch (error) {
    const message = error?.stderr?.trim() || error?.message || `${program} failed`;
    const failure = new Error(message);
    failure.statusCode = error?.code === "ENOENT" ? 503 : 409;
    throw failure;
  }
}

async function readText(path, fallback = "") {
  try {
    return (await readFile(path, "utf8")).trim();
  } catch {
    return fallback;
  }
}

function flatten(devices) {
  const result = [];
  const visit = (device) => {
    result.push(device);
    device.children?.forEach(visit);
  };
  devices.forEach(visit);
  return result;
}

async function readBlockDevices() {
  const { stdout } = await command("lsblk", [
    "--json", "--bytes", "--output",
    "NAME,KNAME,PATH,TYPE,SIZE,MODEL,SERIAL,VENDOR,TRAN,HOTPLUG,ROTA,MOUNTPOINTS,FSTYPE,UUID,PKNAME",
  ]);
  return JSON.parse(stdout).blockdevices || [];
}

async function detectBay(kname) {
  try {
    const devicePath = await realpath(`/sys/class/block/${kname}/device`);
    const entries = await readdir(devicePath);
    const enclosureEntry = entries.find((entry) => entry.startsWith("enclosure_device:"));
    if (!enclosureEntry) return null;
    const enclosurePath = await realpath(`${devicePath}/${enclosureEntry}`);
    const slot = await readText(`${enclosurePath}/slot`);
    return slot ? `Bay ${slot}` : null;
  } catch {
    return null;
  }
}

async function readEnclosureBays() {
  let enclosures = [];
  try {
    enclosures = await readdir("/sys/class/enclosure");
  } catch {
    return [];
  }

  const bays = [];
  for (const enclosure of enclosures) {
    const enclosurePath = `/sys/class/enclosure/${enclosure}`;
    let entries = [];
    try {
      entries = await readdir(enclosurePath);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const slotPath = `${enclosurePath}/${entry}`;
      const slot = await readText(`${slotPath}/slot`);
      if (!slot) continue;
      let blockDevices = [];
      try {
        blockDevices = await readdir(`${slotPath}/device/block`);
      } catch {
        blockDevices = [];
      }
      const device = blockDevices[0] ? `/dev/${blockDevices[0]}` : null;
      bays.push({
        id: `${enclosure}:${slot}`,
        enclosure,
        slot,
        status: await readText(`${slotPath}/status`, device ? "occupied" : "empty"),
        device,
        available: device === null,
      });
    }
  }
  return bays.sort((a, b) => a.slot.localeCompare(b.slot, undefined, { numeric: true }));
}

async function readArrays(devices) {
  const mdDevices = [...new Map(
    flatten(devices)
      .filter((device) => device.type.startsWith("raid") || device.kname.startsWith("md"))
      .map((device) => [device.kname, device]),
  ).values()];
  return Promise.all(mdDevices.map(async (device) => {
    const mdPath = `/sys/class/block/${device.kname}/md`;
    let memberEntries = [];
    try {
      memberEntries = (await readdir(mdPath)).filter((entry) => entry.startsWith("dev-"));
    } catch {
      memberEntries = [];
    }
    return {
      name: device.name,
      path: device.path,
      level: await readText(`${mdPath}/level`, device.type),
      state: await readText(`${mdPath}/array_state`, "unknown"),
      size: Number(device.size) || 0,
      members: await Promise.all(memberEntries.map(async (entry) => ({
        name: entry.slice(4),
        path: `/dev/${entry.slice(4)}`,
        state: await readText(`${mdPath}/${entry}/state`, "unknown"),
      }))),
    };
  }));
}

async function getSnapshot() {
  let devices = [];
  let discoveryError = null;
  try {
    devices = await readBlockDevices();
  } catch (error) {
    discoveryError = error instanceof Error ? error.message : "Linux block devices could not be read";
  }

  const disks = await Promise.all(devices.filter((device) => device.type === "disk").map(async (device) => {
    const descendants = flatten(device.children || []);
    const mountpoints = [device, ...descendants].flatMap((entry) => entry.mountpoints || []).filter(Boolean);
    const hasFilesystem = [device, ...descendants].some((entry) => Boolean(entry.fstype || entry.uuid));
    const belongsToArray = descendants.some((entry) => entry.type.startsWith("raid") || entry.kname.startsWith("md"));
    return {
      name: device.name,
      path: device.path || `/dev/${device.kname}`,
      size: Number(device.size) || 0,
      model: device.model?.trim() || "Unknown model",
      serial: device.serial?.trim() || "Unavailable",
      vendor: device.vendor?.trim() || "",
      transport: device.tran || "unknown",
      hotplug: Boolean(device.hotplug),
      rotational: Boolean(device.rota),
      mountpoints,
      filesystem: device.fstype || null,
      bay: await detectBay(device.kname),
      eligible: mountpoints.length === 0 && !hasFilesystem && !belongsToArray && descendants.length === 0,
    };
  }));
  const bays = await readEnclosureBays();

  return {
    disks,
    bays,
    arrays: await readArrays(devices),
    capabilities: {
      linux: true,
      mdadmInstalled: true,
      privileged: true,
      accessMode: "agent",
      automaticBayMapping: bays.length > 0 || disks.some((disk) => disk.bay !== null),
    },
    discoveryError,
    checkedAt: new Date().toISOString(),
  };
}

function validateMdadmArgs(args) {
  if (!Array.isArray(args) || args.some((value) => typeof value !== "string")) throw Object.assign(new Error("Invalid mdadm request"), { statusCode: 400 });
  if (args[0] === "--create") {
    if (args.length < 8 || !ARRAY_PATTERN.test(args[1])) throw Object.assign(new Error("Invalid RAID create request"), { statusCode: 400 });
    const level = args[2]?.match(/^--level=(1|5|6|10)$/)?.[1];
    const count = Number(args[3]?.match(/^--raid-devices=([0-9]+)$/)?.[1]);
    const devices = args.slice(6);
    const minimums = { "1": 2, "5": 3, "6": 4, "10": 4 };
    if (!level || args[4] !== "--metadata=1.2" || args[5] !== "--run" || devices.length !== count || count < minimums[level] || (level === "10" && count % 2 !== 0) || devices.some((device) => !DEVICE_PATTERN.test(device))) {
      throw Object.assign(new Error("Invalid RAID create options"), { statusCode: 400 });
    }
    return { operation: "create", array: args[1], devices };
  }
  if (args[0] === "--manage" && args.length === 4 && ARRAY_PATTERN.test(args[1]) && ["--fail", "--remove", "--add"].includes(args[2]) && DEVICE_PATTERN.test(args[3])) {
    return { operation: args[2] === "--add" ? "add" : "remove", array: args[1], devices: [args[3]] };
  }
  throw Object.assign(new Error("Unsupported storage-management operation"), { statusCode: 400 });
}

async function runMdadm(args) {
  const request = validateMdadmArgs(args);
  const snapshot = await getSnapshot();
  const array = snapshot.arrays.find((item) => item.path === request.array);
  if (request.operation === "create") {
    const eligible = new Set(snapshot.disks.filter((disk) => disk.eligible).map((disk) => disk.path));
    if (array || request.devices.some((device) => !eligible.has(device))) throw Object.assign(new Error("Selected drives are not eligible for a new array"), { statusCode: 409 });
  } else if (!array) {
    throw Object.assign(new Error("RAID array not found"), { statusCode: 404 });
  } else if (request.operation === "add") {
    const disk = snapshot.disks.find((item) => item.path === request.devices[0]);
    if (!disk?.eligible) throw Object.assign(new Error("Replacement drive must be empty and unmounted"), { statusCode: 409 });
  } else if (!array.members.some((member) => member.path === request.devices[0])) {
    throw Object.assign(new Error("Drive is not a member of this array"), { statusCode: 409 });
  }
  await command("mdadm", args);
}

function send(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/health") return send(response, 200, { ok: true });
    if (request.method === "GET" && request.url === "/snapshot") return send(response, 200, await getSnapshot());
    if (request.method === "POST" && request.url === "/mdadm") {
      let raw = "";
      for await (const chunk of request) {
        raw += chunk;
        if (raw.length > 64 * 1024) throw Object.assign(new Error("Request too large"), { statusCode: 413 });
      }
      const body = JSON.parse(raw || "{}");
      await runMdadm(body.args);
      return send(response, 200, { accepted: true });
    }
    return send(response, 404, { message: "Not found" });
  } catch (error) {
    return send(response, Number(error?.statusCode) || 500, { message: error instanceof Error ? error.message : "Storage agent error" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Mahaffeys storage agent listening on ${PORT}`);
});
