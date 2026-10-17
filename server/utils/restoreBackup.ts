import { createHash } from 'node:crypto';
import { createError } from 'nitro/h3';
import { canonicalBackupTables } from './buyingPriceSchema';
import { readBackupFile } from './backups';
import { withTransaction } from './db';
import { legacyFinancialFields, lockFinancialState, putState, stableFinancialJSON, stateValue } from './financialState';

const reject = (message: string): never => {throw createError({statusCode:409,statusMessage:message});};
const rowHash = (row: unknown) => createHash('sha256').update(stableFinancialJSON(row)).digest('hex');
const wireRows = (rows:Array<Record<string,unknown>>) => JSON.parse(JSON.stringify(rows.map((row)=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,Buffer.isBuffer(value)?{base64:value.toString('base64')}:value]))))) as Array<Record<string,unknown>>;
const mutableKeys:Record<string,string> = {customers:'id',scrap_buying_tickets:'ticket_id',scrap_buying_cycles:'id',scrap_buying_passes:'id',price_sheet_drafts:'id',price_sheet_active:'singleton'};

export async function restoreServerBackup(fileName: string,userId: string) {
  const file = await readBackupFile(fileName,128*1024*1024);
  if (!file) throw createError({statusCode:404,statusMessage:'Backup file not found'});
  if (file.sizeBytes>128*1024*1024) reject('Snapshot is too large for in-app restore. Use the yard’s database recovery procedure.');
  const backup = JSON.parse(file.content) as {meta:{format:string;checksum:string};state:Record<string,unknown>;tables:Record<string,Array<Record<string,unknown>>>};
  if (backup.meta?.format!=='mahaffeys-app-state-v2' || !backup.state || !backup.tables || canonicalBackupTables.some((table)=>!Array.isArray(backup.tables[table]))) reject('Restore requires a complete v2 server snapshot containing buying, customer and price-sheet tables. Workstation JSON exports are not financial/database backups.');
  const checksum = createHash('sha256').update(JSON.stringify({state:backup.state,tables:backup.tables})).digest('hex');
  if (checksum!==backup.meta.checksum) reject('Backup checksum failed; nothing was restored');
  return withTransaction(async (client) => {
    await lockFinancialState(client);
    await client.query('SELECT pg_advisory_xact_lock(114682)');
    const slot = await client.query('SELECT pg_try_advisory_xact_lock(114681) AS acquired');
    if (!slot.rows[0].acquired) reject('Wait for active PDF extraction to finish before restoring');
    for (const table of canonicalBackupTables) {
      if (mutableKeys[table]) continue;
      const current = wireRows((await client.query(`SELECT * FROM "${table}"`)).rows);
      const hashes = new Set(backup.tables[table].map(rowHash));
      if (current.some((row)=>!hashes.has(rowHash(row)))) reject(`Restore would lose or change immutable ${table} evidence. Use a newer snapshot; confirmed payments/audit history cannot be rolled back.`);
    }
    const currentTickets = await stateValue<Array<Record<string,unknown>>>(client,'mahaffeys_tickets',[]);
    const restoredTickets = backup.state.mahaffeys_tickets;
    for (const current of currentTickets.filter((ticket)=>!ticket.buying && ['COMPLETED','VOIDED'].includes(String(ticket.status)))) {
      const restored = Array.isArray(restoredTickets)?restoredTickets.find((ticket)=>ticket.id===current.id):null;
      if (!restored || restored.status!==current.status || legacyFinancialFields.some((key)=>stableFinancialJSON(current[key])!==stableFinancialJSON(restored[key])) || current.checkNumber!==restored.checkNumber) reject('Restore would reopen or change historical completed/voided financial evidence. Reconcile against real cash/check records first.');
    }
    const drawer = await stateValue<Array<Record<string,unknown>>>(client,'mahaffeys_cash_drawer',[]);
    const restoredDrawer = Array.isArray(backup.state.mahaffeys_cash_drawer)?backup.state.mahaffeys_cash_drawer:[];
    const drawerHashes = new Set(restoredDrawer.map(rowHash));
    if (drawer.some((row)=>!drawerHashes.has(rowHash(row)))) reject('Restore would remove recorded cash-drawer evidence. Use a newer snapshot.');
    for (const table of canonicalBackupTables) {
      const columns = (await client.query('SELECT column_name,data_type FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1',[table])).rows;
      const validColumns = new Set(columns.map((row)=>row.column_name));
      const jsonColumns = new Set(columns.filter((row)=>['json','jsonb'].includes(row.data_type)).map((row)=>row.column_name));
      for (const row of backup.tables[table]) {
        const keys=Object.keys(row);
        if (!keys.length || keys.some((key)=>!validColumns.has(key))) reject(`Invalid ${table} snapshot columns`);
        const values = keys.map((key)=>table==='price_sheet_documents' && key==='content'?Buffer.from((row[key] as {base64:string}).base64,'base64'):jsonColumns.has(key)?JSON.stringify(row[key]):row[key]);
        const conflictKey = mutableKeys[table];
        const conflict = conflictKey?`ON CONFLICT("${conflictKey}") DO UPDATE SET ${keys.filter((key)=>key!==conflictKey).map((key)=>`"${key}"=EXCLUDED."${key}"`).join(',')}`:'ON CONFLICT DO NOTHING';
        await client.query(`INSERT INTO "${table}" (${keys.map((key)=>`"${key}"`).join(',')}) VALUES(${keys.map((_,index)=>`$${index+1}`).join(',')}) ${conflict}`,values);
      }
    }
    const inconsistent = await client.query(`SELECT p.ticket_id FROM scrap_buying_payments p JOIN scrap_buying_tickets t ON t.ticket_id=p.ticket_id
      WHERE t.stage<>'PAID' OR t.document->'buying'->'payment'->>'id' IS DISTINCT FROM p.id::text OR (t.document->>'finalPayout')::numeric<>p.amount`);
    if (inconsistent.rows.length) reject('Snapshot payment/ticket evidence is inconsistent; nothing was restored');
    for (const [key,value] of Object.entries(backup.state)) {
      if (!key.startsWith('mahaffeys_')) reject('Unexpected snapshot state key');
      let restored = value;
      if (key==='mahaffeys_tickets') {
        const canonical = (await client.query('SELECT ticket_id,document FROM scrap_buying_tickets')).rows;
        const ids = new Set(canonical.map((row)=>row.ticket_id));
        restored = [...(Array.isArray(value)?value:[]).filter((row)=>!ids.has(row.id)),...canonical.map((row)=>row.document)];
      } else if (key==='mahaffeys_cash_drawer') {
        const payments = (await client.query('SELECT drawer_entry_id,document FROM scrap_buying_payments WHERE drawer_entry_id IS NOT NULL')).rows;
        const ids = new Set(payments.map((row)=>row.drawer_entry_id));
        restored = [...(Array.isArray(value)?value:[]).filter((row)=>!ids.has(row.id)),...payments.map((row)=>row.document.drawerEntry)].sort((a,b)=>String(a.timestamp).localeCompare(String(b.timestamp)));
      }
      await putState(client,key,restored,userId);
    }
    return {restored:true,tableCount:canonicalBackupTables.length};
  });
}
