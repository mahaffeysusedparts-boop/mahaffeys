import { execFile } from "node:child_process";
import { readdir, readFile, realpath } from "node:fs/promises";
import { promisify } from "node:util";
import { createError } from "nitro/h3";

const execFileAsync = promisify(execFile);
const MDADM_WRAPPER = "/usr/local/sbin/mahaffeys-mdadm";
const DEVICE_PATTERN = /^\/dev\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const ARRAY_PATTERN = /^\/dev\/md[0-9]+$/;

interface LsblkDevice {
  name: string;
  kname: string;
  path: string;
  type: string;
  size: number | string;
  model?: string | null;
  serial?: string | null;
  vendor?: string | null;
  tran?: string | null;
  hotplug?: boolean | number | null;
  rota?: boolean | number | null;
  mountpoints?: Array<string | null> | null;
  fstype?: string | null;
  uuid?: string | null;
  pkname?: string | null;
  children?: LsblkDevice[];
}

export interface StorageDisk {
  name: string;
  path: string;
  size: number;
  model: string;
  serial: string;
  vendor: string;
  transport: string;
  hotplug: boolean;
  rotational: boolean;
  mountpoints: string[];
  filesystem: string | null;
  bay: string | null;
  eligible: boolean;
}

export interface RaidMember {
  name: string;
  path: string;
  state: string;
}

export interface RaidArray {
  name: string;
  path: string;
  level: string;
  state: string;
  size: number;
  members: RaidMember[];
}

export interface EnclosureBay {
  id: string;
  enclosure: string;
  slot: string;
  status: string;
  device: string | null;
  available: boolean;
}

export interface StorageSnapshot {
  disks: StorageDisk[];
  bays: EnclosureBay[];
  arrays: RaidArray[];
  capabilities: {
    linux: boolean;
    mdadmInstalled: boolean;
    privileged: boolean;
    accessMode: string;
    automaticBayMapping: boolean;
  };
  discoveryError: string | null;
  checkedAt: string;
}

async function command(command: string, args: string[]) {
  try {
    return await execFileAsync(command, args, { timeout: 20_000, maxBuffer: 4 * 1024 * 1024 });
  } catch (error) {
    const detail = error as NodeJS.ErrnoException & { stderr?: string };
    throw createError({
      statusCode: detail.code === "ENOENT" ? 503 : 409,
      statusMessage: detail.code === "ENOENT"
        ? `${command} is not installed on this Linux server`
        : (detail.stderr?.trim() || `${command} could not complete the storage operation`),
    });
  }
}

async function requestStorageAgent<T>(path: string, init?: RequestInit): Promise<T | null> {
  const baseUrl = process.env.NITRO_STORAGE_AGENT_URL?.replace(/\/$/, "");
  if (!baseUrl) return null;
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(25_000),
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    const body = await response.json().catch(() => null) as T | { message?: string } | null;
    if (!response.ok) throw createError({ statusCode: response.status, statusMessage: (body as { message?: string } | null)?.message || "Storage agent request failed" });
    return body as T;
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    throw createError({ statusCode: 503, statusMessage: "Docker storage agent is unavailable" });
  }
}

async function readText(path: string, fallback = "") {
  try {
    return (await readFile(path, "utf8")).trim();
  } catch {
    return fallback;
  }
}

async function detectBay(kname: string) {
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

async function readEnclosureBays(): Promise<EnclosureBay[]> {
  let enclosures: string[] = [];
  try {
    enclosures = await readdir("/sys/class/enclosure");
  } catch {
    return [];
  }

  const bays: EnclosureBay[] = [];
  for (const enclosure of enclosures) {
    const enclosurePath = `/sys/class/enclosure/${enclosure}`;
    let entries: string[] = [];
    try {
      entries = await readdir(enclosurePath);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const slotPath = `${enclosurePath}/${entry}`;
      const slot = await readText(`${slotPath}/slot`);
      if (!slot) continue;
      let blockDevices: string[] = [];
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

function flatten(devices: LsblkDevice[]) {
  const result: LsblkDevice[] = [];
  const visit = (device: LsblkDevice) => {
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
  return (JSON.parse(stdout) as { blockdevices?: LsblkDevice[] }).blockdevices || [];
}

async function readArrays(devices: LsblkDevice[]): Promise<RaidArray[]> {
  const mdDevices = [...new Map(
    flatten(devices)
      .filter((device) => device.type.startsWith("raid") || device.kname.startsWith("md"))
      .map((device) => [device.kname, device]),
  ).values()];
  return Promise.all(mdDevices.map(async (device) => {
    const mdPath = `/sys/class/block/${device.kname}/md`;
    const level = await readText(`${mdPath}/level`, device.type);
    const state = await readText(`${mdPath}/array_state`, "unknown");
    let memberEntries: string[] = [];
    try {
      memberEntries = (await readdir(mdPath)).filter((entry) => entry.startsWith("dev-"));
    } catch {
      memberEntries = [];
    }
    const members = await Promise.all(memberEntries.map(async (entry) => ({
      name: entry.slice(4),
      path: `/dev/${entry.slice(4)}`,
      state: await readText(`${mdPath}/${entry}/state`, "unknown"),
    })));
    return {
      name: device.name,
      path: device.path,
      level,
      state,
      size: Number(device.size) || 0,
      members,
    };
  }));
}

async function readMdadmCapabilities() {
  let installed = true;
  try {
    await execFileAsync("mdadm", ["--version"], { timeout: 5_000 });
  } catch (error) {
    installed = (error as NodeJS.ErrnoException).code !== "ENOENT";
  }

  const runningAsRoot = typeof process.getuid === "function" && process.getuid() === 0;
  if (!installed || runningAsRoot) {
    return { installed, canManage: installed && runningAsRoot, accessMode: runningAsRoot ? "root" : "none" };
  }

  try {
    await execFileAsync("sudo", ["-n", MDADM_WRAPPER, "--version"], { timeout: 5_000 });
    return { installed: true, canManage: true, accessMode: "sudo" };
  } catch {
    return { installed: true, canManage: false, accessMode: "none" };
  }
}

export async function getStorageSnapshot(): Promise<StorageSnapshot> {
  const agentSnapshot = await requestStorageAgent<StorageSnapshot>("/snapshot");
  if (agentSnapshot) return agentSnapshot;

  let devices: LsblkDevice[] = [];
  let discoveryError: string | null = null;
  try {
    devices = await readBlockDevices();
  } catch (error) {
    discoveryError = error instanceof Error ? error.message : "Linux block devices could not be read";
  }

  const disks = await Promise.all(devices.filter((device) => device.type === "disk").map(async (device): Promise<StorageDisk> => {
    const descendants = flatten(device.children || []);
    const mountpoints = [device, ...descendants].flatMap((entry) => entry.mountpoints || []).filter((mount): mount is string => Boolean(mount));
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

  const [bays, mdadm] = await Promise.all([readEnclosureBays(), readMdadmCapabilities()]);

  return {
    disks,
    bays,
    arrays: await readArrays(devices),
    capabilities: {
      linux: process.platform === "linux",
      mdadmInstalled: mdadm.installed,
      privileged: mdadm.canManage,
      accessMode: mdadm.accessMode,
      automaticBayMapping: bays.length > 0 || disks.some((disk) => disk.bay !== null),
    },
    discoveryError,
    checkedAt: new Date().toISOString(),
  };
}

export function validateArrayPath(value: unknown) {
  if (typeof value !== "string" || !ARRAY_PATTERN.test(value)) {
    throw createError({ statusCode: 400, statusMessage: "A valid /dev/md array is required" });
  }
  return value;
}

export function validateDevicePath(value: unknown) {
  if (typeof value !== "string" || !DEVICE_PATTERN.test(value)) {
    throw createError({ statusCode: 400, statusMessage: "A valid Linux block device is required" });
  }
  return value;
}

export async function runMdadm(args: string[]) {
  if (process.env.NITRO_STORAGE_AGENT_URL) {
    return requestStorageAgent<{ accepted: boolean }>("/mdadm", {
      method: "POST",
      body: JSON.stringify({ args }),
    });
  }
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    return command("mdadm", args);
  }
  return command("sudo", ["-n", MDADM_WRAPPER, ...args]);
}
