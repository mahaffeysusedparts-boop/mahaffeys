import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const execute = promisify(execFile);
const enabled = process.env.MAHAFFEYS_CUPS_INTEGRATION === "1";

// Opt-in Linux Docker test. Random resources, no published ports or production volumes.
it.skipIf(!enabled)("authorizes only the intended non-root socket client across containers and survives restart", async () => {
  const name = `mahaffeys-cups-test-${randomUUID()}`;
  const image = `${name}:test`;
  const volume = `${name}-runtime`;
  const docker = (args: string[], timeout = 30_000) => execute("docker", args, { timeout, maxBuffer: 1024 * 1024 });
  const client = (username: string, uid: string, args: string[]) => docker([
    "run", "--rm", "--network", "none", "--user", uid,
    "--mount", `type=volume,source=${volume},target=/run/cups,readonly`,
    "--env", `CUPS_USER=${username}`, "--env", "LC_ALL=C",
    "--entrypoint", "lpadmin", image, "-h", "/run/cups/cups.sock", ...args,
  ]);
  const waitForScheduler = async () => {
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        const result = await docker(["exec", name, "lpstat", "-h", "/run/cups/cups.sock", "-r"]);
        if (result.stdout.trim() === "scheduler is running") return;
      } catch { /* Container startup/restart is still in progress. */ }
      await delay(1000);
    }
    const logs = await docker(["logs", "--tail", "60", name]);
    throw new Error(`Isolated CUPS scheduler did not start: ${logs.stderr}`);
  };

  try {
    await docker(["build", "--file", "deploy/docker/cups.Dockerfile", "--tag", image, resolve(".")], 240_000);
    await docker(["volume", "create", volume]);
    await docker(["run", "--detach", "--name", name, "--network", "none", "--mount", `type=volume,source=${volume},target=/run/cups`, image]);
    await waitForScheduler();
    const queue = ["-p", "test_authorized", "-v", "ipp://127.0.0.1:9/ipp/print", "-m", "raw"];
    await client("node", "1000:1000", queue);
    const inventory = await docker(["exec", name, "lpstat", "-h", "/run/cups/cups.sock", "-v"]);
    expect(inventory.stdout).toContain("test_authorized");
    const denied = await client("nobody", "65534:65534", ["-p", "test_denied", "-v", "ipp://127.0.0.1:9/ipp/print", "-m", "raw"])
      .then(() => null, (error: { stderr?: string }) => error);
    expect(denied).not.toBeNull();
    expect(denied?.stderr).toMatch(/forbidden|unauthorized|authentication|password/i);
    await docker(["restart", name]);
    await waitForScheduler();
    await client("node", "1000:1000", ["-x", "test_authorized"]);
    const after = await docker(["exec", name, "lpstat", "-h", "/run/cups/cups.sock", "-v"]);
    expect(after.stdout).not.toContain("test_authorized");
    expect(after.stdout).not.toContain("test_denied");
  } finally {
    await docker(["rm", "--force", name]).catch(() => undefined);
    await docker(["volume", "rm", volume]).catch(() => undefined);
    await docker(["image", "rm", image]).catch(() => undefined);
  }
}, 300_000);
