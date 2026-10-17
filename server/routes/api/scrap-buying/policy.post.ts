import { randomUUID } from 'node:crypto';
import { defineHandler } from 'nitro';
import { assertBodySize, readBody, createError } from 'nitro/h3';
import { requireAdmin } from '../../../utils/auth';
import { withTransaction } from '../../../utils/db';
import { lockFinancialState } from '../../../utils/financialState';
import { policySchema } from '../../../utils/scrapBuying';

export default defineHandler(async (event) => {
  const user = await requireAdmin(event);
  assertBodySize(event, 128*1024);
  const body = policySchema.safeParse(await readBody(event));
  if (!body.success) throw createError({statusCode:400,statusMessage:body.error.issues[0]?.message ?? 'Invalid policy'});
  const version = randomUUID();
  await withTransaction(async (client) => {
    await lockFinancialState(client);
    const metals=(await client.query("SELECT value FROM app_state WHERE key='mahaffeys_metals'")).rows[0]?.value ?? [];
    body.data.grades=body.data.grades.map((grade)=>{
      const metal=metals.find((row:{id:string})=>row.id===grade.gradeId);
      if (!metal) throw createError({statusCode:400,statusMessage:'Policy refers to an unknown grade'});
      return {...grade,definition:{name:metal.name,code:metal.code,category:metal.category}};
    });
    await client.query('INSERT INTO scrap_buying_policies(version,document,created_by) VALUES($1,$2::jsonb,$3)',[version,JSON.stringify(body.data),user.id]);
  });
  return {...body.data,version};
});
