import { test, expect } from '@playwright/test';

test('Saving a scrap intake without an ID creates a customer profile', async ({ page }) => {
  const user = { id: 'seller-profile-test', fullName: 'Profile Tester', username: 'profile-tester', role: 'scale_operator', status: 'approved' };
  const customerRows: Record<string, unknown>[] = [];
  let savedTicket: Record<string, any> | null = null;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let response: unknown = { ok: true };
    if (path === '/api/auth/status') response = { user, hasAdmin: true };
    else if (path === '/api/state') response = { state: { mahaffeys_tickets: [], mahaffeys_settings: { operatorName: user.fullName, scales: [] } } };
    else if (path === '/api/customers' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      const customer = { ...body, id: 'new-profile-1' };
      customerRows.push(customer);
      response = customer;
    } else if (path === '/api/printers') response = [];
    else if (path === '/api/adc/cameras') response = { status: 'NEEDS_LOGIN', cameras: [] };
    else if (path === '/api/scale/status') response = { connected: false, weight: 0, unit: 'LBS', isStable: false, isZero: true, registry: [] };
    else if (path === '/api/scrap-buying/requirements') response = { revision: 1, requirePhotos: false, requirePhone: false, requireAddress: false, requireSellerId: false, requireVehiclePlate: false, requireExplicitReview: false };
    else if (path === '/api/scrap-buying/queue') response = { tickets: [], policy: null, legacyReviews: [] };
    else if (path === '/api/scrap-buying/commands') {
      const command = route.request().postDataJSON();
      if (command.action === 'CREATE') {
        savedTicket = { ...command.ticket, buying: { version: 1, revision: 1, stage: 'DRAFT' } };
        response = savedTicket;
      } else if (command.action === 'ADOPT') {
        response = savedTicket;
      }
    }
    await route.fulfill({ json: response });
  });

  await page.goto('/intake');
  await page.getByText('Start Metal Scrap Ticket', { exact: true }).click();
  await page.getByPlaceholder('e.g. Marcus Vance').fill('Jamie No-ID Seller');
  await page.getByPlaceholder('(555) 000-0000').fill('5559876543');
  await page.getByRole('button', { name: 'Save Intake & Continue to Scale', exact: true }).click();

  await expect(page.getByText('Customer profile updated', { exact: true })).not.toBeVisible();
  await expect(page.getByText('New customer profile created', { exact: true })).toBeVisible();
  await expect.poll(() => customerRows.length).toBe(1);
  expect(customerRows[0]).toMatchObject({ fullName: 'Jamie No-ID Seller', phone: '5559876543', idNumber: '' });
  await expect.poll(() => savedTicket?.customerId).toBe('new-profile-1');
  expect(savedTicket.customerIdNumber).toBeUndefined();
});
