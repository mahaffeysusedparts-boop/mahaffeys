import { defineHandler } from 'nitro';
import { assertBodySize, readBody, createError, setResponseHeader } from 'nitro/h3';
import { z } from 'zod';
import { buyingUser } from '../../../utils/scrapBuying';
import { withTransaction } from '../../../utils/db';
import { ensureIntakeOwnership, lockIntakeOwnership } from '../../../utils/intakeOwnership';

const schema = z.object({ ticketId: z.string().trim().min(1).max(120), clientId: z.string().uuid(),
  action: z.enum(['CLAIM', 'RENEW', 'RELEASE']), replaceClientId: z.string().uuid().optional() }).strict();
export default defineHandler(async event => {
  const user = await buyingUser(event);
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  await assertBodySize(event, 4096);
  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid ownership request' });
  const body = parsed.data;
  await ensureIntakeOwnership();
  return withTransaction(async client => {
    await lockIntakeOwnership(client, body.ticketId);
    const existing = (await client.query(`SELECT user_id AS "userId", operator_name AS "operatorName",
      client_id AS "clientId", expires_at AS "expiresAt" FROM intake_ownership WHERE ticket_id=$1 AND expires_at>clock_timestamp()`, [body.ticketId])).rows[0];
    const mine = existing?.clientId === body.clientId && existing?.userId === user.id;
    if (body.action === 'RELEASE') {
      if (mine) await client.query('DELETE FROM intake_ownership WHERE ticket_id=$1', [body.ticketId]);
      return { claimed: false, owner: mine ? null : existing ?? null };
    }
    if (body.action === 'RENEW' && !mine) return { claimed: false, owner: existing ?? null };
    if (existing && !mine && body.replaceClientId !== existing.clientId) return { claimed: false, owner: existing };
    const canonical = (await client.query('SELECT stage FROM scrap_buying_tickets WHERE ticket_id=$1', [body.ticketId])).rows[0];
    if (canonical && canonical.stage !== 'DRAFT') throw createError({ statusCode: 409, statusMessage: 'This intake is no longer pending' });
    if (!canonical) {
      const state = (await client.query("SELECT value FROM app_state WHERE key='mahaffeys_tickets'")).rows[0]?.value;
      if (!Array.isArray(state) || !state.some(ticket => ticket.id === body.ticketId && ticket.ticketType === 'SCRAP_METAL' && ticket.status === 'PENDING')) {
        throw createError({ statusCode: 404, statusMessage: 'Pending intake not found' });
      }
    }
    const result = await client.query(`INSERT INTO intake_ownership(ticket_id,user_id,operator_name,client_id,expires_at)
      VALUES($1,$2,$3,$4,clock_timestamp()+INTERVAL '90 seconds') ON CONFLICT(ticket_id) DO UPDATE
      SET user_id=EXCLUDED.user_id,operator_name=EXCLUDED.operator_name,client_id=EXCLUDED.client_id,expires_at=EXCLUDED.expires_at
      RETURNING ticket_id AS "ticketId",user_id AS "userId",operator_name AS "operatorName",client_id AS "clientId",expires_at AS "expiresAt"`,
    [body.ticketId, user.id, user.fullName, body.clientId]);
    return { claimed: true, owner: result.rows[0] };
  });
});
