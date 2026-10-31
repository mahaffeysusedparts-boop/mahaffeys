import { test, expect } from '@playwright/test';
import { ownershipFixture, queueEnvelope, type FixtureOwner } from './fixtures/intake-api';
import type { Ticket } from '../src/types/scrap';

test('Explicit tablet takeover pauses the desk while retaining its manual input', async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext({ viewport: { width: 768, height: 1024 } })]);
  const owners = new Map<string, FixtureOwner>();
  const ticket = { id: 'SHARED-LEASE', ticketType: 'SCRAP_METAL', customerName: 'Lease Test Seller', createdAt: new Date().toISOString(), status: 'PENDING', selectedWeighingType: 'VEHICLE_IN_OUT', notes: '', scrapLines: [], grossTotal: 0, totalDeductions: 0, finalPayout: 0, payoutMethod: 'Cash', operatorName: 'Test Operator', buying: { version: 1, revision: 1, stage: 'DRAFT' } } as Ticket;
  try {
    for (const [index, context] of contexts.entries()) {
      const user = { id: 'shared-login', fullName: 'Shared Operator', role: 'scale_operator', status: 'approved' };
      const ownership = ownershipFixture(user, owners);
      await context.route('**/api/**', async route => {
        if (await ownership(route)) return;
        const path = new URL(route.request().url()).pathname;
        let response: unknown = { ok: true };
        if (path === '/api/auth/status') response = { user, hasAdmin: true };
        else if (path === '/api/state') response = { state: { mahaffeys_tickets: [ticket], mahaffeys_metals: [], mahaffeys_settings: { operatorName: user.fullName, scales: [] } } };
        else if (path === '/api/scrap-buying/queue') response = queueEnvelope([ticket]);
        else if (path === '/api/scrap-buying/requirements') response = { revision: 1, requirePhotos: false, requirePhone: false, requireAddress: false, requireSellerId: false, requireVehiclePlate: false, requireExplicitReview: false };
        else if (path === '/api/scrap-buying/eligibility') response = { allowedMethods: [], reasons: [] };
        else if (path === '/api/scale/status') response = { connected: false, weight: 0, unit: 'LBS', isStable: false, isZero: true, registry: [] };
        else if (path === '/api/scrap-buying/commands') { expect(route.request().postDataJSON().action).toBe('ADOPT'); response = ticket; }
        else if (path === '/api/printers') response = [];
        await route.fulfill({ json: response });
      });
      const page = await context.newPage();
      await page.goto('/intake'); await page.getByText('Start Metal Scrap Ticket', { exact: true }).click();
      if (index === 0) { await page.getByRole('button', { name: 'Claim This Intake', exact: true }).click(); await page.getByPlaceholder('e.g. 8750').fill('8750'); }
    }
    const desk = contexts[0].pages()[0]; const tablet = contexts[1].pages()[0];
    await tablet.getByRole('button', { name: 'Review Ownership', exact: true }).click();
    await expect(tablet.getByRole('alertdialog')).toBeVisible();
    await tablet.getByRole('button', { name: 'Confirm takeover', exact: true }).click();
    await expect(tablet.getByPlaceholder('e.g. 8750')).toBeEnabled();
    await expect(desk.getByPlaceholder('e.g. 8750')).toBeDisabled();
    await expect(desk.getByPlaceholder('e.g. 8750')).toHaveValue('8750');
    await expect(desk.getByRole('alert').filter({ hasText: 'took over' })).toBeVisible();
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
