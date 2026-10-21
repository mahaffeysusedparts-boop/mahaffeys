import { test, expect } from '@playwright/test';
import type { Ticket } from '../src/types/scrap';

// Two independent browser sessions share a synthetic server, never live yard data.
test('Stable weight captures immediately and another device receives same-login changes', async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const user = { id: 'capture-test-user', fullName: 'Capture Tester', username: 'capture-tester', role: 'scale_operator', status: 'approved' };
  const settings = { yardName: 'Test Yard', operatorName: user.fullName, defaultWeightUnit: 'LBS', currentScaleId: 'test-truck-scale', scales: [{ id: 'test-truck-scale', name: 'Test Truck Scale', connectionType: 'TCP', weighingMode: 'VEHICLE_IN_OUT', supportedWeighingTypes: ['VEHICLE_IN_OUT'], capacityLbs: 10000, resolutionLbs: 1 }] };
  let metals = [{ id: 'test-grade', name: 'Test Ferrous', code: 'TEST', category: 'Ferrous', ratePerLb: 0.1 }];
  let ticket = { id: 'CAPTURE-SYNC', ticketType: 'SCRAP_METAL', customerName: 'Capture Seller', createdAt: new Date().toISOString(), operatorName: user.fullName, status: 'PENDING', finalPayout: 0, grossTotal: 0, totalDeductions: 0, payoutMethod: 'Cash', selectedWeighingType: 'VEHICLE_IN_OUT', scrapLines: [], weightTransactions: [], buying: { version: 1, revision: 1, stage: 'DRAFT' } } as Ticket;
  let stable = false;
  let firstStableAt = 0;
  let capturedAt = 0;
  let captureCommands = 0;
  const polls = [0, 0];
  const state = () => ({ mahaffeys_tickets: [ticket], mahaffeys_metals: metals, mahaffeys_settings: settings, mahaffeys_cash_drawer: [] });
  try {
    for (const [index, context] of contexts.entries()) {
      await context.addInitScript(values => {
        for (const [key, value] of Object.entries(values)) localStorage.setItem(key, JSON.stringify(value));
      }, state());
      await context.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname;
        let response: unknown = { ok: true };
        if (path === '/api/auth/status') response = { user, hasAdmin: true };
        else if (path === '/api/users') response = { users: [user] };
        else if (path === '/api/state') response = { state: state() };
        else if (path === '/api/state/since') response = { entries: Object.entries(state()).map(([key, value]) => ({ key, value, updatedBy: user.id, updatedAt: new Date().toISOString() })), serverTime: new Date().toISOString() };
        else if (path === '/api/state/mahaffeys_metals' && route.request().method() === 'PUT') {
          metals = route.request().postDataJSON().value;
          response = { ok: true, value: metals, updatedAt: new Date().toISOString() };
        } else if (path === '/api/scale/status') {
          polls[index]++;
          if (stable && index === 0 && !firstStableAt) firstStableAt = Date.now();
          response = { connected: true, weight: stable ? 1200 : 50, unit: 'LBS', isStable: stable, isZero: false, registry: [] };
        } else if (path === '/api/scrap-buying/queue') response = { tickets: [ticket], policy: null, legacyReviews: [] };
        else if (path === '/api/scrap-buying/requirements') response = { revision: 1, requirePhotos: false, requirePhone: false, requireAddress: false, requireSellerId: false, requireVehiclePlate: false, requireExplicitReview: false };
        else if (path === '/api/scrap-buying/eligibility') response = { ticketId: ticket.id, revision: ticket.buying!.revision, allowedMethods: [], selectableMethods: [], reasons: [], permitRequired: false, documentationRequired: false };
        else if (path === '/api/scrap-buying/commands') {
          const command = route.request().postDataJSON();
          if (command.action === 'SAVE') {
            capturedAt = Date.now();
            captureCommands++;
            expect(command.ticket.scaleGrossInWeight).toBe(1200);
            expect(command.ticket.weightTransactions).toHaveLength(1);
            expect(command.ticket.weightTransactions[0].capture).toMatchObject({ normalizedLbs: 1200, originalWeight: 1200, stable: true, source: 'SCALE', scaleId: 'test-truck-scale' });
            ticket = { ...command.ticket, buying: { ...ticket.buying!, revision: ticket.buying!.revision + 1 } };
          } else expect(command.action).toBe('ADOPT');
          response = ticket;
        }
        await route.fulfill({ json: response });
      });
    }
    const [desk, otherDevice] = await Promise.all(contexts.map(context => context.newPage()));
    for (const page of [desk, otherDevice]) {
      await page.goto('/intake');
      await page.getByText('Start Metal Scrap Ticket', { exact: true }).click();
      await page.getByRole('button', { name: /Switch to This Intake|Continue This Intake/ }).click();
      await expect(page.getByRole('button', { name: /LOG IN WEIGHT/ })).toBeEnabled();
    }
    // Fill the old smoothing window, then change sharply to a stable reading.
    await expect.poll(() => polls[0]).toBeGreaterThanOrEqual(5);
    await desk.getByRole('button', { name: 'Arm Auto-Capture (capture immediately when stable)', exact: true }).click();
    await expect(desk.getByRole('button', { name: /AUTO-CAPTURE ARMED/ })).toBeVisible();
    stable = true;
    await expect(desk.getByText('IN (Gross) Logged', { exact: true })).toBeVisible();
    expect(capturedAt - firstStableAt).toBeLessThan(1500);
    expect(captureCommands).toBe(1);
    await expect(otherDevice.getByRole('alert').filter({ hasText: 'This ticket changed or closed remotely' })).toBeVisible();
    await expect(otherDevice.getByRole('button', { name: /LOG IN WEIGHT/ })).toBeDisabled();

    // A change authored by the SAME user on another device must not be skipped.
    await desk.evaluate(async () => {
      const response = await fetch('/api/state/mahaffeys_metals', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: [{ id: 'test-grade', name: 'Test Ferrous', code: 'TEST', category: 'Ferrous', ratePerLb: 0.2 }] }) });
      if (!response.ok) throw new Error('Synthetic rate update failed');
    });
    await expect.poll(() => otherDevice.evaluate(() => JSON.parse(localStorage.getItem('mahaffeys_metals') || '[]')[0]?.ratePerLb)).toBe(0.2);
    await expect.poll(() => otherDevice.evaluate(() => JSON.parse(localStorage.getItem('mahaffeys_tickets') || '[]')[0]?.scaleGrossInWeight)).toBe(1200);
    expect(captureCommands).toBe(1);
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});
