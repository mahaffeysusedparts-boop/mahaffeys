import { test, expect } from '@playwright/test';
import { ownershipFixture, queueEnvelope } from './fixtures/intake-api';
import type { Ticket } from '../src/types/scrap';

for (const failure of ['CREATE_RESPONSE_LOST', 'MANUAL_SAVE_REJECTED'] as const) {
  test(failure === 'CREATE_RESPONSE_LOST' ? 'Lost intake response reloads and continues the same confirmed ticket' : 'Rejected manual IN retains the exact value until a confirmed retry', async ({ page }) => {
    const user = { id: 'recovery-test', fullName: 'Recovery Tester', role: 'scale_operator', status: 'approved' };
    const ownership = ownershipFixture(user);
    let ticket: Ticket | null = failure === 'MANUAL_SAVE_REJECTED' ? { id: 'MANUAL-TEST', ticketType: 'SCRAP_METAL', customerName: 'Test Seller', createdAt: new Date().toISOString(), status: 'PENDING', selectedWeighingType: 'VEHICLE_IN_OUT', notes: '', scrapLines: [], grossTotal: 0, totalDeductions: 0, finalPayout: 0, payoutMethod: 'Cash', operatorName: user.fullName, buying: { version: 1, revision: 1, stage: 'DRAFT' } } : null;
    let fail = true;
    const createBodies: string[] = [];
    let customerWrites = 0;
    await page.route('**/api/**', async route => {
      if (await ownership(route)) return;
      const path = new URL(route.request().url()).pathname;
      let response: unknown = { ok: true };
      if (path === '/api/auth/status') response = { user, hasAdmin: true };
      else if (path === '/api/state') response = { state: { mahaffeys_tickets: ticket ? [ticket] : [], mahaffeys_metals: [{ id: 'grade', name: 'Test Ferrous', category: 'Ferrous', code: 'TEST', ratePerLb: 0.1 }], mahaffeys_settings: { operatorName: user.fullName, scales: [], yardName: 'Synthetic Yard' } } };
      else if (path === '/api/scrap-buying/queue') response = queueEnvelope(ticket ? [ticket] : []);
      else if (path === '/api/scrap-buying/requirements') response = { revision: 1, requirePhotos: false, requirePhone: false, requireAddress: false, requireSellerId: false, requireVehiclePlate: false, requireExplicitReview: false };
      else if (path === '/api/scrap-buying/eligibility') response = { allowedMethods: [], reasons: [] };
      else if (path === '/api/scale/status') response = { connected: false, weight: 0, unit: 'LBS', isStable: false, isZero: true, registry: [] };
      else if (path === '/api/printers') response = [];
      else if (path === '/api/scrap-buying/commands') {
        const body = route.request().postDataJSON();
        if (body.action === 'CREATE') {
          createBodies.push(route.request().postData()!);
          if (!ticket) { ticket = { ...body.ticket, customerId: 'atomic-test-customer', buying: { version: 1, revision: 1, stage: 'DRAFT' } }; customerWrites++; }
          if (fail) { fail = false; await route.abort('failed'); return; }
        } else if (body.action === 'SAVE') {
          if (fail) { fail = false; await route.fulfill({ status: 409, json: { statusMessage: 'Synthetic save rejected' } }); return; }
          ticket = { ...body.ticket, buying: { ...ticket!.buying!, revision: ticket!.buying!.revision + 1 } };
        } else expect(body.action).toBe('ADOPT');
        response = ticket;
      }
      await route.fulfill({ json: response });
    });
    await page.goto('/intake');
    await page.getByRole('region', { name: 'Intake home', exact: true }).getByRole('button', { name: failure === 'CREATE_RESPONSE_LOST' ? /^New scrap load / : /^Open scale queue / }).click();
    if (failure === 'CREATE_RESPONSE_LOST') {
      await page.getByPlaceholder('e.g. Marcus Vance').fill('Retained Seller');
      await page.getByRole('button', { name: 'Save Intake & Continue to Scale', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Reconcile original intake & continue' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Continue to scale guidance' }).getByRole('status')).toContainText('Do not create a replacement load.');
      await expect(page.getByRole('button', { name: 'Save Intake & Continue to Scale', exact: true })).toBeDisabled();
      await expect(page.getByPlaceholder('e.g. Marcus Vance')).toHaveValue('Retained Seller');
      await page.reload();
      await page.getByRole('button', { name: 'Resume previous workspace', exact: true }).click();
      await page.getByRole('button', { name: 'Reconcile original intake & continue' }).click();
      await expect(page.getByText('Retained Seller', { exact: true }).first()).toBeVisible();
      expect(createBodies).toHaveLength(2);
      expect(createBodies[1]).toBe(createBodies[0]);
      expect(customerWrites).toBe(1);
    } else {
      await page.getByRole('button', { name: /Claim This Intake|Switch to This Intake|Continue This Intake/ }).click();
      const input = page.getByPlaceholder('e.g. 8750');
      await input.fill('8750');
      await page.getByRole('button', { name: 'Log IN Manually', exact: true }).click();
      await expect(page.getByText('Not confirmed: Synthetic save rejected', { exact: true })).toBeVisible();
      await expect(input).toHaveValue('8750');
      await page.getByRole('button', { name: 'Log IN Manually', exact: true }).click();
      await expect(page.getByText('IN (Gross) Logged', { exact: true })).toBeVisible();
      await expect(page.getByPlaceholder('e.g. 6420')).toHaveValue('');
      expect(ticket!.weightTransactions).toHaveLength(1);
    }
  });
}
