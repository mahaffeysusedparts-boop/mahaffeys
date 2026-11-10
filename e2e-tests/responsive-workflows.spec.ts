import { test, expect } from '@playwright/test';
import { mockApi, noPageOverflow } from './fixtures/navigation';

const sizes = [
  { name: 'small phone', width: 320, height: 740 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'iPad portrait', width: 820, height: 1180 },
  { name: 'iPad landscape', width: 1180, height: 820 },
];

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
    await page.getByRole('searchbox', { name: 'Search menu pages' }).fill('Dashboard');
    await drawer.getByRole('link', { name: 'Dashboard', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(drawer).not.toBeVisible();
    await noPageOverflow(page);
    await menu.click();
    await page.getByRole('searchbox', { name: 'Search menu pages' }).fill('Scrap Metal Scale');
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
    await page.locator('summary').filter({ hasText: 'Switch workspace' }).click();
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
