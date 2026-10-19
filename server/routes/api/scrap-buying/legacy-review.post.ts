import { defineHandler } from 'nitro';
import { assertBodySize, readBody,createError } from 'nitro/h3';
import { z } from 'zod';
import { buyingUser } from '../../../utils/scrapBuying';
import { withTransaction } from '../../../utils/db';
import { lockFinancialState,stateValue } from '../../../utils/financialState';
import type { Ticket } from '../../../../src/types/scrap';
import type { LegacyBuyingReview } from '../../../../src/types/buyingPayments';

export default defineHandler(async(event)=>{
  const user=await buyingUser(event);
  if (!['admin','yard_manager'].includes(user.role)) throw createError({statusCode:403,statusMessage:'Manager or administrator access is required for historical reconciliation'});
  assertBodySize(event, 8192);
  const body=z.object({ticketId:z.string().min(1).max(120),revision:z.number().int().nonnegative(),disbursed:z.boolean(),method:z.enum(['Cash','Check']).optional(),paidAt:z.string().datetime({offset:true}).optional(),evidenceReference:z.string().trim().min(1).max(500),idType:z.string().trim().min(1).max(80),idState:z.string().trim().min(1).max(12),idNumber:z.string().trim().min(1).max(120),reviewed:z.literal(true)}).safeParse(await readBody(event));
  if(!body.success)throw createError({statusCode:400,statusMessage:'Verified identity, external cash/check evidence and explicit review are required'});
  return withTransaction(async(client)=>{
    await lockFinancialState(client);
    const ticket=(await stateValue<Ticket[]>(client,'mahaffeys_tickets',[])).find(row=>row.id===body.data.ticketId);
    if(!ticket||ticket.buying||ticket.ticketType!=='SCRAP_METAL'||!['COMPLETED','VOIDED'].includes(ticket.status))throw createError({statusCode:409,statusMessage:'Only historical terminal scrap tickets can be reconciled here'});
    if(ticket.customerIdNumber&&ticket.customerIdNumber.trim().toUpperCase()!==body.data.idNumber.toUpperCase())throw createError({statusCode:409,statusMessage:'ID number conflicts with the historical ticket'});
    if(body.data.disbursed&&(!body.data.method||!body.data.paidAt||Date.parse(body.data.paidAt)>Date.now()+300000))throw createError({statusCode:400,statusMessage:'Record the actual historical payment method and date, not a future payment'});
    const revision=Number((await client.query('SELECT COALESCE(MAX(revision),0) AS revision FROM scrap_buying_legacy_reviews WHERE ticket_id=$1',[ticket.id])).rows[0].revision);
    if(revision!==body.data.revision)throw createError({statusCode:409,statusMessage:'Another reviewer changed this evidence; refresh before correcting it'});
    const document:LegacyBuyingReview={ticketId:ticket.id,revision:revision+1,disbursed:body.data.disbursed,method:body.data.disbursed?body.data.method:undefined,paidAt:body.data.disbursed?body.data.paidAt:undefined,amount:ticket.finalPayout,evidenceReference:body.data.evidenceReference,sellerIdentity:{idType:body.data.idType.toUpperCase(),idState:body.data.idState.toUpperCase(),idNumber:body.data.idNumber.toUpperCase()},reviewedBy:user.fullName,reviewedAt:new Date().toISOString()};
    await client.query('INSERT INTO scrap_buying_legacy_reviews(ticket_id,revision,document,actor_id) VALUES($1,$2,$3::jsonb,$4)',[ticket.id,document.revision,JSON.stringify(document),user.id]);
    return document;
  });
});
