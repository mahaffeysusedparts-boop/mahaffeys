import { defineHandler } from 'nitro';
import { buyingUser } from '../../../utils/scrapBuying';
import { query } from '../../../utils/db';
import { normalizePaymentSafeguards } from '../../../../src/types/paymentSafeguards';

export default defineHandler(async event => {
  await buyingUser(event);
  const result = await query("SELECT value FROM app_state WHERE key='mahaffeys_payment_safeguards'");
  return normalizePaymentSafeguards(result.rows[0]?.value ?? {});
});
