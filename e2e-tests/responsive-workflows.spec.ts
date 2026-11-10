import { test, expect, type Page } from '@playwright/test';
import { queueEnvelope } from './fixtures/intake-api';

const sizes = [
  { name: 'small phone', width: 320, height: 740 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'iPad portrait', width: 820, height: 1180 },
  { name: 'iPad landscape', width: 1180, height: 820 },
];

async function mockApi(page: Page, authenticated: boolean) {
  // Synthetic responses keep responsive checks away from yard data and hardware.
  const user = { id: 'responsive-admin', username: 'responsive', fullName: 'A Very Long Workstation Operator Name', role: 'admin', status: 'approved' };
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let response: unknown = { ok: true };
    if (path === '/api/auth/status') response = { user: authenticated ? user : null, hasAdmin: true };
    else if (path === '/api/users') response = { users: [user] };
    else if (path === '/api/printers' || path === '/api/scrap-buying/ownership') response = [];
    else if (path === '/api/state') response = { state: { mahaffeys_tickets: [], mahaffeys_metals: [], mahaffeys_settings: { operatorName: user.fullName, yardName: 'Mahaffeys Test Yard', scales: [] } } };
    else if (path === '/api/scrap-buying/queue') response = queueEnvelope([]);
    else if (path === '/api/scrap-buying/bin-inspections') response = { cycles: [] };
    else if (path === '/api/scrap-buying/requirements') response = { revision: 1, requirePhotos: false, requirePhone: false, requireAddress: false, requireSellerId: false, requireVehiclePlate: false, requireExplicitReview: false };
    else if (path === '/api/scale/status') response = { connected: false, weight: 0, unit: 'LBS', isStable: false, isZero: true, registry: [] };
    else if (path === '/api/inventory') response = { items: [], total: 0, page: 1, limit: 24, totalPages: 1, counts: { available: 0, pending: 0, crushed: 0 }, updatedAt: new Date().toISOString() };
    await route.fulfill({ json: response });
  });
}

async function noPageOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

for (const size of sizes) {
  test(`${size.name}: navigate and use intake without overflow or obstructed fields`, async ({ page }) => {
    await page.setViewportSize(size);
    await mockApi(page, true);
    await page.goto('/intake');
    await expect(page.getByRole('heading', { name: 'What are you starting?' })).toBeVisible();
    await noPageOverflow(page);
    const menu = page.getByRole('button', { name: 'Open main menu', exact: true });
    const box = await menu.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await menu.click();
    const drawer = page.getByRole('dialog', { name: 'Main Menu' });
    await expect(drawer).toBeVisible();
    await page.getByRole('textbox', { name: 'Search menu pages' }).fill('Dashboard');
    await drawer.getByRole('link', { name: 'Dashboard', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(drawer).not.toBeVisible();
    await noPageOverflow(page);
    await menu.click();
    await page.getByRole('textbox', { name: 'Search menu pages' }).fill('Scrap Metal Scale');
    await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Scrap Metal Scale', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'What are you starting?' })).toBeVisible();
    if (size.width >= 768) {
      const tabletNav = page.getByRole('navigation', { name: 'Tablet navigation' });
      await expect(tabletNav).toBeVisible();
      const link = await tabletNav.getByRole('link', { name: 'Dashboard', exact: true }).boundingBox();
      expect(link!.height).toBeGreaterThanOrEqual(44);
    }
    const shortcuts = page.locator('.mobile-quick-actions');
    await expect(shortcuts.getByRole('link')).toHaveCount(0);
    await page.getByRole('button', { name: 'Open quick actions', exact: true }).click();
    await expect(shortcuts.getByRole('link', { name: /Vehicle Inventory/ })).toBeVisible();
    await shortcuts.getByRole('button', { name: 'Close quick actions', exact: true }).last().click();
    await expect(shortcuts.getByRole('link')).toHaveCount(0);
    await page.getByText('New scrap load', { exact: true }).click();
    await page.getByPlaceholder('e.g. Marcus Vance').fill('Mobile Test Seller');
    await expect(shortcuts).not.toBeVisible();
    expect(await page.getByPlaceholder('e.g. Marcus Vance').evaluate(element => getComputedStyle(element).fontSize)).toBe('16px');
    await noPageOverflow(page);
    await page.getByRole('heading', { name: 'New scrap load', exact: true }).click();
    await expect(shortcuts).toBeVisible();
    await page.getByRole('navigation', { name: 'Intake workspaces' }).getByRole('button', { name: 'Open scale queue', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Weigh & pay', exact: true })).toBeVisible();
    await expect(page.getByText('No active scrap loads.', { exact: true })).toBeVisible();
    await noPageOverflow(page);
  });

  test(`${size.name}: filter the public catalog and save a vehicle request`, async ({ page }) => {
    await page.setViewportSize(size);
    await mockApi(page, false);
    await page.goto('/inventory');
    await expect(page.getByRole('heading', { name: 'Public Vehicle Inventory & Part Locator' })).toBeVisible();
    await noPageOverflow(page);
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).not.toContain('user-scalable=no');
    expect(viewport).not.toContain('maximum-scale=1');
    if (size.width < 768) {
      await page.getByRole('button', { name: 'Search & Filter Inventory' }).click();
      const filters = page.getByRole('dialog', { name: 'Find a vehicle' });
      await expect(filters).toBeVisible();
      await expect(page.locator('.mobile-quick-actions')).not.toBeVisible();
      await filters.getByPlaceholder('Year, make, model, or VIN').fill('Honda');
      await filters.getByRole('button', { name: 'Show 0 vehicles', exact: true }).click();
      await expect(filters).not.toBeVisible();
    } else {
      await page.getByPlaceholder('Search year, make, model, or VIN').fill('Honda');
    }
    await expect(page).toHaveURL(/search=Honda/);
    await expect(page.getByRole('button', { name: 'Search: Honda' })).toBeVisible();
    await noPageOverflow(page);
    await page.getByRole('button', { name: 'Save Vehicle Request', exact: true }).click();
    const request = page.getByRole('dialog', { name: 'Save Vehicle Request' });
    await expect(request).toBeVisible();
    const bounds = await request.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(size.width);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(size.height);
    await request.getByPlaceholder('Phone number or email').fill('mobile@example.com');
    await request.getByRole('button', { name: 'Save Request', exact: true }).click();
    await expect(request).not.toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mahaffeys-public-arrival-alerts') || '[]'));
    expect(saved).toEqual([expect.objectContaining({ make: 'Honda', model: 'Civic', contact: 'mobile@example.com' })]);
  });
}
