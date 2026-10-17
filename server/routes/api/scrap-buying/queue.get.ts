import { defineHandler } from 'nitro';
import { buyingUser, currentBuyingPolicy } from '../../../utils/scrapBuying';
import { query } from '../../../utils/db';

export default defineHandler(async (event) => {
  await buyingUser(event);
  const tickets = await query("SELECT document FROM scrap_buying_tickets ORDER BY CASE WHEN stage IN ('DRAFT','FINALIZED') THEN 0 ELSE 1 END,updated_at DESC LIMIT 500");
  const reviews=await query('SELECT DISTINCT ON(ticket_id) document FROM scrap_buying_legacy_reviews ORDER BY ticket_id,revision DESC');
  return {tickets:tickets.rows.map((row) => row.document),policy:await currentBuyingPolicy(),legacyReviews:reviews.rows.map((row)=>row.document)};
});
