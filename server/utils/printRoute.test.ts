import { beforeEach, describe, expect, it, vi } from 'vitest';

const { readBody, requireUser, submitPrintJob, recordAudit } = vi.hoisted(() => ({
  readBody: vi.fn(),
  requireUser: vi.fn(),
  submitPrintJob: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock('nitro', () => ({ defineHandler: (handler: unknown) => handler }));
vi.mock('nitro/h3', () => ({
  readBody,
  createError: (error: object) => Object.assign(new Error(), error),
}));
vi.mock('./auth', () => ({ requireUser }));
vi.mock('./networkPrinters', () => ({ submitPrintJob }));
vi.mock('./audit', () => ({ auditFor: vi.fn((user, audit) => ({ ...audit, user })), recordAudit }));

import printRoute from '../routes/api/printers/[id]/print.post';

const handle = printRoute as unknown as (event: object) => Promise<unknown>;
const user = { id: 'operator', fullName: 'Print Operator', role: 'scale_operator' };
const largeHtml = `<main>${'x'.repeat(1_500_000)}</main>`;

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue(user);
  readBody.mockResolvedValue({ html: largeHtml, documentName: 'receipt-large' });
  submitPrintJob.mockResolvedValue({ queued: true, printer: 'Yard Printer' });
  recordAudit.mockResolvedValue(undefined);
});

describe('network print request body', () => {
  it('parses large print documents within the supported print payload limit', async () => {
    await handle({ context: { params: { id: 'printer-id' } } });

    expect(readBody).toHaveBeenCalledWith(expect.anything(), { limit: 20 * 1024 * 1024 });
    expect(submitPrintJob).toHaveBeenCalledWith('printer-id', largeHtml);
  });

  it('rejects an empty document without submitting a print job', async () => {
    readBody.mockResolvedValue({ html: '' });

    await expect(handle({ context: { params: { id: 'printer-id' } } })).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'A printable HTML document is required',
    });
    expect(submitPrintJob).not.toHaveBeenCalled();
  });
});
