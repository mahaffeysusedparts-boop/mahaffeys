import { test, expect } from '@playwright/test';
import { queueEnvelope } from './fixtures/intake-api';
import type { Ticket } from '../src/types/scrap';

test('Two operators can open and work on the same intake without claiming or taking over', async ({ browser, baseURL }) => {
  const contexts = await Promise.all([browser.newContext({ baseURL }), browser.newContext({ baseURL, viewport: { width: 768, height: 1024 } })]);
  let ownershipRequests = 0;
  let saves = 0;
  let ticket = { id: 'SHARED-INTAKE', ticketType: 'SCRAP_METAL', customerName: 'Shared Test Seller', createdAt: new Date().toISOString(), status: 'PENDING', selectedWeighingType: 'VEHICLE_IN_OUT', notes: '', scrapLines: [], grossTotal: 0, totalDeductions: 0, finalPayout: 0, payoutMethod: 'Cash', operatorName: 'Test Operator', buying: { version: 1, revision: 1, stage: 'DRAFT' } } as Ticket;
  try {
    for (const [index, context] of contexts.entries()) {
      const user = { id: `operator-${index}`, fullName: `Operator ${index}`, role: 'scale_operator', status: 'approved' };
      await context.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/api/scrap-buying/ownership') {
          ownershipRequests++;
          await route.fulfill({ status: 503, json: { statusMessage: 'Ownership is unavailable' } });
          return;
        }
        let response: unknown = { ok: true };
        if (path === '/api/auth/status') response = { user, hasAdmin: true };
        else if (path === '/api/state') response = { state: { mahaffeys_tickets: [ticket], mahaffeys_metals: [], mahaffeys_settings: { operatorName: user.fullName, scales: [] } } };
        else if (path === '/api/scrap-buying/queue') response = queueEnvelope([ticket]);
        else if (path === '/api/scrap-buying/requirements') response = { revision: 1, requirePhotos: false, requirePhone: false, requireAddress: false, requireSellerId: false, requireVehiclePlate: false, requireExplicitReview: false };
        else if (path === '/api/scrap-buying/eligibility') response = { allowedMethods: [], reasons: [] };
        else if (path === '/api/scale/status') response = { connected: false, weight: 0, unit: 'LBS', isStable: false, isZero: true, registry: [] };
        else if (path === '/api/scrap-buying/commands') {
          const body = route.request().postDataJSON();
          if (body.action === 'SAVE') {
            expect(body.revision).toBe(ticket.buying!.revision);
            ticket = { ...body.ticket, buying: { ...ticket.buying!, revision: ticket.buying!.revision + 1 } };
            saves++;
          } else expect(body.action).toBe('ADOPT');
          response = ticket;
        } else if (path === '/api/printers') response = [];
        await route.fulfill({ json: response });
      });
      const page = await context.newPage();
      await page.goto('/intake');
      await page.getByRole('region', { name: 'Intake home', exact: true }).getByRole('button', { name: /^Open scale queue / }).click();
      await page.getByRole('button', { name: 'Open This Intake', exact: true }).click();
      await expect(page.getByPlaceholder('e.g. 8750')).toBeEnabled();
      await page.getByPlaceholder('e.g. 8750').fill(index === 0 ? '8750' : '9000');
    }
    const desk = contexts[0].pages()[0];
    const tablet = contexts[1].pages()[0];
    await expect(desk.getByPlaceholder('e.g. 8750')).toBeEnabled();
    await expect(desk.getByPlaceholder('e.g. 8750')).toHaveValue('8750');
    await expect(tablet.getByRole('alertdialog')).toHaveCount(0);
    await tablet.getByRole('button', { name: 'Log IN Manually', exact: true }).click();
    await expect(tablet.getByText('IN (Gross) Logged', { exact: true })).toBeVisible();
    expect(ticket.scaleGrossInWeight).toBe(9000);
    expect(saves).toBe(1);
    expect(ownershipRequests).toBe(0);
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
