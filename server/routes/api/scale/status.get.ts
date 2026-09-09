import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";
import { useRuntimeConfig } from "nitro/runtime-config";
import { serverScale } from "../../../utils/scale";
import { getScaleConfig } from "../../../utils/scaleConfig";

// All-scales registry — one entry per platform the workstations have polled,
// carrying its last known live status. Powers the Dashboard "Scale Wall".
interface RegistryEntry {
  scaleId: string;
  name: string;
  location: string;
  connectionType: string;
  connected: boolean;
  weight: number;
  unit: "LBS" | "KG";
  isStable: boolean;
  lastSeenAt?: string;
}

const scaleRegistry = new Map<string, RegistryEntry>();

// A platform reads as CONNECTED while some workstation polls it (~500 ms
// cadence); once polls stop it decays to OFFLINE with its last-known weight.
const REGISTRY_FRESH_MS = 5000;

export default defineHandler(async (event) => {
  const query = getQuery(event) as Record<string, string | undefined>;
  const runtimeConfig = useRuntimeConfig();
  const configuredBaudRate = Number(runtimeConfig.scaleSerialBaudRate);
  const config = await getScaleConfig({
    type: "serial",
    path: typeof runtimeConfig.scaleSerialPort === "string" ? runtimeConfig.scaleSerialPort : "",
    baudRate: Number.isFinite(configuredBaudRate) && configuredBaudRate > 0 ? configuredBaudRate : 2400,
  });

  await serverScale.start(config);
  const status = serverScale.getStatus();

  // Track which platform this poll was for so the registry stays current.
  const scaleId = typeof query.scaleId === "string" ? query.scaleId : undefined;
  if (scaleId) {
    scaleRegistry.set(scaleId, {
      scaleId,
      name: typeof query.name === "string" && query.name ? query.name : scaleId,
      location: typeof query.location === "string" ? query.location : "",
      connectionType: typeof query.connectionType === "string" ? query.connectionType : "SERVER",
      connected: status.connected,
      weight: status.weight,
      unit: status.unit,
      isStable: status.isStable,
      lastSeenAt: new Date().toISOString(),
    });
  }

  const now = Date.now();
  const registry = [...scaleRegistry.values()].map((entry) => {
    const lastSeenMs = entry.lastSeenAt ? now - new Date(entry.lastSeenAt).getTime() : Infinity;
    return {
      ...entry,
      connected: entry.connected && status.connected && lastSeenMs < REGISTRY_FRESH_MS,
    };
  });

  return { ...status, registry };
});
