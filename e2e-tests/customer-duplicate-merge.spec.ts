import { test, expect } from '@playwright/test';

test('Review possible duplicate sellers and merge selected profiles', async ({ page }) => {
  const user = { id: 'merge-admin', fullName: 'Merge Admin', username: 'merge-admin', role: 'admin', status: 'approved' };
  const profile = (id: string, fullName: string, phone: string, idNumber: string) => ({
    id, fullName, phone, idType: 'Driver License', idNumber, idState: 'SC', address: '',
    createdAt: '2026-01-01T00:00:00.000Z', totalPayouts: 0, totalWeightLbs: 0, isCommercial: false,
  });
  const first = profile('seller-1', 'Jamie Seller', '5551234567', 'DL-1');
  const second = profile('seller-2', 'Jamie Seller', '5551234567', 'DL-1');
  let mergedIds: string[] = [];

  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let response: unknown = { ok: true };
    if (path === '/api/auth/status') response = { user, hasAdmin: true };
    else if (path === '/api/users') response = { users: [user] };
    else if (path === '/api/state') response = { state: {} };
    else if (path === '/api/state/since') response = { entries: [], serverTime: new Date().toISOString(), count: 0 };
    else if (path === '/api/health') response = { ok: true, serverTime: new Date().toISOString() };
    else if (path === '/api/customers/duplicates') response = [{ customers: [first, second], reasons: ['Same ID number', 'Same phone number', 'Similar name'], suggestedKeepId: 'seller-1' }];
    else if (path === '/api/customers' && route.request().method() === 'GET') response = { customers: [first, second], page: 1, pageSize: 25, total: 2, totalPages: 1 };
    else if (path === '/api/customers/merge' && route.request().method() === 'POST') {
      mergedIds = route.request().postDataJSON().customerIds;
      response = { ...first, fullName: 'Jamie Seller' };
    }
    await route.fulfill({ json: response });
  });

  await page.goto('/customers');
  await expect(page.getByTestId('customer-duplicates-panel')).toBeVisible();
  await page.getByLabel(/Jamie Seller/).first().check();
  await page.getByLabel(/Jamie Seller/).nth(1).check();
  await page.getByTestId('merge-customers-button').click();
  await expect(page.getByText('Merged duplicate profiles into Jamie Seller', { exact: true })).toBeVisible();
  expect(mergedIds).toEqual(['seller-1', 'seller-2']);
});
