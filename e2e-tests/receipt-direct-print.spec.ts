import { test, expect } from '@playwright/test';

// All API calls, including printing, are mocked: no real printer or yard data is touched.
for (const { missingPhoto, savedProfile } of [
  { missingPhoto: false, savedProfile: false },
  { missingPhoto: true, savedProfile: false },
  { missingPhoto: false, savedProfile: true },
]) {
  test(missingPhoto ? 'Direct printing stops when an attached photo is unavailable' : savedProfile ? 'Receipt loads a saved seller ID and embeds it in direct and browser printing' : 'Direct printing embeds all five photos in both receipt copies', async ({ page }) => {
    const user = { id: 'print-test', fullName: 'Print Tester', username: 'print-test', role: 'admin', status: 'approved' };
    const photos = ['id', 'person', 'vehicle', 'plate', 'load'];
    const ticket = {
      id: 'PHOTO-TEST', createdAt: '2026-01-03T12:00:00Z', ticketType: 'SCRAP_METAL',
      customerName: 'Photo Test Seller', customerId: savedProfile ? 'saved-seller' : undefined, payoutMethod: 'Cash', status: 'COMPLETED',
      grossTotal: 10, totalDeductions: 0, finalPayout: 10, scrapLines: [],
      complianceCaptures: {
        idPhotoUrl: savedProfile ? undefined : '/api/uploads/id', personPhotoUrl: '/api/uploads/person',
        vehiclePhotoUrl: '/api/uploads/vehicle', licensePlatePhotoUrl: '/api/uploads/plate',
        loadPhotoUrl: '/api/uploads/load',
      },
    };
    let printCalls = 0;
    let printedHtml = '';
    await page.addInitScript(() => localStorage.setItem('mahaffeys_print_defaults', JSON.stringify({ standardPrinterId: 'test-printer' })));
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.startsWith('/api/uploads/')) {
        if (missingPhoto && path.endsWith('/load')) {
          await route.fulfill({ status: 404, body: 'Photo unavailable' });
        } else {
          const color = ['red', 'green', 'blue', 'orange', 'purple'][photos.indexOf(path.split('/').pop()!)];
          await route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="${color}"/></svg>` });
        }
        return;
      }
      let response: unknown = { ok: true };
      if (path === '/api/auth/status') response = { user, hasAdmin: true };
      else if (path === '/api/users') response = { users: [user] };
      else if (path === '/api/state') response = { state: { mahaffeys_tickets: [ticket] } };
      else if (path === '/api/customers/saved-seller') response = { id: 'saved-seller', fullName: ticket.customerName, idPhotoUrl: '/api/uploads/id' };
      else if (path === '/api/printers') response = [{ id: 'test-printer', name: 'Test Printer', host: '192.168.1.251', kind: 'standard' }];
      else if (path === '/api/printers/test-printer/print') {
        printCalls++;
        printedHtml = route.request().postDataJSON().html;
        response = { queued: true, printer: 'Test Printer' };
      }
      await route.fulfill({ json: response });
    });
    await page.goto('/tickets');
    await page.getByRole('button', { name: 'Receipt', exact: true }).click();
    const receipt = page.getByRole('dialog');
    await expect(receipt.getByRole('img', { name: /^(ID SCAN|SELLER FACE|VEHICLE|PLATE OCR|CARGO LOAD)$/ })).toHaveCount(10);
    const direct = receipt.getByRole('button', { name: 'Print direct', exact: true });
    await expect(direct).toBeEnabled();
    await direct.click();
    if (missingPhoto) {
      await expect(page.getByText('Could not prepare photo "CARGO LOAD". The print job was not sent. Check that the photo is available and try again.', { exact: true })).toBeVisible();
      await expect(direct).toBeEnabled();
      expect(printCalls).toBe(0);
    } else {
      await expect(page.getByText('Sent to Test Printer', { exact: true })).toBeVisible();
      expect(printCalls).toBe(1);
      const embedded = await page.evaluate(async html => {
        const document = new DOMParser().parseFromString(html, 'text/html');
        return Promise.all(Array.from(document.querySelectorAll('img')).map(async element => {
          const image = new Image();
          image.src = element.src;
          await image.decode();
          return { embedded: element.src.startsWith('data:image/jpeg;base64,'), width: image.naturalWidth, alt: element.alt };
        }));
      }, printedHtml);
      expect(embedded).toHaveLength(10);
      expect(embedded.every(image => image.embedded && image.width > 0)).toBe(true);
      for (const label of ['ID SCAN', 'SELLER FACE', 'VEHICLE', 'PLATE OCR', 'CARGO LOAD']) {
        expect(embedded.filter(image => image.alt === label)).toHaveLength(2);
      }
      const rendered = await page.context().newPage();
      await rendered.emulateMedia({ media: 'print' });
      await rendered.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#fff}*{box-sizing:border-box}</style></head><body>${printedHtml}</body></html>`);
      const printedImages = rendered.getByRole('img', { name: /^(ID SCAN|SELLER FACE|VEHICLE|PLATE OCR|CARGO LOAD)$/ });
      await expect(printedImages).toHaveCount(10);
      for (const image of await printedImages.all()) {
        await expect(image).toBeVisible();
        const box = await image.boundingBox();
        expect(box?.width).toBeGreaterThan(30);
        expect(box?.height).toBeGreaterThan(30);
      }
      const pdf = await rendered.pdf({ printBackground: true, preferCSSPageSize: true });
      expect((pdf.toString('latin1').match(/\/Subtype\s*\/Image\b/g) ?? []).length).toBeGreaterThanOrEqual(5);
      await rendered.close();
      if (savedProfile) {
        await page.evaluate(() => {
          window.print = () => {
            document.documentElement.dataset.printedPhotos = JSON.stringify(Array.from(document.querySelectorAll<HTMLImageElement>('.printable-receipt-container img')).map(image => ({ src: image.src, width: image.naturalWidth })));
          };
        });
        await receipt.getByRole('button', { name: 'Print Both Copies', exact: true }).click();
        await expect.poll(() => page.evaluate(() => document.documentElement.dataset.printedPhotos || '')).not.toBe('');
        const browserPhotos = await page.evaluate(() => JSON.parse(document.documentElement.dataset.printedPhotos!)) as { src: string; width: number }[];
        expect(browserPhotos).toHaveLength(10);
        expect(browserPhotos.every(image => image.src.startsWith('data:image/jpeg;base64,') && image.width > 0)).toBe(true);
        await expect(receipt.getByRole('button', { name: 'Print Both Copies', exact: true })).toBeEnabled();
      }
      await expect(receipt.getByRole('img', { name: 'ID SCAN', exact: true }).first()).toHaveAttribute('src', '/api/uploads/id');
    }
  });
}
