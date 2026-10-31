import { test, expect } from '@playwright/test';

test('Create a local preview account and retain a customer in a fresh browser session', async ({ page, browser, baseURL }) => {
  test.setTimeout(120000);
  const suffix = Date.now().toString();
  const username = `preview-${suffix}`;
  const password = 'Preview-only-test-password-42';
  const customerName = `Local Preview Seller ${suffix}`;

  const status = await page.request.get('/api/auth/status', { timeout: 60000 });
  expect(status.ok(), `Local storage startup returned HTTP ${status.status()}: ${await status.text()}`).toBe(true);
  expect((await status.json()).hasAdmin, 'Run first-time setup against an empty isolated preview, not existing user data.').toBe(false);
  await page.goto('/setup');
  await expect(page.getByTestId('local-preview-banner')).toContainText('Live yard database is not connected.');
  try {
    await expect(page.getByText('Create Administrator Account', { exact: true })).toBeVisible();
  } catch (error) {
    throw new Error(`${String(error)}\nPage snapshot: ${await page.locator('body').innerText()}`);
  }
  await page.getByPlaceholder('e.g. Marcus Vance (Owner)').fill('Local Preview Admin');
  await page.getByPlaceholder('admin', { exact: true }).fill(username);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Initialize System & Sign In' }).click();
  await expect(page).toHaveURL(/\/$/);

  const audit = await page.request.get('/api/admin/media-audit');
  expect(audit.ok()).toBe(true);
  expect(await audit.json()).toMatchObject({ connectedHost: 'this computer', connectedDatabase: 'local-preview' });

  await page.goto('/customers');
  await page.getByRole('button', { name: 'Register Customer', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('e.g. Marcus Vance', { exact: true }).fill(customerName);
  await dialog.getByPlaceholder('(555) 000-0000').fill('5551237890');
  await dialog.getByRole('button', { name: 'Save Customer', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('cell').filter({ hasText: customerName })).toBeVisible();

  const freshContext = await browser.newContext({ baseURL });
  try {
    const freshPage = await freshContext.newPage();
    await freshPage.goto('/login');
    await freshPage.getByPlaceholder('e.g. admin or scale_tech1').fill(username);
    await freshPage.getByPlaceholder('••••••••').fill(password);
    await freshPage.getByRole('button', { name: 'Sign In to Workstation' }).click();
    await expect(freshPage).toHaveURL(/\/$/);
    await freshPage.goto('/customers');
    await expect(freshPage.getByRole('cell').filter({ hasText: customerName })).toBeVisible();
  } finally {
    await freshContext.close();
  }
});
