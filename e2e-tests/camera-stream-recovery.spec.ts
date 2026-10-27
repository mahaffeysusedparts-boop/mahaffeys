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
    let releaseFirst: () => void = () => {};
    const firstResponse = new Promise<void>(resolve => { releaseFirst = resolve; });
    const jpeg = Buffer.from(await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 90;
      const context = canvas.getContext('2d')!;
      context.fillStyle = 'navy';
      context.fillRect(0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg').split(',')[1];
    }), 'base64');
    const directRequests: string[] = [];
    page.on('request', request => {
      if (new URL(request.url()).hostname === camera.ipAddress) directRequests.push(request.url());
    });
    await page.route('**://192.168.1.150/**', route => route.abort());
    await page.addInitScript(values => {
      for (const [key, value] of Object.entries(values)) localStorage.setItem(key, JSON.stringify(value));
    }, state);
    if (cameraType === 'RTSP_STREAM') {
      await page.addInitScript(() => {
        const originalFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
          const response = await originalFetch(input, init);
          const address = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
          if (new URL(address, location.href).pathname !== '/api/cameras/recovery-camera/stream' || !response.ok || !response.body) return response;
          const reader = response.body.getReader();
          let ended = false;
          let target: ReadableStreamDefaultController<Uint8Array>;
          const cleanup = () => {
            window.removeEventListener('test-rtsp-drop', drop);
            init?.signal?.removeEventListener('abort', abort);
          };
          const drop = () => {
            if (ended) return;
            ended = true;
            cleanup();
            target.close();
          };
          const abort = () => {
            if (ended) return;
            ended = true;
            cleanup();
            target.error(new DOMException('Aborted', 'AbortError'));
          };
          const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
              target = controller;
              window.addEventListener('test-rtsp-drop', drop);
              init?.signal?.addEventListener('abort', abort, { once: true });
              try {
                while (true) {
                  const next = await reader.read();
                  if (next.done || ended) break;
                  controller.enqueue(next.value);
                }
                // Hold the synthetic live connection open until the test simulates a camera drop.
              } catch {
                abort();
              } finally {
                reader.releaseLock();
              }
            },
            cancel() { ended = true; cleanup(); },
          });
          return new Response(stream, { status: response.status, headers: response.headers });
        };
      });
    }
    const imagePath = `/api/cameras/recovery-camera/${cameraType === 'SNAPSHOT' ? 'snapshot' : 'stream'}`;
    // Synthetic responses verify browser routing without contacting real cameras or yard data.
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === imagePath) {
        attempts++;
        expect(url.searchParams.has('channel')).toBe(false);
        expect(url.searchParams.has('token')).toBe(false);
        if (attempts > 1 && attempts <= 3) expect(url.searchParams.has('t')).toBe(true);
        if (attempts === 1) await firstResponse;
        if (attempts < 3) {
          await route.fulfill({ status: 502, body: 'Camera unavailable' });
        } else if (cameraType === 'SNAPSHOT') {
          await route.fulfill({ contentType: 'image/jpeg', body: jpeg });
        } else {
          await route.fulfill({
            contentType: 'multipart/x-mixed-replace; boundary=mahaffeys-frame',
            body: Buffer.concat([
              Buffer.from(`--mahaffeys-frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpeg.length}\r\n\r\n`),
              jpeg,
              Buffer.from('\r\n--mahaffeys-frame--\r\n'),
            ]),
          });
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
    await expect(page.getByText('WAITING FOR LIVE FRAME…', { exact: true })).toBeVisible();
    releaseFirst();
    await expect(page.getByText('STREAM RECONNECTING…', { exact: true })).toBeVisible();
    await expect.poll(() => attempts, { timeout: 20_000 }).toBeGreaterThanOrEqual(3);
    const image = page.getByRole('img', { name: 'Recovery Camera', exact: true });
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    const displayedSource = cameraType === 'RTSP_STREAM' ? /^blob:/ : new RegExp(imagePath);
    await expect(image).toHaveAttribute('src', displayedSource);
    await expect(page.getByText('STREAM RECONNECTING…', { exact: true })).toHaveCount(0);
    if (cameraType === 'RTSP_STREAM') {
      await page.evaluate(() => window.dispatchEvent(new Event('test-rtsp-drop')));
      await expect(page.getByText('STREAM RECONNECTING…', { exact: true })).toBeVisible();
      await expect.poll(() => attempts, { timeout: 15_000 }).toBeGreaterThanOrEqual(4);
      await expect(page.getByText('STREAM RECONNECTING…', { exact: true })).toHaveCount(0);
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    }
    await page.getByTitle('Fullscreen Stream', { exact: true }).click();
    const fullscreen = page.getByRole('dialog');
    const fullscreenImage = fullscreen.getByRole('img', { name: 'Recovery Camera', exact: true });
    await expect(fullscreenImage).toHaveAttribute('src', displayedSource);
    await expect.poll(() => fullscreenImage.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await expect(fullscreen).not.toBeVisible();
    await page.getByRole('button', { name: 'Pause Stream', exact: true }).click();
    await expect(page.getByText('CAMERA STREAM PAUSED', { exact: true })).toBeVisible();
    await expect(image).toHaveCount(0);
    expect(directRequests).toEqual([]);
  });
}
