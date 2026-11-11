import { test, expect } from "@playwright/test";
import { queueEnvelope } from "./fixtures/intake-api";
import type { StoplightStatus } from "../src/services/stoplightService";

test("Desk light follows manual relay changes and only displays confirmed output", async ({ page }) => {
  // Synthetic device/server: never send traffic-light commands to the yard.
  const user = { id: "light-test", fullName: "Light Tester", role: "scale_operator", status: "approved" };
  let output: StoplightStatus["state"] = "red";
  let offline = false;
  let rejectCommand = false;
  let commands = 0;
  let confirmCommand: () => void = () => {};
  const confirmation = new Promise<void>(resolve => { confirmCommand = resolve; });
  const status = (): StoplightStatus => ({
    configured: true, state: output, relayReachable: true,
    verifiedAt: output === "unknown" ? undefined : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastError: output === "conflict" ? "Both relay outputs are ON. Check the manual switch." : undefined,
  });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = { ok: true };
    if (path === "/api/auth/status") body = { user, hasAdmin: true };
    else if (path === "/api/state") body = { state: { mahaffeys_tickets: [], mahaffeys_metals: [], mahaffeys_settings: { operatorName: user.fullName, scales: [] } } };
    else if (path === "/api/scrap-buying/queue") body = queueEnvelope([]);
    else if (path === "/api/scale/status") body = { connected: false, weight: 0, unit: "LBS", isStable: false, isZero: true, registry: [] };
    else if (path === "/api/printers") body = [];
    else if (path === "/api/stoplight/status") {
      if (offline) { await route.fulfill({ status: 503, json: { statusMessage: "Offline" } }); return; }
      body = status();
    } else if (path === "/api/stoplight/command") {
      commands++;
      if (rejectCommand) { await route.fulfill({ status: 502, json: { statusMessage: "Manual override prevented GREEN" } }); return; }
      await confirmation;
      output = route.request().postDataJSON().state;
      body = status();
    }
    await route.fulfill({ json: body });
  });
  await page.goto("/intake");
  await page.getByText("Open scale queue", { exact: true }).click();
  const panel = page.getByTestId("stoplight-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("button", { name: "RED — STAY ON SCALE", exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "GREEN — PROCEED OFF SCALE", exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "All lights off", exact: true })).toBeVisible();
  const indicator = panel.getByTestId("stoplight-output");
  await expect(indicator).toHaveText("HOLD — STAY ON SCALE");

  // A physical switch changes relay output with no desk command.
  output = "green";
  await expect(indicator).toHaveText("PROCEED OFF SCALE");
  output = "off";
  await expect(indicator).toHaveText("LIGHTS OFF");
  output = "conflict";
  await expect(indicator).toHaveText("BOTH LIGHTS ON — CHECK SWITCH");
  expect(commands).toBe(0);

  offline = true;
  await expect(indicator).toHaveText("OUTPUT UNKNOWN — CHECK LIGHTS");
  offline = false;
  output = "red";
  await expect(indicator).toHaveText("HOLD — STAY ON SCALE");

  await panel.getByRole("button", { name: "GREEN — PROCEED OFF SCALE", exact: true }).click();
  await expect(indicator).toHaveText("OUTPUT UNKNOWN — CHECK LIGHTS");
  await expect(panel.getByRole("button", { name: "Switching…", exact: true })).toBeDisabled();
  confirmCommand();
  await expect(indicator).toHaveText("PROCEED OFF SCALE");
  expect(commands).toBe(1);

  output = "red";
  await expect(indicator).toHaveText("HOLD — STAY ON SCALE");
  rejectCommand = true;
  await panel.getByRole("button", { name: "GREEN — PROCEED OFF SCALE", exact: true }).click();
  await expect(page.getByText("Manual override prevented GREEN", { exact: true })).toBeVisible();
  await expect(indicator).toHaveText("HOLD — STAY ON SCALE");
  expect(commands).toBe(2);
});
