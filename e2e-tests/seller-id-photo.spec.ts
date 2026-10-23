import { test, expect } from '@playwright/test';
import { evaluateBuyingPaymentRules } from '../src/utils/buyingPaymentRules';

// Synthetic sellers, uploads and print-independent intake APIs never touch yard data.
for (const savedPhoto of [true, false]) {
  test(savedPhoto ? 'Returning seller ID survives opening and saving the photo studio' : 'A captured ID is saved to the seller profile and reused on the next intake', async ({ page }) => {
    const user = { id: 'photo-operator', fullName: 'Photo Operator', username: 'photo-operator', role: 'scale_operator', status: 'approved' };
    let customer = { id: 'photo-seller', fullName: 'ID Photo Seller', phone: '5551234567', idType: 'Driver License', idNumber: 'PHOTO-123', idState: 'SC', address: '123 Test Road', isCommercial: false, idPhotoUrl: savedPhoto ? '/api/uploads/seller-id' : undefined };
    let savedTicket: any = null;
    let updatedPhoto = '';
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let response: unknown = { ok: true };
      if (path === '/api/auth/status') response = { user, hasAdmin: true };
      else if (path === '/api/state') response = { state: { mahaffeys_tickets: savedTicket ? [savedTicket] : [], mahaffeys_settings: { operatorName: user.fullName, scales: [] } } };
      else if (path === '/api/customers') response = { customers: [customer], page: 1, pageSize: 20, total: 1, totalPages: 1 };
      else if (path === '/api/customers/photo-seller' && route.request().method() === 'PATCH') {
        const input = route.request().postDataJSON();
        updatedPhoto = input.idPhotoUrl;
        customer = { ...customer, ...input };
        response = customer;
      } else if (path === '/api/uploads' && route.request().method() === 'POST') response = { id: 'seller-id', url: '/api/uploads/seller-id' };
      else if (path === '/api/uploads/seller-id') {
        await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#2563eb"/></svg>' });
        return;
      } else if (path === '/api/adc/cameras') response = { status: 'NEEDS_LOGIN', cameras: [] };
      else if (path === '/api/printers') response = [];
      else if (path === '/api/scale/status') response = { connected: false, weight: 0, unit: 'LBS', isStable: false, isZero: true, registry: [] };
      else if (path === '/api/scrap-buying/requirements') response = { revision: 1, requirePhotos: false, requirePhone: false, requireAddress: false, requireSellerId: false, requireVehiclePlate: false, requireExplicitReview: false };
      else if (path === '/api/scrap-buying/queue') response = { tickets: savedTicket ? [savedTicket] : [], policy: null, legacyReviews: [] };
      else if (path === '/api/scrap-buying/eligibility') response = evaluateBuyingPaymentRules(savedTicket);
      else if (path === '/api/scrap-buying/commands') {
        const command = route.request().postDataJSON();
        if (command.action === 'ADOPT') {
          await route.fulfill({ json: savedTicket });
          return;
        }
        expect(command.action).toBe('CREATE');
        savedTicket = { ...command.ticket, buying: { version: 1, revision: 1, stage: 'DRAFT' } };
        response = savedTicket;
      }
      await route.fulfill({ json: response });
    });
    await page.goto('/intake');
    await page.getByText('Start Metal Scrap Ticket', { exact: true }).click();
    await page.getByRole('combobox', { name: 'Find Registered Customer', exact: true }).click();
    await page.getByRole('option', { name: /ID Photo Seller/ }).click();
    if (savedPhoto) await expect(page.getByRole('img', { name: 'ID / License', exact: true })).toHaveAttribute('src', '/api/uploads/seller-id');
    await page.getByRole('button', { name: 'Open Photo Compliance Studio', exact: true }).click();
    const studio = page.getByRole('dialog');
    if (!savedPhoto) {
      await studio.getByRole('button', { name: 'Upload Image File', exact: true }).click();
      await studio.getByTestId('compliance-photo-upload').setInputFiles({ name: 'seller-id.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#2563eb"/></svg>') });
    }
    await expect(studio.getByRole('img', { name: 'ID Scan', exact: true })).toBeVisible();
    await studio.getByRole('button', { name: 'Save Suite & Transfer to Intake', exact: true }).click();
    await expect(studio).not.toBeVisible();
    await expect(page.getByRole('img', { name: 'ID / License', exact: true })).toHaveAttribute('src', '/api/uploads/seller-id');
    await page.getByRole('button', { name: 'Save Intake & Continue to Scale', exact: true }).click();
    await expect(page.getByText('Customer profile updated', { exact: true })).toBeVisible();
    await expect.poll(() => savedTicket?.complianceCaptures?.idPhotoUrl).toBe('/api/uploads/seller-id');
    expect(savedTicket.customerId).toBe(customer.id);
    expect(updatedPhoto).toBe('/api/uploads/seller-id');
    await page.getByRole('button', { name: 'New Intake (Part 1)', exact: true }).click();
    await page.getByRole('combobox', { name: 'Find Registered Customer', exact: true }).click();
    await page.getByRole('option', { name: /ID Photo Seller/ }).click();
    await expect(page.getByRole('img', { name: 'ID / License', exact: true })).toHaveAttribute('src', '/api/uploads/seller-id');
  });
}

test('Switching car sellers clears the previous seller ID and photo', async ({ page }) => {
  const user = { id: 'car-photo-test', fullName: 'Car Photo Operator', role: 'admin', status: 'approved' };
  const customers = [
    { id: 'first-seller', fullName: 'First Seller', idNumber: 'FIRST-ID', idState: 'SC', phone: '111', address: 'First address', idPhotoUrl: '/api/uploads/first-id' },
    { id: 'second-seller', fullName: 'Second Seller', idNumber: 'SECOND-ID', idState: 'SC', phone: '222', address: 'Second address' },
  ];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let response: unknown = { ok: true };
    if (path === '/api/auth/status') response = { user, hasAdmin: true };
    else if (path === '/api/users') response = { users: [user] };
    else if (path === '/api/state') response = { state: { mahaffeys_tickets: [] } };
    else if (path === '/api/customers') response = { customers, page: 1, pageSize: 20, total: 2, totalPages: 1 };
    else if (path === '/api/printers') response = [];
    else if (path === '/api/uploads/first-id') {
      await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="blue"/></svg>' });
      return;
    }
    await route.fulfill({ json: response });
  });
  await page.goto('/intake');
  await page.getByText('Start Junk Car Intake', { exact: true }).click();
  const sellers = page.getByRole('combobox', { name: 'Find Returning Seller', exact: true });
  await sellers.click();
  await page.getByRole('option', { name: /First Seller/ }).click();
  await expect(page.getByRole('img', { name: 'Seller ID', exact: true })).toBeVisible();
  await sellers.click();
  await page.getByRole('option', { name: /Second Seller/ }).click();
  await expect(page.getByRole('img', { name: 'Seller ID', exact: true })).toHaveCount(0);
  await expect(page.getByPlaceholder('e.g. DL-9823145-GA', { exact: true })).toHaveValue('SECOND-ID');
  await expect(page.getByPlaceholder('(555) 555-0123', { exact: true })).toHaveValue('222');
});
