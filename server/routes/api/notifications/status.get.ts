import { defineHandler } from 'nitro';
import { requireUser } from '../../../utils/auth';
import { query } from '../../../utils/db';
import { isLocalPreview } from '../../../utils/databaseMode';
import { pushKeys, notificationRules } from '../../../utils/phoneNotifications';
export default defineHandler(async event => {
  const user = await requireUser(event);
  const keys = await pushKeys();
  const devices = await query<{ count: string }>('SELECT COUNT(*) AS count FROM phone_push_devices WHERE user_id=$1', [user.id]);
  return { publicKey: keys.public_key, deviceCount: Number(devices.rows[0].count), receiving: (await notificationRules()).some(rule => rule.recipientIds.includes(user.id)), localPreview: isLocalPreview() };
});
