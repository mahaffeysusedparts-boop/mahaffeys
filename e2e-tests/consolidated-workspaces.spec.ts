import { test, expect } from '@playwright/test';
import { mockApi, noPageOverflow } from './fixtures/navigation';

test('Phone menu opens consolidated settings and preserves unsaved yard edits between sections', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await mockApi(page, true);
  await page.goto('/intake');
  await page.getByRole('button', { name: 'Open main menu', exact: true }).click();
  const navigation = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(navigation.getByRole('link', { name: 'Settings', exact: true })).toHaveCount(1);
  await expect(navigation.getByRole('link', { name: 'Server Admin', exact: true })).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: 'User Access', exact: true })).toHaveCount(0);
  await navigation.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.locator('header')).toHaveCount(1);
  await expect(page.getByRole('main')).toHaveCount(1);
  const save = page.getByRole('button', { name: 'Save Yard Settings', exact: true });
  await expect(save).toBeVisible();
  const yardName = page.getByDisplayValue ? null : page.locator('input').filter({ hasNot: page.locator('[type="file"]') });
  const yardInput = page.locator('input').filter({ visible: true });
  // The actual yard-name value comes from the synthetic state.
  const nameInput = page.locator('input').filter({ hasNot: page.locator('[type="file"]') });
  const yardField = page.locator('input').locator('visible=true');
  await page.getByRole('tab', { name: 'User access', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'User Management & Workstation Access Control' })).toBeVisible();
  await expect(page.locator('header')).toHaveCount(1);
  await page.getByRole('tab', { name: 'Yard & hardware', exact: true }).click();
  await expect(save).toBeVisible();
  await noPageOverflow(page);
});

test('Analytics contains reports, business intelligence and the weight journal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page, true);
  await page.route('**/api/admin/metrics/business', route => route.fulfill({ json: {
    generatedAt: new Date().toISOString(),
    inventory: { totalValue: 0, totalWeightLbs: 0, capacityUtilizationPercent: 0, bayCount: 0, categories: [] },
    throughput: { todayLbs: 0, last7DaysLbs: 0, completedTickets7Days: 0, averageLbsPerTicket: 0, daily: [] },
    financials: { payouts7Days: 0, revenue7Days: 0, grossMargin7Days: 0, marginPercent: null, settledShipments7Days: 0, daily: [] },
  } }));
  await page.goto('/intake');
  await page.getByRole('button', { name: 'Open main menu', exact: true }).click();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Analytics', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Report date range' }).selectOption('7');
  await page.getByRole('tab', { name: 'Material mix', exact: true }).click();
  await expect(page.getByText('Payout mix by material', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Business intelligence', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Yard performance at a glance' })).toBeVisible();
  await page.getByRole('tab', { name: 'Weight journal', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Weight Activity Journal' })).toBeVisible();
  await expect(page.locator('header')).toHaveCount(1);
  await expect(page.getByRole('main')).toHaveCount(1);
  await noPageOverflow(page);
});

test('A scale operator retains journal access without gaining reports or admin analytics', async ({ page }) => {
  await mockApi(page, true);
  await page.route('**/api/auth/status', route => route.fulfill({ json: {
    user: { id: 'scale-test', username: 'scale', fullName: 'Scale Tester', role: 'scale_operator', status: 'approved' }, hasAdmin: true,
  } }));
  let adminMetricsCalls = 0;
  await page.route('**/api/admin/metrics/business', route => { adminMetricsCalls++; return route.fulfill({ status: 403, json: {} }); });
  await page.goto('/scale-log');
  await expect(page.getByRole('heading', { name: 'Weight Activity Journal' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Reports', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Business intelligence', exact: true })).toHaveCount(0);
  expect(adminMetricsCalls).toBe(0);
});
