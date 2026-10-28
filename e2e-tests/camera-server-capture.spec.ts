import { test, expect } from '@playwright/test';

test('Compliance camera captures request a main-server snapshot, not the camera', async ({ page }) => {
  const user = { id: 'camera-operator', fullName: 'Camera Operator', username: 'camera-operator', role: 'scale_operator', status: 'approved' };
  const camera = {
    id: 'capture-camera', name: 'Server Capture Camera', ipAddress: '192.168.1.150', port: 8080,
    cameraType: 'SNAPSHOT', assignment: 'SCALE_DESK', isActive: true, createdAt: new Date().toISOString(),
    streamUrl: 'http://192.168.1.150:8080/shot.jpg', snapshotUrl: 'http://192.168.1.150:8080/shot.jpg',
  };
  const state = { mahaffeys_ip_cameras: [camera], mahaffeys_tickets: [], mahaffeys_settings: { operatorName: user.fullName, scales: [] } };
  const directRequests: string[] = [];
  let snapshots = 0;
  page.on('request', request => {
    if (new URL(request.url()).hostname === camera.ipAddress) directRequests.push(request.url());
  });
  await page.route('**://192.168.1.150/**', route => route.abort());
  await page.addInitScript(values => {
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, JSON.stringify(value));
  }, state);
  // Only synthetic session, state and images; no changes to real yard data.
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let response: unknown = { ok: true };
    if (path === '/api/auth/status') response = { user, hasAdmin: true };
    else if (path === '/api/state') response = { state };
    else if (path === '/api/customers') response = { customers: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
    else if (path === '/api/adc/cameras') response = { status: 'NEEDS_LOGIN', cameras: [] };
    else if (path === '/api/printers') response = [];
    else if (path === '/api/scale/status') response = { connected: false, weight: 0, unit: 'LBS', isStable: false, isZero: true, registry: [] };
    else if (path === '/api/scrap-buying/requirements') response = { revision: 1, requirePhotos: false, requirePhone: false, requireAddress: false, requireSellerId: false, requireVehiclePlate: false, requireExplicitReview: false };
    else if (path === '/api/cameras/capture-camera/snapshot') {
      snapshots++;
      if (snapshots !== 2) {
        await route.fulfill({status:502,json:{statusMessage:'Synthetic camera disconnected'}});
        return;
      }
      await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="blue"/></svg>' });
      return;
    }
    await route.fulfill({ json: response });
  });
  await page.goto('/intake');
  await page.getByText('Start Metal Scrap Ticket', { exact: true }).click();
  await page.getByRole('button', { name: 'Open Photo Compliance Studio', exact: true }).click();
  const studio = page.getByRole('dialog');
  const cameraButton = studio.getByRole('button', { name: 'Server Capture Camera (192.168.1.150)', exact: true });
  await cameraButton.click();
  await expect(studio.getByRole('alert')).toContainText('No photo was added');
  await expect(studio.getByRole('img', { name: 'ID Scan', exact: true })).toHaveCount(0);
  await expect(studio.getByRole('button', { name: 'Device Camera', exact: true })).toBeEnabled();
  await expect(studio.getByRole('button', { name: 'Upload Image File', exact: true })).toBeEnabled();
  await cameraButton.click();
  const image = studio.getByRole('img', { name: 'ID Scan', exact: true });
  await expect(image).toHaveAttribute('src', /^data:image\/jpeg/);
  const original = await image.getAttribute('src');
  await cameraButton.click();
  await expect(studio.getByRole('alert')).toContainText('No photo was added');
  await expect(image).toHaveAttribute('src', original!);
  expect(snapshots).toBe(3);
  await studio.getByRole('tab', { name: 'Seller Face', exact: true }).click();
  await studio.getByRole('button', { name: 'Front Camera', exact: true }).click();
  await expect(studio.locator('input[capture]')).toHaveAttribute('capture','user');
  await studio.getByRole('tab', { name: 'ID Photo', exact: true }).click();
  await studio.getByRole('button', { name: 'Device Camera', exact: true }).click();
  await expect(studio.locator('input[capture]')).toHaveAttribute('capture','environment');
  expect(directRequests).toEqual([]);
});
