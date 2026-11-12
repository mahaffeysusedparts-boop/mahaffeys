import { defineHandler } from 'nitro';
import { assertBodySize, createError, readBody } from 'nitro/h3';
import { z } from 'zod';
import { requireAdmin } from '../../../utils/auth';
import { withTransaction } from '../../../utils/db';
import { requirePushOrigin } from '../../../utils/phoneNotifications';
import { NOTIFICATION_ACTIONS, type NotificationAction } from '../../../../src/types/notifications';
const schema = z.object({ rules: z.array(z.object({
  action: z.string().refine(value => Object.hasOwn(NOTIFICATION_ACTIONS, value)),
  recipientIds: z.array(z.string().min(1).max(120)).max(20),
  operatorIds: z.array(z.string().min(1).max(120)).max(100),
})).max(Object.keys(NOTIFICATION_ACTIONS).length) });
export default defineHandler(async event => {
  await requireAdmin(event); requirePushOrigin(event); assertBodySize(event, 65536);
  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success || new Set(parsed.data.rules.map(rule => rule.action)).size !== parsed.data.rules.length) throw createError({ statusCode: 400, statusMessage: 'Invalid notification rules' });
  await withTransaction(async client => {
    const approved = new Set((await client.query("SELECT id FROM users WHERE status='approved'")).rows.map(row => row.id));
    if (parsed.data.rules.some(rule => [...rule.recipientIds, ...rule.operatorIds].some(id => !approved.has(id)))) throw createError({ statusCode: 400, statusMessage: 'Choose approved accounts only' });
    await client.query('DELETE FROM phone_notification_rules');
    for (const rule of parsed.data.rules) await client.query('INSERT INTO phone_notification_rules(action,recipient_ids,operator_ids) VALUES($1,$2::jsonb,$3::jsonb)', [rule.action as NotificationAction, JSON.stringify([...new Set(rule.recipientIds)]), JSON.stringify([...new Set(rule.operatorIds)])]);
  });
  return { ok: true };
});
