import { test, expect } from '@playwright/test';
import { ownershipFixture, queueEnvelope } from './fixtures/intake-api';
import { evaluateBuyingPaymentRules } from '../src/utils/buyingPaymentRules';
import type { Ticket } from '../src/types/scrap';

test('A lost payment response reloads and opens the original paid receipt without reissuing payment', async ({ page }) => {
  const user = { id: 'payment-recovery', fullName: 'Recovery Operator', role: 'scale_operator', status: 'approved' };
  const ownership = ownershipFixture(user);
  let ticket = { id: 'PAYMENT-RECOVERY', ticketType: 'SCRAP_METAL', customerName: 'Test Seller', createdAt: new Date().toISOString(), status: 'PENDING', notes: '', operatorName: user.fullName, grossTotal: 26, totalDeductions: 0, finalPayout: 26, payoutMethod: 'Cash', buying: { version: 1, revision: 1, stage: 'DRAFT' }, selectedWeighingType: 'PLATFORM', scrapLines: [{ id: 'test-line', metalGradeId: 'grade', metalName: 'Test Ferrous', metalCategory: 'Ferrous', grossWeight: 26, tareWeight: 0, netWeight: 26, billableWeight: 26, deductionPercent: 0, deductionLbs: 0, ratePerLb: 1, lineTotal: 26, loadNumber: 1, weighingMode: 'SINGLE_WEIGHT', sourceCaptureIds: ['test-capture'] }] } as Ticket;
  const paymentBodies: string[] = [];
  let issued = 0;
  await page.route('**/api/**', async route => {
    if (await ownership(route)) return;
    const path = new URL(route.request().url()).pathname;
    let response: unknown = { ok: true };
    if (path === '/api/auth/status') response = { user, hasAdmin: true };
    else if (path === '/api/state') response = { state: { mahaffeys_tickets: [ticket], mahaffeys_settings: { operatorName: user.fullName, scales: [] } } };
    else if (path === '/api/scrap-buying/queue') response = queueEnvelope([ticket]);
    else if (path === '/api/scrap-buying/requirements') response = { revision: 1, requirePhotos: false, requirePhone: false, requireAddress: false, requireSellerId: false, requireVehiclePlate: false, requireExplicitReview: false };
    else if (path === '/api/scrap-buying/eligibility') response = evaluateBuyingPaymentRules(ticket);
    else if (path === '/api/scale/status') response = { connected: false, weight: 0, unit: 'LBS', isStable: false, isZero: true, registry: [] };
    else if (path === '/api/printers') response = [];
    else if (path === '/api/scrap-buying/commands') {
      const body = route.request().postDataJSON();
      if (body.action === 'FINALIZE_AND_PAY') {
        paymentBodies.push(route.request().postData()!);
        expect(body.reference).toBe('000123');
        if (!issued) {
          issued++; ticket = { ...ticket, status: 'COMPLETED', payoutMethod: 'Check', checkNumber: body.reference, buying: { ...ticket.buying!, revision: 2, stage: 'PAID', payment: { id: 'exact-payment', amount: 26, method: 'Check', checkReference: body.reference, paidAt: new Date().toISOString(), paidBy: user.fullName } } };
          await route.abort('failed'); return;
        }
      } else expect(body.action).toBe('ADOPT');
      response = ticket;
    }
    await route.fulfill({ json: response });
  });
  await page.goto('/intake'); await page.getByText('Start Metal Scrap Ticket', { exact: true }).click();
  await page.getByRole('button', { name: 'Claim This Intake', exact: true }).click();
  await page.getByLabel('Record Check Number · Required', { exact: true }).fill('000123');
  await page.getByRole('button', { name: 'Complete & Record Payment', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reconcile original submission', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Reconcile original submission', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('PAID IN FULL', { exact: true })).toHaveCount(2);
  expect(paymentBodies).toHaveLength(2); expect(paymentBodies[1]).toBe(paymentBodies[0]); expect(issued).toBe(1);
});
