import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { userInfo } from "node:os";

const { execute, query } = vi.hoisted(() => ({ execute: vi.fn(), query: vi.fn() }));
vi.mock("node:child_process", () => ({ execFile: execute }));
vi.mock("./db", () => ({ query }));

import { addNetworkPrinter, removeNetworkPrinter } from "./networkPrinters";

const input = { name: "Brother", host: "192.168.1.251", queuePath: "/ipp/print", kind: "standard" };
const row = { id: "printer-id", name: "Brother", host: input.host, queue: "yard_test", kind: "standard", created_at: "2026-01-01T00:00:00.000Z" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NITRO_CUPS_SERVER", "/run/cups/cups.sock");
  execute.mockImplementation((_program, _args, _options, callback) => callback(null, "", ""));
  query.mockResolvedValue({ rows: [row] });
});
afterEach(() => vi.unstubAllEnvs());

function failCommand(stderr: string, extra = {}) {
  execute.mockImplementation((_program, _args, _options, callback) => {
    callback(Object.assign(new Error("Command failed: lpadmin secret-command-argument"), { stderr, ...extra }));
  });
}

describe("CUPS queue command construction", () => {
  it.each(["/run/cups/cups.sock", "cups:631", "/run/cups/a socket;not-a-shell.sock"])("passes %s as exactly one -h argument", async (server) => {
    vi.stubEnv("NITRO_CUPS_SERVER", server);
    await addNetworkPrinter(input);
    const [program, args, options] = execute.mock.calls[0];
    expect(program).toBe("lpadmin");
    expect(args).toEqual(["-h", server, "-p", expect.stringMatching(/^yard_[a-f0-9]{32}$/), "-E", "-v", "ipp://192.168.1.251:631/ipp/print", "-m", "everywhere"]);
    expect(options).toMatchObject({ timeout: 30_000, maxBuffer: 1024 * 1024 });
    expect(options.env).toMatchObject({ LC_ALL: "C", CUPS_USER: userInfo().username });
    expect(options.shell).toBeUndefined();
    expect(args).not.toContain("-U");
    expect(execute).toHaveBeenCalledTimes(1); // Queue setup never submits a print job.
  });

  it("preserves the local client default when no server is configured", async () => {
    vi.stubEnv("NITRO_CUPS_SERVER", "");
    await addNetworkPrinter(input);
    expect(execute.mock.calls[0][1][0]).toBe("-p");
  });

  it("removes only the stored queue with the same transport", async () => {
    await removeNetworkPrinter(row.id);
    expect(execute.mock.calls[0].slice(0, 2)).toEqual(["lpadmin", ["-h", "/run/cups/cups.sock", "-x", "yard_test"]]);
    expect(query.mock.calls[1][0]).toBe("DELETE FROM network_printers WHERE id = $1");
  });

  it.each(["192.168.1.251;reboot", "-h evil", "192.168.1.999"])("rejects invalid host %s before executing anything", async (host) => {
    await expect(addNetworkPrinter({ ...input, host })).rejects.toMatchObject({ statusCode: 400 });
    expect(execute).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});

describe("bounded CUPS failures", () => {
  it.each(["lpadmin: Forbidden", "Unauthorized", "client-error-not-authorized", "Authorization canceled", "Authentication required", "Password for node on localhost?"])("makes %s actionable without disclosing command details", async (stderr) => {
    failCommand(stderr);
    await expect(addNetworkPrinter(input)).rejects.toMatchObject({ statusCode: 502, statusMessage: expect.stringContaining("server printing identity is not authorized") });
    expect(query).not.toHaveBeenCalled();
    try { await addNetworkPrinter(input); } catch (error) {
      const message = (error as { statusMessage: string }).statusMessage;
      expect(message).toContain("deployed identity");
      expect(message).toContain("Do not change the printer address");
      expect(message).not.toContain("secret-command-argument");
      expect(message.length).toBeLessThan(400);
    }
  });

  it("does not delete metadata after an unauthorized removal", async () => {
    failCommand("Forbidden");
    await expect(removeNetworkPrinter(row.id)).rejects.toMatchObject({ statusCode: 502 });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["", { code: "ENOENT" }, 503, "not installed"],
    ["", { killed: true }, 504, "within 30 seconds"],
    ["Permission denied", { code: "EACCES" }, 502, "socket permissions"],
    ["Unable to connect to server", {}, 502, "CUPS scheduler"],
    ["Unable to query printer", {}, 502, "negotiate IPP"],
    ["password=hidden token=hidden ipp://user:secret@host/print\n".repeat(200), {}, 502, "inspect the CUPS logs"],
  ])("classifies failures without returning raw stderr", async (stderr, extra, statusCode, fragment) => {
    failCommand(stderr as string, extra);
    await expect(addNetworkPrinter(input)).rejects.toMatchObject({ statusCode, statusMessage: expect.stringContaining(fragment as string) });
  });
});
