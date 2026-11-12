import { test, expect, type Page } from '@playwright/test';
import type { NotificationRule } from '../src/types/notifications';

async function phoneFixture(page: Page, role = 'admin') {
  // Fully synthetic browser push and API: never register a real phone or send yard alerts.
  await page.addInitScript(() => {
    let enabled = false;
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/synthetic',
      toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/synthetic', keys: { p256dh: 'synthetic', auth: 'synthetic' } }),
      unsubscribe: async () => { enabled = false; return true; },
    };
    const registration = { pushManager: {
      getSubscription: async () => enabled ? subscription : null,
      subscribe: async () => { enabled = true; return subscription; },
    } };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {
      getRegistration: async () => registration,
      register: async () => registration,
      ready: Promise.resolve(registration),
    } });
    Object.defineProperty(window, 'PushManager', { configurable: true, value: function () {} });
    Object.defineProperty(window, 'Notification', { configurable: true, value: { permission: 'granted', requestPermission: async () => 'granted' } });
  });
  const user = { id: 'owner', fullName: 'Yard Owner', username: 'owner', role, status: 'approved' };
  const users = [user, { id: 'operator', fullName: 'Scale Operator', role: 'scale_operator' }];
  let rules: NotificationRule[] = [];
  let deviceCount = 0;
  let tests = 0;
  let settingsRequests = 0;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    let response: unknown = { ok: true };
    if (path === '/api/auth/status') response = { user, hasAdmin: true };
    else if (path === '/api/users') response = { users };
    else if (path === '/api/state') response = { state: { mahaffeys_settings: { yardName: 'Test Yard', scales: [] }, mahaffeys_tickets: [], mahaffeys_metals: [] } };
    else if (path === '/api/scale/status') response = { connected: false, weight: 0, unit: 'LBS', registry: [] };
    else if (path === '/api/notifications/settings') {
      settingsRequests++;
      if (method === 'PUT') rules = route.request().postDataJSON().rules;
      else response = { rules, users };
    } else if (path === '/api/notifications/status') response = { publicKey: 'AQIDBA', deviceCount, receiving: rules.some(rule => rule.recipientIds.includes(user.id)), localPreview: false };
    else if (path === '/api/notifications/devices') {
      if (method === 'POST') { expect(route.request().postDataJSON().endpoint).toContain('/synthetic'); deviceCount = 1; }
      else if (method === 'DELETE') deviceCount = 0;
    } else if (path === '/api/notifications/test') { tests++; response = { accepted: 1, failed: 0, localPreview: false }; }
    await route.fulfill({ json: response });
  });
  return { rules: () => rules, tests: () => tests, settingsRequests: () => settingsRequests };
}

test('Administrator chooses actions, recipients and monitored operators, then enables and tests a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await phoneFixture(page);
  await page.goto('/settings?section=notifications');
  const rules = page.getByRole('region', { name: 'Operator alert rules', exact: true });
  await rules.getByRole('switch', { name: 'Notify when purchase payment recorded', exact: true }).check();
  await rules.getByRole('checkbox', { name: 'Send purchase payment recorded to Yard Owner', exact: true }).check();
  await rules.getByRole('checkbox', { name: 'Monitor Scale Operator for purchase payment recorded', exact: true }).check();
  await rules.getByRole('button', { name: 'Save notification rules', exact: true }).click();
  await expect(page.getByText('Phone notification rules saved', { exact: true })).toBeVisible();
  expect(fixture.rules()).toEqual([{ action: 'purchase.paid', recipientIds: ['owner'], operatorIds: ['operator'] }]);
  await page.reload();
  await expect(rules.getByRole('checkbox', { name: 'Send purchase payment recorded to Yard Owner', exact: true })).toBeChecked();
  await expect(rules.getByRole('checkbox', { name: 'Monitor Scale Operator for purchase payment recorded', exact: true })).toBeChecked();
  const phone = page.getByRole('region', { name: 'This phone', exact: true });
  await phone.getByRole('button', { name: 'Enable on this phone', exact: true }).click();
  await expect(phone.getByText('Browser push subscription enabled · 1 device(s) registered to your account', { exact: true })).toBeVisible();
  await phone.getByRole('button', { name: 'Send test notification', exact: true }).click();
  await expect(page.getByText('Push service accepted the test for 1 device(s). Check your phone.', { exact: true })).toBeVisible();
  expect(fixture.tests()).toBe(1);
  await phone.getByRole('button', { name: 'Disable on this phone', exact: true }).click();
  await expect(phone.getByText('Not enabled on this device · 0 device(s) registered to your account', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});

test('Operator can manage their own phone without access to administrator alert rules', async ({ page }) => {
  const fixture = await phoneFixture(page, 'scale_operator');
  await page.goto('/settings?section=notifications');
  await expect(page.getByRole('region', { name: 'This phone', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Operator alert rules', exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Settings sections' }).getByRole('link', { name: 'Phone notifications', exact: true })).toBeVisible();
  await expect(page.getByText('Only administrators can change alert actions, monitored operators and recipients. You can manage your own phone above.', { exact: true })).toBeVisible();
  expect(fixture.settingsRequests()).toBe(0);
});
