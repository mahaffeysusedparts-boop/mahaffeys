import { test, expect } from '@playwright/test';

// Mock read responses so this display test never touches live financial data.
test('Ledger lists newest transactions first and receipts omit optional-field notices', async ({ page }) => {
  const user = { id: 'ledger-test-user', fullName: 'Ledger Tester', username: 'ledger-tester', role: 'admin', status: 'approved' };
  const tickets = [
    { id: 'ORDER-OLDER', createdAt: '2026-01-01T12:00:00Z' },
    { id: 'ORDER-NEWEST', createdAt: '2026-01-03T12:00:00Z' },
    { id: 'ORDER-MIDDLE', createdAt: '2026-01-02T12:00:00Z' },
  ].map((ticket) => ({
    ...ticket,
    ticketType: 'SCRAP_METAL', customerName: 'Ledger Test Seller',
    payoutMethod: 'Cash', status: 'COMPLETED', grossTotal: 10,
    totalDeductions: 0, finalPayout: 10, scrapLines: [],
    buying: { stage: 'OPEN', intakeRequirementReview: { optionalMissing: ['Seller phone', 'Vehicle plate'] } },
  }));
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const response = path === '/api/auth/status' ? { user, hasAdmin: true }
      : path === '/api/users' ? { users: [user] }
      : path === '/api/state' ? { state: { mahaffeys_tickets: tickets } }
      : path === '/api/printers' ? []
      : { ok: true };
    await route.fulfill({ json: response });
  });
  await page.goto('/tickets');
  const rows = page.getByRole('table').getByRole('row');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(1)).toContainText('#ORDER-NEWEST');
  await expect(rows.nth(2)).toContainText('#ORDER-MIDDLE');
  await expect(rows.nth(3)).toContainText('#ORDER-OLDER');
  await page.getByPlaceholder('Search ticket #, seller name, plate or VIN...').fill('ORDER-');
  await expect(rows.nth(1)).toContainText('#ORDER-NEWEST');
  await rows.nth(1).getByRole('button', { name: 'Receipt', exact: true }).click();
  const receipt = page.getByRole('dialog');
  await expect(receipt.getByText('CUSTOMER COPY — FOR YOUR RECORDS', { exact: true })).toBeVisible();
  await expect(receipt.getByText('YARD / OFFICE COPY — OFFICIAL COMPLIANCE RECORD', { exact: true })).toBeVisible();
  await expect(receipt).not.toContainText('OPTIONAL NOT PROVIDED');
  await expect(receipt).not.toContainText('Seller phone');
});
