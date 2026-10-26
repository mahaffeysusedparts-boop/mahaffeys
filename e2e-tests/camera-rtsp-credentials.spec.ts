import { test, expect } from '@playwright/test';

test('RTSP camera credentials are sent for testing and preserved when saved', async ({ page }) => {
  const user = { id: 'credential-tester', username: 'credential-tester', fullName: 'Credential Tester', role: 'admin', status: 'approved' };
  const rtspUrl = 'rtsp://192.168.1.152:554/Streaming/Channels/101?transportmode=unicast&profile=Profile_1';
  const password = ' fake-test-p@ss:& word ';
  let probe: Record<string, unknown> | undefined;
  const state = { mahaffeys_ip_cameras: [] };
  await page.addInitScript(values => {
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, JSON.stringify(value));
  }, state);
  // Fake credentials and intercepted requests never contact a camera or alter real server data.
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    let response: unknown = { ok: true };
    if (url.pathname === '/api/auth/status') response = { user, hasAdmin: true };
    else if (url.pathname === '/api/users') response = { users: [user] };
    else if (url.pathname === '/api/state') response = { state };
    else if (url.pathname === '/api/state/since') response = { entries: [], serverTime: new Date().toISOString() };
    else if (url.pathname === '/api/adc/cameras') response = { cameras: [], status: 'NEEDS_LOGIN' };
    else if (url.pathname === '/api/adc/status') response = { status: 'NEEDS_LOGIN' };
    else if (url.pathname === '/api/cameras/probe') {
      probe = route.request().postDataJSON();
      response = { ok: true, frameBytes: 1000 };
    } else if (url.pathname === '/api/state/mahaffeys_ip_cameras' && route.request().method() === 'PUT') {
      response = { ok: true, updatedAt: new Date().toISOString(), value: route.request().postDataJSON().value };
    }
    await route.fulfill({ json: response });
  });
  await page.goto('/cameras', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Add IP Camera', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('e.g. Scale License Plate OCR Cam', { exact: true }).fill('Authenticated Camera');
  await dialog.getByPlaceholder('192.168.1.150', { exact: true }).fill('192.168.1.152');
  await dialog.getByRole('combobox').filter({ has: page.getByRole('option', { name: 'RTSP Network Stream', exact: true }) }).selectOption('RTSP_STREAM');
  await dialog.getByRole('radio', { name: 'Custom RTSP URL', exact: true }).check();
  await dialog.getByPlaceholder('rtsp://192.168.1.150:554/rtsp/live/ch00_0', { exact: true }).fill(rtspUrl);
  await dialog.getByLabel('Camera Username', { exact: true }).fill('camera-viewer');
  await dialog.getByLabel('Camera Password', { exact: true }).fill(password);
  await expect(dialog.getByLabel('Camera Password', { exact: true })).toHaveAttribute('type', 'password');
  await dialog.getByRole('button', { name: 'Test RTSP Connection', exact: true }).click();
  await expect.poll(() => probe).toEqual({ rtspUrl, username: 'camera-viewer', password });
  await expect(page.getByText('RTSP connection OK — grabbed a test frame from 192.168.1.152', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Save Camera', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const cameras = JSON.parse(localStorage.getItem('mahaffeys_ip_cameras') || '[]');
    const camera = cameras.find((item: { name: string }) => item.name === 'Authenticated Camera');
    return camera && { rtspUrl: camera.rtspUrl, username: camera.username, password: camera.password };
  })).toEqual({ rtspUrl, username: 'camera-viewer', password });
});
