import { test, expect } from '@playwright/test';
import type { Ticket } from '../src/types/scrap';

for (const role of ['admin', 'yard_manager', 'scale_operator'] as const) {
  test(`${role} ${role === 'scale_operator' ? 'cannot void' : 'can void'} a paid transaction without reversing its payment`, async ({ page }) => {
    test.setTimeout(60000);
    const user = { id: `void-${role}`, fullName: 'Void Test Operator', username: `void-${role}`, role, status: 'approved' };
    const method = role === 'yard_manager' ? 'Check' : 'Cash';
    let ticket: Ticket = {
      id: 'PAID-VOID-TEST', ticketType: 'SCRAP_METAL', customerName: 'Paid Test Seller', createdAt: '2026-01-01T12:00:00Z', status: 'COMPLETED',
      grossTotal: 20, totalDeductions: 0, finalPayout: 20, payoutMethod: method, checkNumber: method === 'Check' ? '000123' : undefined,
      operatorName: user.fullName, scrapLines: [], buying: { version: 1, revision: 5, stage: 'PAID', payment: { id: 'original-payment', amount: 20, method, checkReference: method === 'Check' ? '000123' : undefined, paidAt: '2026-01-01T12:05:00Z', paidBy: user.fullName } },
    };
    const originalPayment = ticket.buying!.payment;
    let voidRequests = 0;
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let response: unknown = { ok: true };
      if (path === '/api/auth/status') response = { user, hasAdmin: true };
      else if (path === '/api/users') response = { users: [user] };
      else if (path === '/api/state') response = { state: { mahaffeys_tickets: [ticket] } };
      else if (path === '/api/printers') response = [];
      else if (path === '/api/scrap-buying/commands') {
        const body = route.request().postDataJSON();
        expect(body).toMatchObject({ action: 'VOID', id: ticket.id, revision: 5, reason: 'Entry error — Wrong seller recorded' });
        expect(role).not.toBe('scale_operator');
        voidRequests++;
        ticket = { ...ticket, status: 'VOIDED', voidReason: body.reason, voidedBy: user.fullName, voidedAt: new Date().toISOString(), buying: { ...ticket.buying!, revision: 6, stage: 'VOIDED' } };
        response = ticket;
      }
      await route.fulfill({ json: response });
    });
    await page.goto('/tickets');
    const row = page.getByRole('row').filter({ hasText: '#PAID-VOID-TEST' });
    await row.getByRole('button', { name: 'Void paid ticket (supervisor)', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Void Transaction #PAID-VOID-TEST', exact: true });
    await dialog.getByRole('button', { name: 'Entry error', exact: true }).click();
    const confirm = dialog.getByRole('button', { name: 'Void Transaction', exact: true });
    if (role === 'scale_operator') {
      await expect(dialog).toContainText('a yard manager or administrator must void it');
      await expect(confirm).toBeDisabled();
      expect(voidRequests).toBe(0);
      return;
    }
    await expect(dialog.getByRole('alert')).toContainText('Voiding does not reverse the payment or return money to the drawer.');
    await dialog.getByPlaceholder('Optional detail note...').fill('Wrong seller recorded');
    await confirm.click();
    await expect(dialog).not.toBeVisible();
    await expect(row).toContainText('VOIDED');
    await expect(row).toContainText(method);
    expect(voidRequests).toBe(1);
    expect(ticket.buying!.payment).toEqual(originalPayment);
    await row.getByRole('button', { name: 'Receipt', exact: true }).click();
    const receipt = page.getByRole('dialog');
    await expect(receipt.getByText('VOIDED — NOT PAYABLE', { exact: true })).toHaveCount(2);
    await expect(receipt.getByText('ORIGINAL PAYMENT NOT REVERSED', { exact: true })).toHaveCount(2);
    await expect(receipt.getByText('PAYMENT NOT RECORDED', { exact: true })).toHaveCount(0);
    await expect(receipt).toContainText('Wrong seller recorded');
    if (method === 'Check') await expect(receipt).toContainText('000123');
  });
}
