import { defineHandler } from 'nitro';
import { assertBodySize, readBody, createError } from 'nitro/h3';
import { z } from 'zod';
import { requireAdmin } from '../../../utils/auth';
import { auditFor, recordAudit } from '../../../utils/audit';
import { withTransaction } from '../../../utils/db';
import { lockFinancialState, putState, stateValue } from '../../../utils/financialState';
import { DEFAULT_PAYMENT_SAFEGUARDS, normalizePaymentSafeguards, type PaymentSafeguards } from '../../../../src/types/paymentSafeguards';

export default defineHandler(async event => {
  const user = await requireAdmin(event);
  assertBodySize(event, 4096);
  const parsed = z.object({ enabled: z.boolean(), revision: z.number().int().nonnegative(), reason: z.string().trim().min(1).max(500) }).strict().safeParse(await readBody(event));
  if (!parsed.success) throw createError({ statusCode:400, statusMessage:'Choose the safeguard state and enter a reason' });
  const saved = await withTransaction(async client => {
    await lockFinancialState(client);
    const current = normalizePaymentSafeguards(await stateValue<PaymentSafeguards>(client,'mahaffeys_payment_safeguards',DEFAULT_PAYMENT_SAFEGUARDS));
    if (parsed.data.revision !== current.revision) throw createError({ statusCode:409, statusMessage:'Safeguards changed on another workstation. Reload before saving.' });
    const next: PaymentSafeguards = { ...parsed.data, revision:current.revision+1, updatedAt:new Date().toISOString(), updatedBy:user.fullName };
    await putState(client,`mahaffeys_payment_safeguards_revision_${next.revision}`,next,user.id);
    await putState(client,'mahaffeys_payment_safeguards',next,user.id);
    return next;
  });
  await recordAudit(auditFor(user,{action:'buying.safeguards.change',entity:'app_state',entityId:'mahaffeys_payment_safeguards',detail:{...saved}}));
  return saved;
});
