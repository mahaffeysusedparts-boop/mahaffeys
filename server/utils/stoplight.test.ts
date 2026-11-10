import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoplightConfig } from "./stoplightConfig";

const mocks = vi.hoisted(() => ({ query: vi.fn(), config: vi.fn() }));
vi.mock("./db", () => ({ query: mocks.query }));
vi.mock("./stoplightConfig", () => ({ getStoplightConfig: mocks.config }));

let config: StoplightConfig;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetModules();
  config = { preset: "tasmota", host: "192.168.1.75", redChannel: 1, greenChannel: 2 };
  mocks.config.mockImplementation(async () => config);
  mocks.query.mockResolvedValue({ rows: [{ value: { state: "green", relayReachable: true } }] });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });

 describe("stoplight relay feedback", () => {
  it.each([
    ["tasmota", { StatusSTS: { POWER1: "ON", POWER2: "OFF" } }, "/cm?cmnd=Status%200"],
    ["shelly_gen1", { relays: [{ ison: true }, { ison: false }] }, "/status"],
    ["shelly_gen2", { "switch:0": { output: true }, "switch:1": { output: false } }, "/rpc/Shelly.GetStatus"],
  ] as const)("reads both %s outputs rather than the saved command", async (preset, body, path) => {
    config.preset = preset;
    fetchMock.mockImplementation(async () => json(body));
    const { getStoplightStatus } = await import("./stoplight");
    const status = await getStoplightStatus();
    expect(status).toMatchObject({ state: "red", relayReachable: true });
    expect(status.verifiedAt).toBeTruthy();
    expect(fetchMock.mock.calls[0][0]).toBe(`http://${config.host}${path}`);
  });

  it("follows manual output changes without sending control commands", async () => {
    let outputs = { POWER1: "ON", POWER2: "OFF" };
    fetchMock.mockImplementation(async () => json({ StatusSTS: outputs }));
    const { getStoplightStatus } = await import("./stoplight");
    expect((await getStoplightStatus()).state).toBe("red");
    outputs = { POWER1: "OFF", POWER2: "ON" };
    expect((await getStoplightStatus()).state).toBe("green");
    outputs = { POWER1: "OFF", POWER2: "OFF" };
    expect((await getStoplightStatus()).state).toBe("off");
    expect(fetchMock.mock.calls.every(call => call[0].endsWith("Status%200"))).toBe(true);
  });

  it("reports both outputs ON as a conflict, not permission to proceed", async () => {
    fetchMock.mockImplementation(async () => json({ StatusSTS: { POWER1: "ON", POWER2: "ON" } }));
    const { getStoplightStatus } = await import("./stoplight");
    expect(await getStoplightStatus()).toMatchObject({ state: "conflict", lastError: expect.stringContaining("Both relay outputs") });
  });

  it.each([{}, { StatusSTS: { POWER1: "OFF" } }, { StatusSTS: { POWER1: "OFF", POWER2: 1 } }])("rejects incomplete or malformed feedback %j", async body => {
    fetchMock.mockImplementation(async () => json(body));
    const { getStoplightStatus } = await import("./stoplight");
    const status = await getStoplightStatus();
    expect(status).toMatchObject({ state: "unknown", relayReachable: false });
    expect(status.verifiedAt).toBeUndefined();
  });

  it("never falls back to a saved green output after a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { getStoplightStatus } = await import("./stoplight");
    expect(await getStoplightStatus()).toMatchObject({ state: "unknown", relayReachable: false, lastError: "offline" });
  });

  it("does not invoke custom command URLs to obtain status", async () => {
    config.preset = "custom";
    const { getStoplightStatus } = await import("./stoplight");
    expect(await getStoplightStatus()).toMatchObject({ state: "unknown", relayReachable: null, lastError: expect.stringContaining("device-specific") });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("turns the opposite output off first and verifies the requested state", async () => {
    fetchMock.mockImplementation(async (url: string) => url.includes("Status%200")
      ? json({ StatusSTS: { POWER1: "OFF", POWER2: "ON" } }) : json({}));
    const { commandStoplight } = await import("./stoplight");
    await commandStoplight("green", "desk-user");
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      `http://${config.host}/cm?cmnd=Power1%20Off`,
      `http://${config.host}/cm?cmnd=Power2%20On`,
      `http://${config.host}/cm?cmnd=Status%200`,
    ]);
  });

  it("rejects a successful HTTP command if the manual override keeps the other output on", async () => {
    fetchMock.mockImplementation(async (url: string) => url.includes("Status%200")
      ? json({ StatusSTS: { POWER1: "ON", POWER2: "OFF" } }) : json({}));
    const { commandStoplight, getStoplightStatus } = await import("./stoplight");
    await expect(commandStoplight("green")).rejects.toThrow("relay reports RED");
    expect((await getStoplightStatus()).state).toBe("red");
  });
});
