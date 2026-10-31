import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { closeDatabase, query, withTransaction } from './db';
import { isLocalPreview } from './databaseMode';

let directory: string | undefined;
afterEach(async () => {
  await closeDatabase();
  vi.unstubAllEnvs();
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = undefined;
});

test('preview ignores external credentials, preserves transactions and binary data, and survives reopening', async () => {
  directory = await mkdtemp(join(tmpdir(), 'mahaffeys-preview-'));
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('NITRO_PREVIEW_DATA_DIR', join(directory, 'new', 'local-preview'));
  vi.stubEnv('NITRO_DATABASE_URL', 'postgresql://unused:unused@127.0.0.1:1/live');
  vi.stubEnv('DATABASE_URL', 'postgresql://unused:unused@127.0.0.1:1/live');

  await withTransaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('preview-test'))");
    await client.query('INSERT INTO app_state(key,value,updated_at) VALUES($1,$2::jsonb,NOW())', ['preview-test', JSON.stringify({ saved: true })]);
  });
  await expect(withTransaction(async client => {
    await client.query("UPDATE app_state SET value='false'::jsonb WHERE key='preview-test'");
    throw new Error('cancel');
  })).rejects.toThrow('cancel');

  const content = Buffer.from('local photo bytes');
  await query('INSERT INTO media_uploads(id,file_name,content_type,byte_size,content) VALUES($1,$2,$3,$4,$5)', ['10000000-0000-4000-8000-000000000001', 'photo.bin', 'application/octet-stream', content.length, content]);
  await closeDatabase();
  const state = await query('SELECT value FROM app_state WHERE key=$1', ['preview-test']);
  expect(state.rows[0].value).toEqual({ saved: true });
  const media = await query('SELECT content FROM media_uploads');
  expect(Buffer.isBuffer(media.rows[0].content)).toBe(true);
  expect(media.rows[0].content).toEqual(content);
  await Promise.all(Array.from({ length: 5 }, () => withTransaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(114682)');
    await client.query("UPDATE app_state SET value=jsonb_set(value,'{count}',to_jsonb(COALESCE((value->>'count')::int,0)+1)) WHERE key='preview-test'");
  })));
  expect((await query("SELECT value FROM app_state WHERE key='preview-test'")).rows[0].value.count).toBe(5);
}, 60000);

test('production and isolated PostgreSQL integration tests do not select preview storage', () => {
  vi.stubEnv('NODE_ENV', 'production');
  expect(isLocalPreview()).toBe(false);
  vi.stubEnv('NODE_ENV', 'test');
  expect(isLocalPreview()).toBe(false);
});
