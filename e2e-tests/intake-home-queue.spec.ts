import { test, expect, type Page } from '@playwright/test';
import { ownershipFixture, queueEnvelope } from './fixtures/intake-api';
import type { Ticket } from '../src/types/scrap';
import { INTAKE_PHOTO_FIELDS } from '../src/utils/intakeRequirements';

const user = { id: 'intake-home-test', fullName: 'Intake Tester', role: 'scale_operator', status: 'approved' };
function load(id: string, minutes: number, fields: Partial<Ticket> = {}): Ticket {
  return { id, ticketType: 'SCRAP_METAL', customerName: `${id} Seller`, createdAt: new Date(Date.now() - minutes * 60000).toISOString(), status: 'PENDING', selectedWeighingType: 'VEHICLE_IN_OUT', notes: '', scrapLines: [], grossTotal: 0, totalDeductions: 0, finalPayout: 0, payoutMethod: 'Cash', operatorName: user.fullName, buying: { version: 1, revision: 1, stage: 'DRAFT' }, ...fields };
}
async function syntheticApi(page: Page, tickets: Ticket[]) {
  const ownership = ownershipFixture(user);
  const commands: string[] = [];
  const profileRequests: string[] = [];
  await page.route('**/api/**', async route => {
    if (await ownership(route)) return;
    const path = new URL(route.request().url()).pathname;
    let response: unknown = { ok: true };
    if (path === '/api/auth/status') response = { user, hasAdmin: true };
    else if (path === '/api/state') response = { state: { mahaffeys_tickets: tickets, mahaffeys_metals: [], mahaffeys_settings: { operatorName: user.fullName, scales: [] } } };
    else if (path === '/api/scrap-buying/queue') response = queueEnvelope(tickets);
    else if (path === '/api/scrap-buying/requirements') response = { revision: 1, requirePhotos: true, requirePhone: true, requireAddress: true, requireSellerId: true, requireVehiclePlate: true, requireExplicitReview: true };
    else if (path === '/api/scrap-buying/bin-inspections') response = { cycles: [] };
    else if (path === '/api/scrap-buying/eligibility') response = { allowedMethods: [], reasons: [], permitRequired: false, documentationRequired: false };
    else if (path === '/api/scrap-buying/commands') {
      const command = route.request().postDataJSON(); commands.push(command.action);
      expect(command.action).toBe('ADOPT'); response = tickets.find(ticket => ticket.id === command.id);
    } else if (path.startsWith('/api/customers/')) {
      profileRequests.push(path); response = { id: 'PROFILE', fullName: 'Seller', idType: 'Driver License', idState: 'SC', idNumber: 'ID', address: 'Street' };
    } else if (path === '/api/printers') response = [];
    else if (path === '/api/scale/status') response = { connected: false, weight: 0, unit: 'LBS', isStable: false, isZero: true, registry: [] };
    await route.fulfill({ json: response });
  });
  return { commands, profileRequests };
}

for (const count of [0, 2]) {
  test(`Explicit home entries preserve a collection draft with ${count} queued loads`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const tickets = Array.from({ length: count }, (_, index) => load(`LOAD-${index}`, 10));
    await syntheticApi(page, tickets);
    await page.goto('/intake');
    await expect(page.getByRole('heading', { name: 'What are you starting?' })).toBeVisible();
    await expect(page.getByText(`${count} active loads · confirmed`, { exact: true })).toBeVisible();
    await page.getByText('New scrap load', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'New scrap load', exact: true })).toBeVisible();
    await page.getByPlaceholder('e.g. Marcus Vance').fill('Recoverable Seller');
    await expect(page.getByRole('region', { name: 'Required seller details' }).getByLabel('Phone Number', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Driver License / ID #', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Intake Notes', { exact: true })).not.toBeVisible();
    await page.locator('summary').filter({ hasText: 'Optional seller details & notes' }).click();
    await page.getByLabel('Intake Notes', { exact: true }).fill('Mixed metal load');
    await expect(page.getByLabel('Receipt number', { exact: true })).not.toBeVisible();
    await page.locator('summary').filter({ hasText: /^Receipt #/ }).click();
    await expect(page.getByLabel('Receipt number', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('e.g. Marcus Vance')).toHaveValue('Recoverable Seller');
    await page.locator('summary').filter({ hasText: 'Load progress & queue status' }).click();
    const strip = page.getByRole('region', { name: 'Scrap next steps' });
    await strip.getByText('Workflow steps & states', { exact: true }).click();
    await expect(strip.getByRole('button', { name: 'Seller details: needs attention', exact: true })).toBeVisible();
    expect(await strip.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.locator('summary').filter({ hasText: 'Switch workspace' }).click();
    await page.getByRole('navigation', { name: 'Intake workspaces' }).getByRole('button', { name: 'Open scale queue', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Weigh & pay', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search scale queue', exact: true })).toBeVisible();
    if (!count) await expect(page.getByText('No active scrap loads.', { exact: true })).toBeVisible();
    await page.getByRole('navigation', { name: 'Intake workspaces' }).getByRole('button', { name: 'Intake home', exact: true }).click();
    await page.getByText('New scrap load', { exact: true }).click();
    await page.getByRole('button', { name: 'Resume draft', exact: true }).click();
    await expect(page.getByPlaceholder('e.g. Marcus Vance')).toHaveValue('Recoverable Seller');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'What are you starting?' })).toBeVisible();
    await page.getByRole('button', { name: 'Resume previous workspace', exact: true }).click();
    await page.getByRole('button', { name: 'Resume draft', exact: true }).click();
    await expect(page.getByPlaceholder('e.g. Marcus Vance')).toHaveValue('Recoverable Seller');
    await page.locator('summary').filter({ hasText: 'Optional seller details & notes' }).click();
    await expect(page.getByLabel('Intake Notes', { exact: true })).toHaveValue('Mixed metal load');
    await page.locator('summary').filter({ hasText: 'Switch workspace' }).click();
    await page.getByRole('navigation', { name: 'Intake workspaces' }).getByRole('button', { name: 'New vehicle', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Save to Pending Group', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Scrap next steps' })).toHaveCount(0);
  });
}

test('Saved queue cards retain stage beside CURRENT, minute ages, attention filtering and stable sorting', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-03T00:24:00Z') });
  await page.setViewportSize({ width: 390, height: 844 });
  const tickets = [load('NEWER', 24, { createdAt: '2026-01-03T00:00:00Z', vehicleLicensePlate: 'TRUCK-251', customerId: 'PROFILE', scaleGrossInWeight: 1000, scaleGrossInAt: '2026-01-03T00:12:00Z', buying: { version: 1, revision: 1, stage: 'DRAFT', activeCycleId: 'CYCLE' } }), load('OLDER', 90, { createdAt: '2026-01-02T22:54:00Z', customerPhone: '555', customerAddress: 'Street', customerIdNumber: 'ID', vehicleLicensePlate: 'COMPLETE-1', complianceCaptures: Object.fromEntries(INTAKE_PHOTO_FIELDS.map(field => [field, '/saved-photo'])), buying: { version: 1, revision: 1, stage: 'DRAFT', sellerIdentity: { idType: 'Driver License', idState: 'SC', idNumber: 'ID' } } })];
  const api = await syntheticApi(page, tickets);
  await page.goto('/intake');
  await page.getByText('Open scale queue', { exact: true }).click();
  const newer = page.getByRole('article', { name: 'Intake NEWER', exact: true });
  await expect(newer.getByText('TRUCK-251', { exact: true })).toBeVisible();
  await expect(newer.getByText('Since intake: 24 min', { exact: true })).toBeVisible();
  await expect(newer.getByText('Since IN: 12 min', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Needs details (1)', exact: true })).toBeVisible();
  expect(api.profileRequests).toHaveLength(0);
  await newer.getByRole('button', { name: 'Open This Intake', exact: true }).click();
  await expect(newer.getByText('CURRENT', { exact: true })).toBeVisible();
  await expect(newer.getByText('On yard · awaiting OUT', { exact: true })).toBeVisible();
  await page.clock.fastForward(60000);
  await expect(newer.getByText('Since intake: 25 min', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Needs details (1)', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Search scale queue', exact: true }).fill('no-match');
  await expect(page.getByText('No loads match these filters.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await page.getByRole('combobox', { name: 'Queue order', exact: true }).selectOption('oldest');
  await expect(page.getByRole('article').first()).toHaveAttribute('aria-label', 'Intake OLDER');
  await expect(newer.getByText('CURRENT', { exact: true })).toBeVisible();
  expect(await newer.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  const strip = page.getByRole('region', { name: 'Scrap next steps' });
  await strip.getByRole('button', { name: 'Go to next section', exact: true }).click();
  expect(api.commands).toEqual(['ADOPT']);
});

test('Weighing keeps complete seller details tucked away and required corrections accessible', async ({ page }) => {
  const ticket = load('SIMPLE', 2, {
    customerId: 'PROFILE', customerPhone: '555', customerAddress: 'Street', customerIdNumber: 'ID', vehicleLicensePlate: 'TEST-1',
    complianceCaptures: Object.fromEntries(INTAKE_PHOTO_FIELDS.map(field => [field, '/saved-photo'])),
    buying: { version: 1, revision: 1, stage: 'DRAFT', sellerIdentity: { idType: 'Driver License', idState: 'SC', idNumber: 'ID' } },
  });
  await syntheticApi(page, [ticket]);
  await page.goto('/intake');
  await page.getByText('Open scale queue', { exact: true }).click();
  await page.getByRole('button', { name: 'Open This Intake', exact: true }).click();
  const seller = page.locator('#scale-seller-editor');
  await expect(seller.locator('summary')).toContainText('review or edit');
  await expect(seller.getByLabel('Seller phone', { exact: true })).not.toBeVisible();
  await expect(page.getByRole('region', { name: 'Weighing type', exact: true }).getByRole('button')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Complete & Record Payment', exact: true })).toBeDisabled();
  await seller.locator('summary').click();
  await seller.getByLabel('Seller phone', { exact: true }).fill('');
  await expect(seller.getByText('Seller phone is required.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Complete & Record Payment', exact: true })).toBeDisabled();
  await seller.locator('summary').click();
  const strip = page.getByRole('region', { name: 'Scrap next steps' });
  await strip.locator('summary').filter({ hasText: 'Completion blockers / verification' }).click();
  await strip.getByRole('button', { name: 'Unsaved corrections / inputs — saved evidence has not changed', exact: true }).click();
  await expect(seller.getByLabel('Seller phone', { exact: true })).toBeVisible();
  const completion = page.getByRole('region', { name: 'Payment completion guidance' });
  await expect(completion.getByText('Save the seller corrections before completing.', { exact: true })).toBeVisible();
  await completion.getByRole('listitem').filter({ hasText: 'Save the seller corrections before completing.' }).getByRole('button', { name: 'Take me there' }).click();
  await expect(seller.getByLabel('Seller phone', { exact: true })).toBeFocused();
});

test('Staff can identify and fix saving blockers without losing optional inputs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await syntheticApi(page, []);
  await page.route('**/api/scrap-buying/requirements', route => route.fulfill({ json: { revision: 1, requirePhotos: false, requirePhone: false, requireAddress: false, requireSellerId: false, requireVehiclePlate: false, requireExplicitReview: false } }));
  await page.goto('/intake');
  await page.getByText('New scrap load', { exact: true }).click();
  const guidance = page.getByRole('region', { name: 'Continue to scale guidance' });
  await expect(guidance.getByRole('heading', { name: 'Before you can continue to scale' })).toBeVisible();
  await guidance.getByRole('button', { name: 'Take me there', exact: true }).click();
  await expect(page.getByLabel('Seller Name *', { exact: true })).toBeFocused();
  await page.getByLabel('Seller Name *', { exact: true }).fill('Snag Test Seller');
  await expect(guidance.getByText('Ready to save and continue to scale.', { exact: false })).toBeVisible();
  await page.locator('summary').filter({ hasText: 'Optional seller details & notes' }).click();
  await page.getByLabel('Driver License / ID #', { exact: true }).fill('TEST-ID-42');
  await page.getByLabel('Intake Notes', { exact: true }).fill('Keep these notes');
  await page.locator('summary').filter({ hasText: 'Optional seller details & notes' }).click();
  await expect(page.getByLabel('Driver License / ID #', { exact: true })).not.toBeVisible();
  await expect(guidance.getByText('Confirm the actual ID type.', { exact: true })).toBeVisible();
  await guidance.getByRole('button', { name: 'Take me there', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Actual ID type', exact: true })).toBeFocused();
  await page.getByRole('combobox', { name: 'Actual ID type', exact: true }).click();
  await page.getByRole('option', { name: 'State ID', exact: true }).click();
  await expect(guidance.getByRole('heading', { name: 'Before you can continue to scale' })).toHaveCount(0);
  await expect(page.getByLabel('Driver License / ID #', { exact: true })).toHaveValue('TEST-ID-42');
  await expect(page.getByLabel('Intake Notes', { exact: true })).toHaveValue('Keep these notes');
  await expect(page.getByRole('button', { name: 'Save Intake & Continue to Scale', exact: true })).toBeEnabled();
  expect(api.commands).toEqual([]);
});

test('A full queue explains the stop and lets staff open the queue with their draft retained', async ({ page }) => {
  const tickets = Array.from({ length: 10 }, (_, index) => load(`FULL-${index}`, 10));
  await syntheticApi(page, tickets);
  await page.goto('/intake');
  await page.getByText('New scrap load', { exact: true }).click();
  await page.getByPlaceholder('e.g. Marcus Vance').fill('Waiting Seller');
  const guidance = page.getByRole('region', { name: 'Continue to scale guidance' });
  await expect(guidance.getByText('The intake queue is full. Complete or void an open intake first.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save Intake & Continue to Scale', exact: true })).toBeDisabled();
  await guidance.getByRole('button', { name: 'Take me there', exact: true }).click();
  const queueButton = page.locator('#collection-capacity').getByRole('button', { name: 'Open scale queue', exact: true });
  await expect(queueButton).toBeFocused();
  await queueButton.click();
  await expect(page.getByRole('heading', { name: 'Weigh & pay', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Intake workspaces' }).getByRole('button', { name: 'New scrap load', exact: true }).click();
  await page.getByRole('button', { name: 'Resume draft', exact: true }).click();
  await expect(page.getByPlaceholder('e.g. Marcus Vance')).toHaveValue('Waiting Seller');
});
