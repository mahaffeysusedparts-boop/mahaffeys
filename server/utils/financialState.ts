import type { PoolClient } from 'pg';
import { createError } from 'nitro/h3';

export async function lockFinancialState(client: PoolClient) {
  await client.query('SELECT pg_advisory_xact_lock(114680)');
}
export async function stateValue<T>(client: PoolClient, key: string, fallback: T): Promise<T> {
  const result = await client.query('SELECT value FROM app_state WHERE key=$1', [key]);
  return result.rows[0]?.value ?? fallback;
}
export async function putState(client: PoolClient, key: string, value: unknown, userId: string) {
  await client.query(`INSERT INTO app_state(key,value,updated_at,updated_by) VALUES($1,$2::jsonb,NOW(),$3)
    ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=EXCLUDED.updated_at,updated_by=EXCLUDED.updated_by`, [key, JSON.stringify(value), userId]);
}
const conflict = (message: string): never => {throw createError({statusCode:409,statusMessage:message});};
export function stableFinancialJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableFinancialJSON).join(',')}]`;
  if (value && typeof value==='object') return `{${Object.keys(value).sort().filter((key)=>(value as Record<string,unknown>)[key]!==undefined).map((key)=>`${JSON.stringify(key)}:${stableFinancialJSON((value as Record<string,unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export const legacyFinancialFields = ['ticketType','createdAt','customerId','customerIdNumber','grossTotal','totalDeductions','finalPayout','payoutMethod','scrapLines'] as const;

// All generic sync/chunk/import paths share the same lock as buying commands.
// Protected records omitted by an evicted/stale cache are retained, not deleted.
export async function protectFinancialState(client: PoolClient, key: string, incoming: unknown, actorRole: string) {
  if (key !== 'mahaffeys_tickets' && key !== 'mahaffeys_cash_drawer') return incoming;
  await lockFinancialState(client);
  if (!Array.isArray(incoming) || incoming.some((row)=>!row || typeof row!=='object' || typeof row.id!=='string') || new Set(incoming.map((row)=>row.id)).size!==incoming.length) throw createError({statusCode:400,statusMessage:'Financial state requires uniquely identified records'});
  const manager = ['admin','yard_manager'].includes(actorRole);
  if (key === 'mahaffeys_tickets') {
    const canonical = await client.query('SELECT ticket_id,document FROM scrap_buying_tickets');
    const known = new Set(canonical.rows.map((row) => row.ticket_id));
    const rows = incoming.filter((row) => !known.has(row.id));
    if (rows.some((row) => row.buying)) conflict('Canonical tickets must use the buying API');
    const previous = await stateValue<Array<Record<string,unknown>>>(client,key,[]);
    const previousIds = new Set(previous.map((row) => row.id));
    if (rows.some((row) => row.ticketType==='SCRAP_METAL' && !previousIds.has(row.id))) conflict('New scrap tickets must use the buying API');
    for (const old of previous.filter((row)=>!known.has(String(row.id)) && row.ticketType==='SCRAP_METAL' && row.status==='PENDING')) {
      const next=rows.find((row)=>row.id===old.id);
      if (!next) rows.push(old);
      else if (stableFinancialJSON(next)!==stableFinancialJSON(old)) conflict('Resume open legacy scrap through the canonical buying workflow before editing or finalizing');
    }
    for (const old of previous.filter((row)=>!known.has(String(row.id)) && ['COMPLETED','VOIDED'].includes(String(row.status)))) {
      const next = rows.find((row)=>row.id===old.id);
      if (!next) {rows.push(old);continue;}
      if (!['COMPLETED','VOIDED'].includes(next.status) || (old.status==='VOIDED' && next.status!=='VOIDED')) conflict('Historical terminal tickets cannot become open/unpaid through sync or restore');
      if (legacyFinancialFields.some((field)=>stableFinancialJSON(old[field])!==stableFinancialJSON(next[field])) || (old.checkNumber && old.checkNumber!==next.checkNumber)) conflict('Historical financial meaning cannot be replaced by generic state writes');
      if (old.status!==next.status && !manager) throw createError({statusCode:403,statusMessage:'A manager must void a historical completed ticket'});
    }
    return [...rows,...canonical.rows.map((row)=>row.document)];
  }
  if (!manager) throw createError({statusCode:403,statusMessage:'Cash drawer writes require a manager or administrator'});
  const payments = await client.query('SELECT drawer_entry_id,document FROM scrap_buying_payments WHERE drawer_entry_id IS NOT NULL');
  const ids = new Set(payments.rows.map((row)=>row.drawer_entry_id));
  const canonicalTicketIds = new Set((await client.query('SELECT ticket_id FROM scrap_buying_tickets')).rows.map((row)=>row.ticket_id));
  const rows = incoming.filter((row)=>!ids.has(row.id));
  if (rows.some((row)=>row.type==='PAYOUT_DISBURSEMENT' && canonicalTicketIds.has(row.ticketId))) conflict('Canonical ticket payments cannot be created by generic drawer writes');
  const previous = await stateValue<Array<Record<string,unknown>>>(client,key,[]);
  const legacyPayouts = previous.filter((row)=>row.type==='PAYOUT_DISBURSEMENT' && !ids.has(row.id));
  const protectedIds = new Set(legacyPayouts.map((row)=>row.id));
  return [...rows.filter((row)=>!protectedIds.has(row.id)),...legacyPayouts,...payments.rows.map((row)=>row.document.drawerEntry)].sort((a,b)=>String(a.timestamp).localeCompare(String(b.timestamp)));
}
