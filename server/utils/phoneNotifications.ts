import { createHash } from 'node:crypto';
import * as webpush from 'web-push';
import { createError, getRequestHeaders, getRequestURL, type H3Event } from 'nitro/h3';
import { z } from 'zod';
import { query } from './db';
import { isLocalPreview } from './databaseMode';
import type { AuditEntry } from './audit';
import { NOTIFICATION_ACTIONS, type NotificationAction, type NotificationRule } from '../../src/types/notifications';

export function requirePushOrigin(event: H3Event) {
  const origin = getRequestHeaders(event).origin;
  try {
    if (!origin || new URL(origin).host !== getRequestURL(event).host) throw new Error();
  } catch { throw createError({ statusCode: 403, statusMessage: 'Same-origin request required' }); }
}

export async function pushKeys() {
  let row = (await query<{ public_key: string; private_key: string }>('SELECT public_key,private_key FROM push_server_keys')).rows[0];
  if (!row) {
    const keys = webpush.generateVAPIDKeys();
    await query('INSERT INTO push_server_keys(singleton,public_key,private_key) VALUES(TRUE,$1,$2) ON CONFLICT DO NOTHING', [keys.publicKey, keys.privateKey]);
    row = (await query<{ public_key: string; private_key: string }>('SELECT public_key,private_key FROM push_server_keys')).rows[0];
  }
  return row;
}

export async function notificationRules(): Promise<NotificationRule[]> {
  return (await query<{ action: NotificationAction; recipient_ids: string[]; operator_ids: string[] }>('SELECT * FROM phone_notification_rules ORDER BY action')).rows.map(row => ({ action: row.action, recipientIds: row.recipient_ids, operatorIds: row.operator_ids }));
}

// Only browser push services are allowed: subscriptions must never become an arbitrary server-side URL fetch.
export function validPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash &&
      ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'].includes(url.hostname);
  } catch { return false; }
}
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().max(4096).refine(validPushEndpoint, 'Unsupported browser push service'),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).refine(v => Buffer.from(v, 'base64url').length === 65, 'Invalid push key'),
    auth: z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).refine(v => Buffer.from(v, 'base64url').length === 16, 'Invalid push authentication'),
  }),
});
export const endpointHash = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex');

export async function sendPhonePush(userIds: string[], title: string, body: string) {
  if (isLocalPreview()) return { accepted: 0, failed: 0, localPreview: true };
  const keys = await pushKeys();
  const devices = (await query<{ endpoint_hash: string; subscription: webpush.PushSubscription }>(
    `SELECT d.endpoint_hash,d.subscription FROM phone_push_devices d JOIN users u ON u.id=d.user_id
     WHERE u.status='approved' AND d.user_id=ANY($1::text[])`, [userIds],
  )).rows;
  let accepted = 0; let failed = 0;
  // Rules cap the fan-out at 20 recipients with five devices each. Parallel sends
  // keep the push timeout from multiplying and delaying scale desk commands.
  await Promise.all(devices.map(async device => {
    try {
      await webpush.sendNotification(device.subscription, JSON.stringify({ title, body, url: '/settings?section=notifications' }), {
        TTL: 3600, timeout: 3000,
        vapidDetails: { subject: process.env.NITRO_PUSH_SUBJECT || 'https://mahaffeysusedparts.com', publicKey: keys.public_key, privateKey: keys.private_key },
      });
      accepted++;
    } catch (error) {
      failed++;
      const code = (error as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await query('DELETE FROM phone_push_devices WHERE endpoint_hash=$1', [device.endpoint_hash]);
      // Never log subscription URLs or keys.
      console.warn('[phone-push] delivery not accepted', code ?? 'network error');
    }
  }));
  return { accepted, failed, localPreview: false };
}

export function notificationAction(entry: AuditEntry): NotificationAction | undefined {
  if (entry.action === 'purchase.created' || entry.action === 'purchase.paid' || entry.action === 'purchase.voided' || entry.action === 'stoplight.changed' || entry.action === 'prices.changed') return entry.action;
  if (['customer.create', 'customer.update', 'customer.merge'].includes(entry.action)) return 'customer.changed';
  if (entry.action === 'auth.login') return 'operator.login';
  if (entry.action === 'state.write') {
    if (['mahaffeys_metals', 'mahaffeys_car_rates'].includes(entry.entityId ?? '')) return 'prices.changed';
    if (entry.entityId === 'mahaffeys_settings') return 'settings.changed';
  }
}

export async function notifyOperatorAction(entry: AuditEntry) {
  try {
    const action = notificationAction(entry);
    if (!action || !entry.userId || isLocalPreview()) return;
    const actor = (await query("SELECT id FROM users WHERE id=$1 AND status='approved'", [entry.userId])).rows[0];
    if (!actor) return;
    const rule = (await notificationRules()).find(rule => rule.action === action);
    if (!rule?.recipientIds.length || (rule.operatorIds.length && !rule.operatorIds.includes(entry.userId))) return;
    await sendPhonePush(rule.recipientIds, NOTIFICATION_ACTIONS[action], `${entry.userName} · ${NOTIFICATION_ACTIONS[action]}. Open the app to review.`);
  } catch { console.warn('[phone-push] operator alert could not be sent'); }
}
