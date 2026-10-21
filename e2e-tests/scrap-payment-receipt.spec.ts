import { test, expect } from '@playwright/test';
import { evaluateBuyingPaymentRules } from '../src/utils/buyingPaymentRules';
import type { Ticket } from '../src/types/scrap';

// Synthetic API responses keep this browser flow independent of live yard data.
for (const scenario of [
  { category: 'Ferrous', amount: 25, method: 'Cash' },
  { category: 'Ferrous', amount: 25.01, method: 'Check' },
  { category: 'Non-Ferrous', amount: 100, method: 'Cash' },
  { category: 'Non-Ferrous', amount: 100.01, method: 'Check' },
] as const) {
  test(`${scenario.category} $${scenario.amount} completes with ${scenario.method} and a PAID receipt`, async ({ page }) => {
    const user = { id: 'browser-test-operator', fullName: 'Test Operator', username: 'test-operator', role: 'scale_operator', status: 'approved', createdAt: new Date().toISOString() };
    const metal = { id: 'browser-grade', name: 'Test Metal', code: 'TEST', category: scenario.category, ratePerLb: 1 };
    let ticket = {
      id: 'browser-payment-ticket', ticketType: 'SCRAP_METAL', customerName: 'Test Seller',
      createdAt: new Date().toISOString(), status: 'PENDING', operatorName: user.fullName,
      grossTotal: scenario.amount, totalDeductions: 0, finalPayout: scenario.amount, payoutMethod: 'Cash',
      buying: { version: 1, revision: 1, stage: 'DRAFT' }, selectedWeighingType: 'PLATFORM',
      scrapLines: [{ id: 'browser-line', metalGradeId: metal.id, metalName: metal.name, metalCategory: scenario.category,
        grossWeight: scenario.amount, tareWeight: 0, netWeight: scenario.amount, billableWeight: scenario.amount,
        deductionPercent: 0, deductionLbs: 0, ratePerLb: 1, lineTotal: scenario.amount, loadNumber: 1,
        weighingMode: 'SINGLE_WEIGHT', sourceCaptureIds: ['browser-capture'] }],
    } as Ticket;
    const state = () => ({ mahaffeys_tickets: [ticket], mahaffeys_metals: [metal], mahaffeys_settings: { yardName: 'Test Yard', defaultWeightUnit: 'LBS', scales: [], operatorName: user.fullName }, mahaffeys_cash_drawer: [] });
    let paymentCommands = 0;
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let response: unknown = { ok: true };
      if (path === '/api/auth/status') response = { user, hasAdmin: true };
      else if (path === '/api/state') response = { state: state() };
      else if (path === '/api/scale/status') response = { connected: false, weight: 0, unit: 'LBS', isStable: false, isZero: true, registry: [] };
      else if (path === '/api/scrap-buying/queue') response = { tickets: [ticket], policy: null, legacyReviews: [] };
      else if (path === '/api/scrap-buying/requirements') response = { revision: 1, requirePhotos: false, requirePhone: false, requireAddress: false, requireSellerId: false, requireVehiclePlate: false, requireExplicitReview: false };
      else if (path === '/api/scrap-buying/eligibility') response = evaluateBuyingPaymentRules(ticket);
      else if (path === '/api/scrap-buying/commands') {
        const command = route.request().postDataJSON();
        expect(command.action).toBe('FINALIZE_AND_PAY');
        expect(command.method).toBe(scenario.method);
        expect(command.disbursed).toBe(true);
        if (scenario.method === 'Check') expect(command.reference).toBe('0009042');
        paymentCommands++;
        ticket = { ...ticket, status: 'COMPLETED', payoutMethod: scenario.method, checkNumber: scenario.method === 'Check' ? command.reference : undefined,
          buying: { ...ticket.buying!, revision: 2, stage: 'PAID', payment: { id: 'browser-payment', amount: scenario.amount,
            method: scenario.method, checkReference: scenario.method === 'Check' ? command.reference : undefined,
            paidAt: new Date().toISOString(), paidBy: user.fullName, paymentRuleVersion: 'category-thresholds-v1' } } };
        response = ticket;
      }
      await route.fulfill({ json: response });
    });
    await page.goto('/intake');
    await page.getByText('Start Metal Scrap Ticket', { exact: true }).click();
    await page.getByRole('button', { name: /Switch to This Intake|Continue This Intake/ }).click();
    await expect(page.getByRole('heading', { name: 'Final purchase review' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Pay Later/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: scenario.method, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: scenario.method === 'Cash' ? 'Check' : 'Cash', exact: true })).toBeDisabled();
    const complete = page.getByRole('button', { name: 'Complete & Record Payment', exact: true });
    if (scenario.method === 'Check') {
      await expect(complete).toBeDisabled();
      await page.getByLabel('Record Check Number · Required', { exact: true }).fill('0009042');
    } else await expect(page.getByLabel('Record Check Number · Required', { exact: true })).toHaveCount(0);
    await expect(complete).toBeEnabled();
    await complete.click();
    const receipt = page.getByRole('dialog');
    await expect(receipt.getByText('PAID — PAYMENT RECEIPT', { exact: true })).toHaveCount(2);
    await expect(receipt.getByText('PAID IN FULL', { exact: true })).toHaveCount(2);
    if (scenario.method === 'Check') await expect(receipt.getByText('0009042', { exact: false }).first()).toBeVisible();
    expect(paymentCommands).toBe(1);
  });
}
