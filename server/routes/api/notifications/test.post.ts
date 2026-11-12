import { defineHandler } from 'nitro';
import { createError } from 'nitro/h3';
import { requireUser } from '../../../utils/auth';
import { query } from '../../../utils/db';
import { requirePushOrigin, sendPhonePush } from '../../../utils/phoneNotifications';
const lastTest = new Map<string, number>();
export default defineHandler(async event => {
  const user = await requireUser(event); requirePushOrigin(event);
  const now = Date.now();
  for (const [id, time] of lastTest) if (now - time > 60000) lastTest.delete(id);
  if (lastTest.has(user.id)) throw createError({ statusCode: 429, statusMessage: 'Wait one minute before sending another test' });
  if (!(await query('SELECT 1 FROM phone_push_devices WHERE user_id=$1 LIMIT 1', [user.id])).rows.length) throw createError({ statusCode: 400, statusMessage: 'Enable notifications on a device first' });
  lastTest.set(user.id, now);
  return sendPhonePush([user.id], 'Mahaffeys phone alerts', 'Test notification. This phone can receive operator alerts when an administrator selects your account.');
});
