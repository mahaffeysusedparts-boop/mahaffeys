import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(new URL("../../scripts/mahaffeys-diagnostics.sh", import.meta.url));
const script = readFileSync(scriptPath, "utf8");
const probe = script.match(/docker compose exec -T mahaffeys node -e '([^']+)' \|\| printf/)?.[1];

describe("read-only configured CUPS diagnostics", () => {
  it.skipIf(process.platform === "win32")("retains valid POSIX shell syntax", () => {
    expect(spawnSync("/bin/sh", ["-n", scriptPath], { encoding: "utf8" }).status).toBe(0);
  });

  it("uses a syntactically valid, bounded argument-array scheduler probe", () => {
    expect(probe).toBeDefined();
    expect(spawnSync(process.execPath, ["--check"], { input: probe, encoding: "utf8" }).status).toBe(0);
    expect(probe).toContain("process.env.NITRO_CUPS_SERVER");
    expect(probe).toContain('["-h",server,"-r"]');
    expect(probe).toContain("timeout:6000,maxBuffer:8192");
    expect(probe).not.toMatch(/lpadmin|shell:true|process\.env\)\s*\)/);
  });

  it("refuses unsupported configured addresses without sending a scheduler request", () => {
    const result = spawnSync(process.execPath, ["-e", probe!], {
      env: { ...process.env, NITRO_CUPS_SERVER: "unapproved.example:631;not-a-command" }, encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("outside this read-only probe allowlist");
    expect(result.stdout + result.stderr).not.toContain("unapproved.example");
  });
});
