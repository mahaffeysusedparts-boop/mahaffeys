import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, readBody, requireUser } = vi.hoisted(() => ({ query: vi.fn(), readBody: vi.fn(), requireUser: vi.fn() }));
vi.mock('nitro', () => ({ defineHandler: (handler: unknown) => handler }));
vi.mock('nitro/h3', () => ({
  readBody,
  getRouterParam: () => 'photo-seller',
  createError: (error: object) => Object.assign(new Error(), error),
}));
vi.mock('./db', () => ({ query }));
vi.mock('./auth', () => ({ requireUser }));
vi.mock('./audit', () => ({ auditFor: vi.fn(), recordAudit: vi.fn() }));

import updateRoute from '../routes/api/customers/[id].patch';
import getRoute from '../routes/api/customers/[id].get';
import createRoute from '../routes/api/customers/index.post';

const update = updateRoute as unknown as (event: object) => Promise<unknown>;
const get = getRoute as unknown as (event: object) => Promise<{ idPhotoUrl?: string }>;
const create = createRoute as unknown as (event: object) => Promise<unknown>;
const input = { fullName: 'ID Seller', idNumber: 'ID-123', idType: 'Driver License', idState: 'SC' };

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: 'operator', role: 'scale_operator' });
  query.mockResolvedValue({ rows: [{ id: 'photo-seller', full_name: 'ID Seller', id_photo_url: '/api/uploads/saved-id', captured_plates: [], created_at: '2026-01-01', total_payouts: 0, total_weight_lbs: 0 }] });
});

describe('seller profile ID photo persistence', () => {
  it('keeps the stored photo when the update omits a replacement', async () => {
    readBody.mockResolvedValue(input);
    await update({});
    expect(query.mock.calls[0][0]).toContain('id_photo_url = CASE WHEN $15::boolean THEN NULLIF($11, \'\') ELSE id_photo_url END');
    expect(query.mock.calls[0][1][14]).toBe(false);
  });

  it.each(['/api/uploads/new-id', ''])('applies an explicitly supplied photo value %s', async idPhotoUrl => {
    readBody.mockResolvedValue({ ...input, idPhotoUrl });
    await update({});
    expect(query.mock.calls[0][1][10]).toBe(idPhotoUrl);
    expect(query.mock.calls[0][1][14]).toBe(true);
  });

  it('creates a new seller profile without an ID number', async () => {
    readBody.mockResolvedValue({ ...input, idNumber: '' });
    await create({});
    expect(query.mock.calls[0][0]).toContain('INSERT INTO customers');
    expect(query.mock.calls[0][1][4]).toBe('');
  });

  it('retrieves the exact profile only for an authenticated operator', async () => {
    const result = await get({});
    expect(result.idPhotoUrl).toBe('/api/uploads/saved-id');
    expect(query).toHaveBeenCalledWith('SELECT * FROM customers WHERE id = $1', ['photo-seller']);
    query.mockClear();
    requireUser.mockRejectedValue(new Error('Unauthorized'));
    await expect(get({})).rejects.toThrow('Unauthorized');
    expect(query).not.toHaveBeenCalled();
  });
});
