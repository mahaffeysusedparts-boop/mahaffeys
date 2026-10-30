import { defineHandler } from 'nitro';
import { buyingUser } from '../../../utils/scrapBuying';
import { query } from '../../../utils/db';
import { ensureIntakeOwnership } from '../../../utils/intakeOwnership';

export default defineHandler(async event => {
  await buyingUser(event);
  await ensureIntakeOwnership();
  const result = await query(`SELECT ticket_id AS "ticketId", user_id AS "userId",
    operator_name AS "operatorName", client_id AS "clientId", expires_at AS "expiresAt"
    FROM intake_ownership WHERE expires_at > NOW()`);
  return result.rows;
});
