import { test, expect } from '@playwright/test';

for (const cameraType of ['MJPEG', 'SNAPSHOT', 'RTSP_STREAM']) {
  test(`${cameraType} live views use only the main server and recover after a failed feed`, async ({ page }) => {
    const user = { id: 'camera-tester', username: 'camera-tester', fullName: 'Camera Tester', role: 'admin', status: 'approved' };
    const camera = {
      id: 'recovery-camera', name: 'Recovery Camera', ipAddress: '192.168.1.150', port: 8080,
      cameraType, assignment: 'OTHER', isActive: true, createdAt: new Date().toISOString(),
      streamUrl: 'http://192.168.1.150:8080/video?channel=2&token=test-token',
      snapshotUrl: 'http://192.168.1.150:8080/shot.jpg?channel=2&token=test-token',
      rtspUrl: cameraType === 'RTSP_STREAM' ? 'rtsp://192.168.1.150:554/live' : undefined,
    };
    const state = { mahaffeys_ip_cameras: [camera] };
    let attempts = 0;
    const directRequests: string[] = [];
    page.on('request', request => {
      if (new URL(request.url()).hostname === camera.ipAddress) directRequests.push(request.url());
    });
    await page.route('**://192.168.1.150/**', route => route.abort());
    await page.addInitScript(values => {
      for (const [key, value] of Object.entries(values)) localStorage.setItem(key, JSON.stringify(value));
    }, state);
    const imagePath = `/api/cameras/recovery-camera/${cameraType === 'SNAPSHOT' ? 'snapshot' : 'stream'}`;
    // Synthetic responses verify browser routing without contacting real cameras or yard data.
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === imagePath) {
        attempts++;
        expect(url.searchParams.has('channel')).toBe(false);
        expect(url.searchParams.has('token')).toBe(false);
        if (attempts > 1 && attempts <= 3) expect(url.searchParams.has('t')).toBe(true);
        if (attempts < 3) {
          await route.fulfill({ status: 502, body: 'Camera unavailable' });
        } else {
          await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="navy"/></svg>' });
        }
        return;
      }
      let response: unknown = { ok: true };
      if (url.pathname === '/api/auth/status') response = { user, hasAdmin: true };
      else if (url.pathname === '/api/users') response = { users: [user] };
      else if (url.pathname === '/api/state') response = { state };
      else if (url.pathname === '/api/state/since') response = { entries: [], serverTime: new Date().toISOString() };
      else if (url.pathname === '/api/adc/cameras') response = { cameras: [], status: 'NEEDS_LOGIN' };
      else if (url.pathname === '/api/adc/status') response = { status: 'NEEDS_LOGIN' };
      await route.fulfill({ json: response });
    });
    await page.goto('/cameras', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('STREAM RECONNECTING…', { exact: true })).toBeVisible();
    await expect.poll(() => attempts, { timeout: 20_000 }).toBeGreaterThanOrEqual(3);
    const image = page.getByRole('img', { name: 'Recovery Camera', exact: true });
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    await expect(image).toHaveAttribute('src', new RegExp(imagePath));
    await expect(page.getByText('STREAM RECONNECTING…', { exact: true })).toHaveCount(0);
    await page.getByTitle('Fullscreen Stream', { exact: true }).click();
    const fullscreen = page.getByRole('dialog');
    const fullscreenImage = fullscreen.getByRole('img', { name: 'Recovery Camera', exact: true });
    await expect(fullscreenImage).toHaveAttribute('src', new RegExp(imagePath));
    await expect.poll(() => fullscreenImage.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await expect(fullscreen).not.toBeVisible();
    await page.getByRole('button', { name: 'Pause Stream', exact: true }).click();
    await expect(page.getByText('CAMERA STREAM PAUSED', { exact: true })).toBeVisible();
    await expect(image).toHaveCount(0);
    expect(directRequests).toEqual([]);
  });
}
