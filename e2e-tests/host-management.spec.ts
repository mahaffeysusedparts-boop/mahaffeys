import { test, expect, type Page } from '@playwright/test';

async function mockServer(page: Page, connected = true) {
  const user = { id: 'host-admin', username: 'host-admin', fullName: 'Host Administrator', role: 'admin', status: 'approved' };
  const calls: Record<string, unknown>[] = [];
  const jobs = new Map<string, { jobId: string; action: string; status: string; steps: { at: string; message: string }[] }>();
  let sequence = 0;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    let response: unknown = { ok: true };
    if (path === '/api/auth/status') response = { user, hasAdmin: true };
    else if (path === '/api/users') response = { users: [user] };
    else if (path === '/api/printers') response = [];
    else if (path === '/api/state') response = { state: { mahaffeys_tickets: [], mahaffeys_shipments: [], mahaffeys_metals: [], mahaffeys_scale_events: [], mahaffeys_settings: { yardName: 'Synthetic Yard', scales: [] } } };
    else if (path === '/api/scale/status') response = { connected: false, weight: 0, unit: 'LBS', isStable: false, isZero: true, registry: [] };
    else if (path === '/api/scrap-buying/requirements') response = { revision: 1, requirePhotos: false, requirePhone: false, requireAddress: false, requireSellerId: false, requireVehiclePlate: false, requireExplicitReview: false };
    else if (path === '/api/admin/server') response = { service: { name: 'mahaffeys', status: 'online', manager: 'Docker', pid: 1, processUptimeSeconds: 200, nodeVersion: 'v22', environment: 'production' }, host: { hostname: 'test-host', uptimeSeconds: 300, cpuCount: 4, loadAverage: [0, 0, 0], memoryTotal: 8000000000, memoryUsed: 2000000000, diskTotal: 250000000000, diskUsed: 100000000000 }, logs: { available: false, output: [], errors: [] }, checkedAt: new Date().toISOString() };
    else if (path === '/api/admin/backups') response = { backups: [], dir: '/private/backups', retention: 30 };
    else if (path === '/api/admin/audit') response = { entries: [], page: 1, pageSize: 50, total: 0, totalPages: 1 };
    else if (path === '/api/admin/server/control' && method === 'GET') response = connected ? { available: true, diagnostics: ['network', 'containers', 'version', 'storage', 'cups', 'printer'], management: ['restart', 'prepare', 'status', 'deploy', 'rollback'] } : { available: false, reason: 'Administrator installation is required. Local previews never control the live host.' };
    else if ((path === '/api/admin/server/control' || path === '/api/admin/server/restart') && method === 'POST') {
      const input = route.request().postDataJSON();
      const action = path.endsWith('/restart') ? 'restart' : input.action;
      calls.push({ ...input, action });
      if (action === 'diagnostics') response = { output: 'Ubuntu host network: eno1 UP — 192.168.1.210/24; gateway 192.168.1.1', report: 'network' };
      else if (action === 'status') response = jobs.get(input.jobId);
      else {
        const jobId = (++sequence).toString(16).padStart(32, '0');
        jobs.set(jobId, { jobId, action, status: 'succeeded', steps: [{ at: new Date().toISOString(), message: action === 'restart' ? 'App container is healthy after restart.' : 'Guarded operation succeeded.' }] });
        response = { jobId, action, status: 'queued' };
      }
    } else if (path.startsWith('/api/admin/')) {
      await route.fulfill({ status: 503, json: { statusMessage: 'Unrelated hardware unavailable in this synthetic UI test' } }); return;
    }
    await route.fulfill({ json: response });
  });
  return calls;
}

async function approve(page: Page, text: string) {
  const dialog = page.getByRole('alertdialog');
  const confirm = dialog.getByRole('button', { name: 'Confirm action', exact: true });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(`Type ${text} to approve`).fill(text);
  await confirm.click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId('host-job-status')).toHaveText('succeeded');
}

test('Administrator inspects network settings and confirms an app-only restart', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const calls = await mockServer(page);
  await page.goto('/settings?section=server');
  const panel = page.getByRole('region', { name: 'Guarded host management' });
  await expect(panel.getByText('Host connected', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Run diagnostics', exact: true }).click();
  await expect(page.getByTestId('host-diagnostic-report')).toContainText('eno1 UP');
  await panel.getByRole('button', { name: 'Restart app', exact: true }).click();
  expect(calls.some(call => call.action === 'restart')).toBe(false);
  await approve(page, 'RESTART APP');
  await expect(panel.getByText('App container is healthy after restart.', { exact: true })).toBeVisible();
  expect(calls.filter(call => call.action === 'restart')).toEqual([{ action: 'restart', confirmation: 'RESTART APP' }]);
  await expect(panel.getByRole('link', { name: 'Manage app settings' })).toHaveAttribute('href', '/settings?section=general');
  expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test('Administrator verifies a revision before deploying and can roll back its job', async ({ page }) => {
  const calls = await mockServer(page);
  await page.goto('/settings?section=server');
  const panel = page.getByRole('region', { name: 'Guarded host management' });
  await expect(panel.getByText('Host connected', { exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Deploy verified plan', exact: true })).toBeDisabled();
  await panel.getByLabel('Exact Git commit').fill('a'.repeat(40));
  await panel.getByRole('button', { name: 'Verify revision', exact: true }).click();
  await approve(page, 'RUN VERIFIED TESTS');
  const preparation = '1'.padStart(32, '0');
  await expect(panel.getByLabel('Verified preparation job ID')).toHaveValue(preparation);
  await panel.getByRole('button', { name: 'Deploy verified plan', exact: true }).click();
  await approve(page, 'DEPLOY APPROVED PLAN');
  await panel.getByRole('button', { name: 'Roll back deployment', exact: true }).click();
  await approve(page, 'ROLLBACK DEPLOYMENT');
  expect(calls.filter(call => ['prepare', 'deploy', 'rollback'].includes(String(call.action)))).toEqual([
    { action: 'prepare', revision: 'a'.repeat(40), confirmation: 'RUN VERIFIED TESTS' },
    { action: 'deploy', jobId: preparation, confirmation: 'DEPLOY APPROVED PLAN' },
    { action: 'rollback', jobId: '2'.padStart(32, '0'), confirmation: 'ROLLBACK DEPLOYMENT' },
  ]);
});

test('Unavailable host connector disables live actions while keeping existing admin settings accessible', async ({ page }) => {
  const calls = await mockServer(page, false);
  await page.goto('/settings?section=server');
  const panel = page.getByRole('region', { name: 'Guarded host management' });
  await expect(panel.getByText('Host connector unavailable', { exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Restart app', exact: true })).toBeDisabled();
  await expect(panel.getByRole('button', { name: 'Run diagnostics', exact: true })).toBeDisabled();
  await expect(panel.getByRole('link', { name: 'Manage app settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run Backup Now', exact: true })).toBeVisible();
  expect(calls).toEqual([]);
});
