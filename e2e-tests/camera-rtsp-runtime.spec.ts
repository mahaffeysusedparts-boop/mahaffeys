import { test, expect } from '@playwright/test';

test('RTSP server routes load successfully and require authentication', async ({ playwright, baseURL }) => {
  const request = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  try {
    // Real routes, no session and no camera connection: module-loader failures return 500 instead of 401.
    const stream = await request.get('/api/cameras/runtime-check/stream');
    const snapshot = await request.get('/api/cameras/runtime-check/snapshot');
    const probe = await request.post('/api/cameras/probe', { data: { rtspUrl: 'rtsp://192.168.1.150:554/live' } });
    expect(stream.status()).toBe(401);
    expect(snapshot.status()).toBe(401);
    expect(probe.status()).toBe(401);
  } finally {
    await request.dispose();
  }
});
