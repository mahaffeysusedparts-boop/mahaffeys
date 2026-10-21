import { test, expect, type Page } from '@playwright/test';
import type { OutboundShipment } from '../src/types/scrap';
import { shipmentSnapshot } from '../src/utils/shipments';

async function syntheticShipments(page: Page) {
  const now = new Date().toISOString();
  const user = { id: 'mill-manager', fullName: 'Mill Manager', username: 'mill-manager', role: 'yard_manager', status: 'approved' };
  const base = { millName: 'Test Mill', materialCategory: 'Steel', grossWeightLbs: 12000, tareWeightLbs: 2000, netWeightLbs: 10000, expectedRatePerLb: 0.1, expectedRevenue: 1000, createdAt: '2026-01-01T12:00:00Z', deliveredAt: now };
  let shipments: OutboundShipment[] = [
    { ...base, id: 'delivered-test', loadNumber: 'LD-DELIVERED', status: 'DELIVERED' },
    { ...base, id: 'historical-test', loadNumber: 'LD-HISTORICAL', status: 'SETTLED', expectedRevenue: 500, expectedRatePerLb: 0.05, settlement: { scaleTicketNumber: 'OLD-MILL-001', actualNetWeightLbs: 10000, actualRatePerLb: 0.05, amountPaid: 500, deductions: 0, settledAt: now } },
  ];
  const state: Record<string, unknown> = { mahaffeys_shipments: shipments, mahaffeys_mills: [], mahaffeys_tickets: [], mahaffeys_metals: [], mahaffeys_settings: { yardName: 'Test Yard', operatorName: user.fullName, defaultWeightUnit: 'LBS', scales: [] } };
  let commands = 0;
  let forceConflict = false;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let response: unknown = { ok: true };
    if (path === '/api/auth/status') response = { user, hasAdmin: true };
    else if (path === '/api/users') response = { users: [user] };
    else if (path === '/api/scale/status') response = { connected: false, weight: 0, unit: 'LBS', isStable: false, isZero: true, registry: [] };
    else if (path === '/api/state') response = { state: { ...state, mahaffeys_shipments: shipments } };
    else if (path === '/api/state/since') {
      // Emulate JSONB changing key order after the dialog has opened.
      response = { entries: [{ key: 'mahaffeys_shipments', value: shipments.map(load => Object.fromEntries(Object.entries(load).reverse())), updatedBy: user.id, updatedAt: new Date().toISOString() }], serverTime: new Date().toISOString() };
    } else if (path.startsWith('/api/state/') && route.request().method() === 'PUT') {
      const key = decodeURIComponent(path.slice('/api/state/'.length));
      const value = route.request().postDataJSON().value;
      if (key === 'mahaffeys_shipments') shipments = value;
      state[key] = value;
      response = { ok: true, value, updatedAt: new Date().toISOString() };
    } else if (path === '/api/shipments/commands') {
      const command = route.request().postDataJSON();
      const latest = shipments.find(load => load.id === command.id)!;
      if (forceConflict || command.expectedSnapshot !== shipmentSnapshot(latest)) {
        await route.fulfill({ status: 409, json: { statusMessage: 'Shipment details changed on another device. Reopen the load and review them before saving.' } });
        return;
      }
      commands++;
      response = command.action === 'SETTLE'
        ? { ...latest, status: 'SETTLED', settlement: { ...command.settlement, actualRatePerLb: (command.settlement.amountPaid + command.settlement.deductions) / command.settlement.actualNetWeightLbs, settledAt: new Date().toISOString() } }
        : { ...latest, status: 'VOIDED', voidRecord: { reason: command.reason, voidedAt: new Date().toISOString(), voidedBy: user.fullName, voidedById: user.id, previousStatus: latest.status } };
      shipments = shipments.map(load => load.id === latest.id ? response as OutboundShipment : load);
    }
    await route.fulfill({ json: response });
  });
  return { shipments: () => shipments, commands: () => commands, conflict: () => { forceConflict = true; } };
}

test('Settle despite synced key reordering, then void a past shipment and retain its history', async ({ page }) => {
  const server = await syntheticShipments(page);
  await page.goto('/shipments');
  await page.getByRole('button', { name: /LD-DELIVERED/ }).click();
  await page.getByRole('button', { name: 'Reconcile mill settlement', exact: true }).click();
  await page.getByLabel('Mill scale ticket number', { exact: true }).fill('MILL-NEW-001');
  await page.getByLabel('Mill weight (lbs)', { exact: true }).fill('10000');
  await page.getByLabel('Mill price ($/lb)', { exact: true }).fill('0.1');
  // Verify the background refresh has applied a reordered object during editing.
  await expect.poll(() => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('mahaffeys_shipments') || '[]')[0])[0])).toBe('status');
  await page.getByRole('button', { name: 'Reconcile settlement', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('MILL-NEW-001', { exact: true })).toBeVisible();
  expect(server.shipments()[0].status).toBe('SETTLED');
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  const oldSettlement = server.shipments()[1].settlement;
  await page.getByRole('button', { name: /LD-HISTORICAL/ }).click();
  await page.getByRole('button', { name: 'Void shipment', exact: true }).click();
  const confirm = page.getByRole('button', { name: 'Confirm void shipment', exact: true });
  await expect(confirm).toBeDisabled();
  await page.getByLabel('Reason for voiding · required', { exact: true }).fill('Duplicate historical load');
  await confirm.click();
  const detail = page.getByRole('dialog');
  await expect(detail.getByText('VOIDED — history only', { exact: true })).toBeVisible();
  await expect(detail.getByText('Duplicate historical load', { exact: true })).toBeVisible();
  await expect(detail.getByText('OLD-MILL-001', { exact: true })).toBeVisible();
  await expect(detail.getByRole('button', { name: 'Update settlement', exact: true })).toHaveCount(0);
  await expect(detail.getByRole('button', { name: 'Void shipment', exact: true })).toHaveCount(0);
  expect(server.shipments()[1].settlement).toEqual(oldSettlement);
  expect(server.commands()).toBe(2);
  await detail.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByText('Settled MTD', { exact: true }).locator('..')).toContainText('$1,000.00');
  await page.getByRole('combobox', { name: 'Filter shipment status' }).click();
  await page.getByRole('option', { name: 'VOIDED', exact: true }).click();
  await expect(page.getByRole('button', { name: /LD-HISTORICAL/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /LD-DELIVERED/ })).toHaveCount(0);
  await page.goto('/reports');
  await expect(page.getByText('Revenue', { exact: true }).locator('../..')).toContainText('$1,000.00');
});

test('A real settlement conflict preserves the entered values for review', async ({ page }) => {
  const server = await syntheticShipments(page);
  await page.goto('/shipments');
  await page.getByRole('button', { name: /LD-DELIVERED/ }).click();
  await page.getByRole('button', { name: 'Reconcile mill settlement', exact: true }).click();
  await page.getByLabel('Mill scale ticket number', { exact: true }).fill('KEEP-THIS-REFERENCE');
  await page.getByLabel('Actual amount paid ($)', { exact: true }).fill('975');
  server.conflict();
  await page.getByRole('button', { name: 'Reconcile settlement', exact: true }).click();
  await expect(page.getByText('Shipment details changed on another device. Reopen the load and review them before saving.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Mill scale ticket number', { exact: true })).toHaveValue('KEEP-THIS-REFERENCE');
  await expect(page.getByLabel('Actual amount paid ($)', { exact: true })).toHaveValue('975');
  expect(server.shipments()[0].status).toBe('DELIVERED');
  expect(server.commands()).toBe(0);
});
