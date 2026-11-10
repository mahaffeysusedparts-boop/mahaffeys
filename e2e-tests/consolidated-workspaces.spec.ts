import { test, expect, type Page } from '@playwright/test';

async function mockWorkspace(page: Page, role = 'admin') {
  const user = { id: 'workspace-test', username: 'workspace', fullName: 'Workspace Tester', role, status: 'approved' };
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let response: unknown = { ok: true };
    if (path === '/api/auth/status') response = { user, hasAdmin: true };
    else if (path === '/api/users') response = { users: [user] };
    else if (path === '/api/printers') response = [];
    else if (path === '/api/state') response = { state: { mahaffeys_tickets: [], mahaffeys_shipments: [], mahaffeys_metals: [], mahaffeys_scale_events: [], mahaffeys_settings: { yardName: 'Test Yard', scales: [] } } };
    else if (path === '/api/scale/status') response = { connected: false, weight: 0, unit: 'LBS', isStable: false, isZero: true, registry: [] };
    else if (path === '/api/scrap-buying/requirements') response = { revision: 1, requirePhotos: false, requirePhone: false, requireAddress: false, requireSellerId: false, requireVehiclePlate: false, requireExplicitReview: false };
    await route.fulfill({ json: response });
  });
}

test('Phone navigation opens consolidated settings and analytics and preserves old links', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await mockWorkspace(page);
  await page.goto('/analytics');
  await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible();
  await expect(page.locator('header')).toHaveCount(1);
  const header = page.locator('header');
  expect(await header.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  const menu = page.getByRole('button', { name: 'Open main menu', exact: true });
  await menu.click();
  const drawer = page.getByRole('dialog', { name: 'Main Menu' });
  await expect(drawer.getByRole('link', { name: 'Reports', exact: true })).toHaveCount(0);
  await expect(drawer.getByRole('link', { name: 'Server Admin', exact: true })).toHaveCount(0);
  await drawer.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(drawer).not.toBeVisible();
  const settings = page.getByRole('navigation', { name: 'Settings sections' });
  await expect(settings.getByRole('link')).toHaveCount(4);
  await settings.getByRole('link', { name: 'User access', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'User Management & Workstation Access Control' })).toBeVisible();
  await expect(page.locator('header')).toHaveCount(1);
  await page.goto('/reports');
  await expect(page).toHaveURL(/\/analytics\?section=reports$/);
  await expect(page.getByRole('heading', { name: 'Reports & analytics' })).toBeVisible();
  const analytics = page.getByRole('navigation', { name: 'Analytics sections' });
  await expect(analytics.getByRole('link')).toHaveCount(5);
  await analytics.getByRole('link', { name: 'Operations review', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Operations hiccups & payout reconciliation' })).toBeVisible();
  await page.goto('/pricing');
  await expect(page).toHaveURL(/\/settings\?section=pricing$/);
  await expect(settings.getByRole('link', { name: 'Pricing & parts' })).toHaveAttribute('aria-current', 'page');
});

test('Scale operators only see permitted analytics and cannot open reports directly', async ({ page }) => {
  await mockWorkspace(page, 'scale_operator');
  await page.goto('/analytics');
  const sections = page.getByRole('navigation', { name: 'Analytics sections' });
  await expect(sections.getByRole('link')).toHaveCount(1);
  await expect(sections.getByRole('link', { name: 'Scale activity' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Weight Activity Journal' })).toBeVisible();
  await page.goto('/analytics?section=reports');
  await expect(page.getByRole('heading', { name: 'No access to Reports' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reports & analytics' })).toHaveCount(0);
});
