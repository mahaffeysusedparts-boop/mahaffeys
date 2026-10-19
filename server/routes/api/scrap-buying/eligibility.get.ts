import { defineHandler } from 'nitro';
import { getQuery, createError } from 'nitro/h3';
import { z } from 'zod';
import { buyingUser, previewPaymentEligibility } from '../../../utils/scrapBuying';

export default defineHandler(async event => {
  const user = await buyingUser(event);
  const parsed = z.object({ id: z.string().trim().min(1).max(120), revision: z.coerce.number().int().nonnegative() }).safeParse(getQuery(event));
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Valid ticket ID and revision required' });
  return previewPaymentEligibility(parsed.data.id, parsed.data.revision, user);
});
