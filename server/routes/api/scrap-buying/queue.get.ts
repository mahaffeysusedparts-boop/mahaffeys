import { defineHandler } from 'nitro';
import { buyingUser, currentBuyingPolicy } from '../../../utils/scrapBuying';
import { query } from '../../../utils/db';

export default defineHandler(async (event) => {
  await buyingUser(event);
  const tickets = await query('SELECT document FROM scrap_buying_tickets ORDER BY updated_at DESC LIMIT 500');
  return {tickets:tickets.rows.map((row) => row.document),policy:await currentBuyingPolicy()};
});
