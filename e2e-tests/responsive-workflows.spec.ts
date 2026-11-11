import { test, expect, type Page } from '@playwright/test';
import { ownershipFixture, queueEnvelope } from './fixtures/intake-api';
import type { Ticket } from '../src/types/scrap';

const sizes = [
  { name: 'small phone', width: 320, height: 740 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'phone landscape', width: 640, height: 390 },
  { name: 'iPad portrait', width: 820, height: 1180 },
  { name: 'iPad landscape', width: 1180, height: 820 },
];

async function mockApi(page: Page, authenticated: boolean, ticket?: Ticket) {
  // Synthetic responses keep responsive checks away from yard data and hardware.
  const user = { id: 'responsive-admin', username: 'responsive', fullName: 'A Very Long Workstation Operator Name', role: 'admin', status: 'approved' };
  const scales = ticket ? [{ id: 'test-platform', name: 'Test Platform Scale', connectionType: 'TCP', weighingMode: 'SINGLE_WEIGHT', supportedWeighingTypes: ['PLATFORM'], capacityLbs: 10000, resolutionLbs: 1 }] : [];
  const state = { mahaffeys_tickets: ticket ? [ticket] : [], mahaffeys_metals: [{ id: 'test-metal', name: 'Test Ferrous', code: 'TEST', category: 'Ferrous', ratePerLb: 0.1 }], mahaffeys_settings: { operatorName: user.fullName, yardName: 'Mahaffeys Test Yard', scales, currentScaleId: scales[0]?.id } };
  await page.addInitScript(values => {
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, JSON.stringify(value));
  }, state);
  const ownership = ownershipFixture(user);
  await page.route('**/api/**', async route => {
    if (await ownership(route)) return;
    const path = new URL(route.request().url()).pathname;
    let response: unknown = { ok: true };
    if (path === '/api/auth/status') response = { user: authenticated ? user : null, hasAdmin: true };
    else if (path === '/api/users') response = { users: [user] };
    else if (path === '/api/printers') response = [];
    else if (path === '/api/state') response = { state };
    else if (path === '/api/scrap-buying/queue') response = queueEnvelope(ticket ? [ticket] : []);
    else if (path === '/api/scrap-buying/commands') {
      const command = route.request().postDataJSON();
      if (command.action === 'SAVE') {
        ticket = { ...command.ticket, buying: { ...ticket!.buying!, revision: ticket!.buying!.revision + 1 } };
        state.mahaffeys_tickets = [ticket!];
      } else expect(command.action).toBe('ADOPT');
      response = ticket;
    }
    else if (path === '/api/scrap-buying/eligibility') response = { ticketId: ticket?.id, revision: 1, allowedMethods: [], selectableMethods: [], reasons: [], permitRequired: false, documentationRequired: false };
    else if (path === '/api/scale/evidence-config') response = { scales: [], cameras: [] };
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
    await expect(page.getByRole('region', { name: 'Continue to scale guidance' }).getByText('Ready to save and continue to scale.', { exact: false })).toBeVisible();
    await page.locator('summary').filter({ hasText: 'Switch workspace' }).click();
    await page.getByRole('navigation', { name: 'Intake workspaces' }).getByRole('button', { name: 'Open scale queue', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Weigh & pay', exact: true })).toBeVisible();
    await expect(page.getByText('No active scrap loads.', { exact: true })).toBeVisible();
    await noPageOverflow(page);
    await menu.click();
    await drawer.getByRole('button', { name: 'Scale configuration · Offline', exact: true }).click();
    const configuration = page.getByRole('dialog', { name: 'Rice Lake IQ710 Connection' });
    await expect(configuration).toBeVisible();
    const bounds = await configuration.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(size.width);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(size.height);
    await configuration.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(configuration).not.toBeVisible();
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

for (const size of sizes.filter(size => size.name === 'small phone' || size.name === 'iPad landscape')) {
  test(`${size.name}: capture and cancel a manual platform batch without overflow`, async ({ page }) => {
    await page.setViewportSize(size);
    const ticket = { id: 'RESPONSIVE-BATCH', ticketType: 'SCRAP_METAL', customerName: 'Mobile Seller', createdAt: new Date().toISOString(), operatorName: 'Responsive Tester', status: 'PENDING', finalPayout: 0, grossTotal: 0, totalDeductions: 0, payoutMethod: 'Cash', selectedWeighingType: 'PLATFORM', scrapLines: [], weightTransactions: [], buying: { version: 1, revision: 1, stage: 'DRAFT' } } as Ticket;
    await mockApi(page, true, ticket);
    await page.goto('/intake');
    await page.getByText('Open scale queue', { exact: true }).click();
    await page.getByRole('button', { name: /Claim This Intake|Switch to This Intake|Continue This Intake/ }).click();
    const manual = page.getByPlaceholder('e.g. 85');
    await expect(manual).toBeEnabled();
    const box = await manual.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(180);
    await noPageOverflow(page);
    await manual.fill('850');
    await page.getByRole('button', { name: 'Capture Manual', exact: true }).click();
    await expect(page.getByText('FINAL NET', { exact: true })).toBeVisible();
    const review = page.locator('#scale-material-review');
    await expect(review.getByRole('button', { name: 'Add Weight · Keep Ticket Open', exact: true })).toBeEnabled();
    await noPageOverflow(page);
    await review.getByRole('button', { name: 'Cancel', exact: true }).click();
    const correction = page.getByRole('alertdialog', { name: 'Record weighing correction' });
    await expect(correction.getByRole('button', { name: 'Confirm audited correction', exact: true })).toBeDisabled();
    await correction.getByLabel('Reason (required)', { exact: true }).fill('Synthetic batch entered for the wrong load');
    await correction.getByRole('button', { name: 'Confirm audited correction', exact: true }).click();
    await expect(correction).not.toBeVisible();
    await expect(manual).toBeVisible();
    await expect(page.getByText('FINAL NET', { exact: true })).not.toBeVisible();
  });
}
