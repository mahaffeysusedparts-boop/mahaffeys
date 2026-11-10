import type { StoplightConfig } from "./stoplightConfig";

export type RelayOutputState = "red" | "green" | "off" | "conflict";

export async function relayRequest(config: StoplightConfig, url: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (config.username) {
    headers.Authorization = `Basic ${Buffer.from(`${config.username}:${config.password ?? ""}`).toString("base64")}`;
  }
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(4000),
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok) throw new Error(`Relay answered HTTP ${response.status}`);
  return response;
}

/** Read both outputs in one device snapshot; never send switching commands here. */
export async function readRelayOutputs(config: StoplightConfig): Promise<RelayOutputState> {
  if (config.preset === "custom") {
    throw new Error("Custom HTTP commands do not provide output feedback. A device-specific status integration is required.");
  }
  const path = config.preset === "tasmota" ? "/cm?cmnd=Status%200"
    : config.preset === "shelly_gen1" ? "/status" : "/rpc/Shelly.GetStatus";
  const response = await relayRequest(config, `http://${config.host}${path}`);
  const data = await response.json();
  const output = (channel: number): boolean => {
    let value: unknown;
    if (config.preset === "tasmota") {
      value = data?.StatusSTS?.[`POWER${channel}`];
      if (value === "ON") return true;
      if (value === "OFF") return false;
    } else {
      value = config.preset === "shelly_gen1"
        ? data?.relays?.[channel - 1]?.ison
        : data?.[`switch:${channel - 1}`]?.output;
      if (typeof value === "boolean") return value;
    }
    throw new Error(`Relay status did not report a valid output for channel ${channel}`);
  };
  const red = output(config.redChannel);
  const green = output(config.greenChannel);
  return red && green ? "conflict" : red ? "red" : green ? "green" : "off";
}
