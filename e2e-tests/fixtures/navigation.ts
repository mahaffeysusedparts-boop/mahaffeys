import { expect, type Page } from '@playwright/test';
import { queueEnvelope } from './intake-api';

export async function mockApi(page: Page, authenticated: boolean) {
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

export async function noPageOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

