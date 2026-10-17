import { randomUUID } from 'node:crypto';
import { defineHandler } from 'nitro';
import { readBody, createError } from 'nitro/h3';
import { requireAdmin } from '../../../utils/auth';
import { withTransaction } from '../../../utils/db';
import { lockFinancialState } from '../../../utils/financialState';
import { policySchema } from '../../../utils/scrapBuying';

export default defineHandler(async (event) => {
  const user = await requireAdmin(event);
  const body = policySchema.safeParse(await readBody(event,{limit:128*1024}));
  if (!body.success) throw createError({statusCode:400,statusMessage:body.error.issues[0]?.message ?? 'Invalid policy'});
  const version = randomUUID();
  await withTransaction(async (client) => {
    await lockFinancialState(client);
    await client.query('INSERT INTO scrap_buying_policies(version,document,created_by) VALUES($1,$2::jsonb,$3)',[version,JSON.stringify(body.data),user.id]);
  });
  return {...body.data,version};
});
