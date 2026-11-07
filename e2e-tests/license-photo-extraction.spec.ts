import { test, expect } from '@playwright/test';
import { ownershipFixture, queueEnvelope } from './fixtures/intake-api';
import { mockLicenseOcr, syntheticIdImage, syntheticLicenseText } from './fixtures/license-ocr';

for (const scenario of ['readable', 'partial', 'unreadable'] as const) {
  test(`Uploaded ${scenario} license supports reviewed or manual seller details`, async ({ page }) => {
    test.setTimeout(90000);
    await mockLicenseOcr(page, scenario === 'readable' ? syntheticLicenseText : scenario === 'partial' ? 'DL D12345678\nNAME JOHN DOE' : '', scenario === 'unreadable' ? 0 : 95);
    const user = { id: 'license-operator', fullName: 'License Operator', username: 'license-operator', role: 'scale_operator', status: 'approved' };
    const ownership = ownershipFixture(user);
    let savedCommand: any;
    await page.route('**/api/**', async route => {
      if (await ownership(route)) return;
      const path = new URL(route.request().url()).pathname;
      let response: unknown = { ok: true };
      if (path === '/api/auth/status') response = { user, hasAdmin: true };
      else if (path === '/api/state') response = { state: { mahaffeys_tickets: [], mahaffeys_settings: { operatorName: user.fullName, scales: [] } } };
      else if (path === '/api/state/since') response = { entries: [], serverTime: new Date().toISOString(), count: 0 };
      else if (path === '/api/printers') response = [];
      else if (path === '/api/adc/cameras') response = { status: 'NEEDS_LOGIN', cameras: [] };
      else if (path === '/api/uploads') response = { id: 'license-photo', url: '/api/uploads/license-photo' };
      else if (path === '/api/uploads/license-photo') { await route.fulfill({ contentType: 'image/svg+xml', body: syntheticIdImage.buffer.toString() }); return; }
      else if (path === '/api/scale/status') response = { connected: false, weight: 0, unit: 'LBS', isStable: false, isZero: true, registry: [] };
      else if (path === '/api/scrap-buying/requirements') response = { revision: 1, requirePhotos: false, requirePhone: false, requireAddress: false, requireSellerId: false, requireVehiclePlate: false, requireExplicitReview: false };
      else if (path === '/api/scrap-buying/queue') response = queueEnvelope([]);
      else if (path === '/api/scrap-buying/commands') {
        const command = route.request().postDataJSON();
        if (command.action === 'CREATE') savedCommand = command;
        response = { ...savedCommand.ticket, customerId: 'license-seller', buying: { version: 1, revision: 1, stage: 'DRAFT' } };
      }
      await route.fulfill({ json: response });
    });
    await page.goto('/intake');
    await page.getByRole('region', { name: 'Intake home', exact: true }).getByRole('button', { name: /^New scrap load / }).click();
    await page.getByPlaceholder('e.g. Marcus Vance', { exact: true }).fill('Original Seller');
    await page.getByRole('button', { name: 'Open Photo Compliance Studio', exact: true }).click();
    const studio = page.getByRole('dialog');
    await studio.getByRole('button', { name: 'Upload Image File', exact: true }).click();
    await studio.getByTestId('compliance-photo-upload').setInputFiles(syntheticIdImage);
    const reader = studio.getByTestId('license-photo-reader');
    if (scenario === 'readable') {
      await expect(reader.getByText('ID data extracted. Check every field before using it.', { exact: true })).toBeVisible();
      await expect(reader.getByLabel('ID full name', { exact: true })).toHaveValue('JOHN DOE');
      await expect(reader.getByLabel('ID number from photo', { exact: true })).toHaveValue('D12345678');
      await expect(reader.getByLabel('ID issuing state', { exact: true })).toHaveValue('GA');
      await expect(reader.getByLabel('ID address', { exact: true })).toHaveValue('123 MAIN ST, ATLANTA GA 30301');
    } else {
      await expect(reader.getByRole('alert')).toContainText(scenario === 'partial' ? 'Some ID fields could not be read' : 'ID photo could not be read');
      await reader.getByLabel('ID full name', { exact: true }).fill('Manual Seller');
      await reader.getByLabel('ID number from photo', { exact: true }).fill('MANUAL12345');
      await reader.getByLabel('ID issuing state', { exact: true }).fill('SC');
      await reader.getByLabel('ID address', { exact: true }).fill('42 Oak Road, Columbia SC 29201');
    }
    // OCR proposals never silently overwrite information the operator already typed.
    await expect(page.getByPlaceholder('e.g. Marcus Vance', { exact: true })).toHaveValue('Original Seller');
    await reader.getByRole('button', { name: 'Use these ID details', exact: true }).click();
    await studio.getByRole('button', { name: 'Save Suite & Transfer to Intake', exact: true }).click();
    await expect(studio).not.toBeVisible();
    await expect(page.getByPlaceholder('e.g. Marcus Vance', { exact: true })).toHaveValue(scenario === 'readable' ? 'JOHN DOE' : 'Manual Seller');
    await page.getByRole('button', { name: 'Save Intake & Continue to Scale', exact: true }).click();
    await expect.poll(() => savedCommand?.sellerProfile?.input?.idNumber).toBe(scenario === 'readable' ? 'D12345678' : 'MANUAL12345');
    expect(savedCommand.sellerProfile.input.idState).toBe(scenario === 'readable' ? 'GA' : 'SC');
    expect(savedCommand.ticket.complianceCaptures.idPhotoUrl).toBe('/api/uploads/license-photo');
    expect(savedCommand.ticket.complianceCaptures.idReadStatus).toBe(scenario === 'readable' ? 'REVIEWED' : 'MANUAL');
    if (scenario !== 'readable') expect(savedCommand.ticket.complianceCaptures.idReadWarning).toContain('manually');
  });
}

test('Vehicle intake reads an uploaded license and transfers approved ID fields', async ({ page }) => {
  test.setTimeout(90000);
  await mockLicenseOcr(page, syntheticLicenseText, 95);
  const user = { id: 'car-license-operator', fullName: 'Car License Operator', role: 'admin', status: 'approved' };
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let response: unknown = { ok: true };
    if (path === '/api/auth/status') response = { user, hasAdmin: true };
    else if (path === '/api/users') response = { users: [user] };
    else if (path === '/api/state') response = { state: { mahaffeys_tickets: [] } };
    else if (path === '/api/printers') response = [];
    else if (path === '/api/uploads') response = { id: 'car-license', url: '/api/uploads/car-license' };
    else if (path === '/api/uploads/car-license') { await route.fulfill({ contentType: 'image/svg+xml', body: syntheticIdImage.buffer.toString() }); return; }
    await route.fulfill({ json: response });
  });
  await page.goto('/intake');
  await page.getByRole('region', { name: 'Intake home', exact: true }).getByRole('button', { name: /^New vehicle / }).click();
  await page.getByTestId('car-seller-id-upload').setInputFiles(syntheticIdImage);
  const reader = page.getByTestId('license-photo-reader');
  await expect(reader.getByLabel('ID full name', { exact: true })).toHaveValue('JOHN DOE');
  await reader.getByRole('button', { name: 'Use these ID details', exact: true }).click();
  await expect(page.getByPlaceholder('e.g. Marcus Vance / Vance Repair Shop')).toHaveValue('JOHN DOE');
  await expect(page.getByPlaceholder('e.g. DL-9823145-GA')).toHaveValue('D12345678');
  await expect(page.getByPlaceholder('State shown on the ID', { exact: true })).toHaveValue('GA');
  await expect(page.getByPlaceholder('Street, city, state, ZIP')).toHaveValue('123 MAIN ST, ATLANTA GA 30301');
});
