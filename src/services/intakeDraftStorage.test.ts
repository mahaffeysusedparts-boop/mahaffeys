import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { intakeDraftAccess, migrateIntakeDraft } from './intakeDraftStorage';

describe('intake draft persistence', () => {
  it('migrates existing envelopes without losing seller fields or photos', () => {
    const values = { address: 'LOCAL EDIT', captures: { idPhotoUrl: '/private/photo' } };
    expect(migrateIntakeDraft({ values, savedAt: '2026-10-31T00:00:00.000Z' })).toEqual({ version: 1, values, savedAt: '2026-10-31T00:00:00.000Z' });
    expect(() => migrateIntakeDraft({ values: [], savedAt: 'bad' })).toThrow('Invalid draft');
    expect(() => migrateIntakeDraft({ version: 99, values, savedAt: '2026-10-31T00:00:00.000Z' })).toThrow('Invalid draft');
  });
  it('orders an older autosave before deletion and never resurrects it', async () => {
    const key = crypto.randomUUID();
    const write = intakeDraftAccess(key, 'write', { values: { notes: 'last edit' }, savedAt: new Date().toISOString() });
    const remove = intakeDraftAccess(key, 'delete');
    const read = intakeDraftAccess(key, 'read');
    await Promise.all([write, remove]);
    expect(await read).toBeUndefined();
  });
  it('isolates user keys even when the intake kind matches', async () => {
    await intakeDraftAccess('TEST-FIRST:scrap', 'write', { values: { address: 'FIRST' } });
    expect(await intakeDraftAccess('TEST-SECOND:scrap', 'read')).toBeUndefined();
  });
});
