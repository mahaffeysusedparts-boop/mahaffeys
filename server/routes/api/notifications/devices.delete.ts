import { defineHandler } from 'nitro';
import { assertBodySize, createError, readBody } from 'nitro/h3';
import { z } from 'zod';
import { requireUser } from '../../../utils/auth';
import { query } from '../../../utils/db';
import { endpointHash, requirePushOrigin } from '../../../utils/phoneNotifications';
export default defineHandler(async event => {
  const user = await requireUser(event); requirePushOrigin(event); assertBodySize(event, 8192);
  const body = z.object({ endpoint: z.string().min(1).max(4096) }).safeParse(await readBody(event));
  if (!body.success) throw createError({ statusCode: 400, statusMessage: 'Subscription endpoint required' });
  await query('DELETE FROM phone_push_devices WHERE user_id=$1 AND endpoint_hash=$2', [user.id, endpointHash(body.data.endpoint)]);
  return { ok: true };
});
