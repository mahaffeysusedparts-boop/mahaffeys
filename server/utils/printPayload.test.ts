import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, execFile } = vi.hoisted(() => ({ query: vi.fn(), execFile: vi.fn() }));
vi.mock('node:child_process', () => ({ execFile }));
vi.mock('./db', () => ({ query }));

import { submitPrintJob } from './networkPrinters';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('network print document size', () => {
  it('accepts documents above the former four-million-character limit', async () => {
    const html = 'x'.repeat(4_100_000);
    query.mockResolvedValueOnce({ rows: [] });

    await expect(submitPrintJob('printer-id', html)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Choose a configured network printer',
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rejects oversized documents before any printer or filesystem work', async () => {
    await expect(submitPrintJob('printer-id', 'x'.repeat(15_000_001))).rejects.toMatchObject({
      statusCode: 413,
      statusMessage: 'Print document is too large',
    });
    expect(execFile).not.toHaveBeenCalled();
  });
});
