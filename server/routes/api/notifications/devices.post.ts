import { defineHandler } from 'nitro';
import { assertBodySize, createError, readBody } from 'nitro/h3';
import { requireUser } from '../../../utils/auth';
import { withTransaction } from '../../../utils/db';
import { endpointHash, pushSubscriptionSchema, requirePushOrigin } from '../../../utils/phoneNotifications';
export default defineHandler(async event => {
  const user = await requireUser(event); requirePushOrigin(event); assertBodySize(event, 8192);
  const parsed = pushSubscriptionSchema.safeParse(await readBody(event));
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || 'Invalid subscription' });
  await withTransaction(async client => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user.id]);
    const hash = endpointHash(parsed.data.endpoint);
    const existing = (await client.query('SELECT user_id FROM phone_push_devices WHERE endpoint_hash=$1', [hash])).rows[0];
    if (existing && existing.user_id !== user.id) throw createError({ statusCode: 409, statusMessage: 'This browser is registered to another account. Disable notifications in that account first.' });
    const count = (await client.query('SELECT COUNT(*) AS count FROM phone_push_devices WHERE user_id=$1', [user.id])).rows[0];
    if (!existing && Number(count.count) >= 5) throw createError({ statusCode: 400, statusMessage: 'Five devices are already registered. Remove one before adding another.' });
    const saved = await client.query('INSERT INTO phone_push_devices(endpoint_hash,user_id,subscription) VALUES($1,$2,$3::jsonb) ON CONFLICT(endpoint_hash) DO UPDATE SET subscription=EXCLUDED.subscription WHERE phone_push_devices.user_id=EXCLUDED.user_id RETURNING user_id', [hash, user.id, JSON.stringify(parsed.data)]);
    if (!saved.rows.length) throw createError({ statusCode: 409, statusMessage: 'This browser is registered to another account' });
  });
  return { ok: true };
});
