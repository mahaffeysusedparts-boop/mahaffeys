import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';
import { createError, type H3Event } from 'nitro/h3';
import { z } from 'zod';
import { requireUser } from './auth';
import { getDatabase, query, withTransaction } from './db';
import { parsePriceSheetLines } from './priceSheetParser';
import { normalizePartsPrice } from '../../src/utils/partsPriceCalculations';
import type { PriceSheetDraft, PublishedPartsPrices, ReviewedPriceRow } from '../../src/types/priceSheets';
import type { PoolClient } from 'pg';

export const MAX_PDF_BYTES = 5*1024*1024;
export async function priceSheetUser(event: H3Event) {
  const user = await requireUser(event);
  if (!['admin','yard_manager'].includes(user.role)) throw createError({statusCode:403,statusMessage:'Price-sheet management requires a manager or administrator'});
  return user;
}
export const priceRowSchema = z.object({id:z.string().uuid(),category:z.string().max(120),name:z.string().max(200),
  priceKind:z.enum(['fixed','range','description']),price:z.string().max(200),unit:z.string().max(80),
  core:z.string().max(200),warranty:z.string().max(200),conditions:z.string().max(500),
  sourceText:z.string().max(1000),page:z.number().int().min(0).max(20),reviewed:z.boolean()}).strict();
export const draftEditSchema = z.object({revision:z.number().int().positive(),rows:z.array(priceRowSchema).max(500)}).strict();
export function publishableRows(rows: ReviewedPriceRow[]) {
  if (!rows.length) throw new Error('Add at least one reviewed price');
  const seen = new Set<string>();
  return rows.map((row) => {
    if (!row.reviewed || !row.name.trim() || !row.category.trim()) throw new Error('Review every row, category and part name');
    const key = `${row.category.trim().toLowerCase()}|${row.name.trim().toLowerCase()}|${row.unit.trim().toLowerCase()}|${row.conditions.trim().toLowerCase()}`;
    if (seen.has(key)) throw new Error('Duplicate part/category/unit/condition row; correct or remove it');
    seen.add(key);
    return {...row,name:row.name.trim(),category:row.category.trim(),price:normalizePartsPrice(row.priceKind,row.price)};
  });
}
export async function getDraft(id: string): Promise<PriceSheetDraft> {
  await query(`UPDATE price_sheet_drafts SET status='FAILED',error='Processing was interrupted. Retry extraction or manually correct the draft.',updated_at=NOW()
    WHERE id=$1 AND status='PROCESSING' AND updated_at<NOW()-INTERVAL '60 seconds'`,[id]);
  const result = await query(`SELECT d.id,d.file_name,s.revision,s.status,s.rows,s.warnings,s.extracted_text,s.error
    FROM price_sheet_documents d JOIN price_sheet_drafts s ON s.id=d.id WHERE d.id=$1`,[id]);
  const row = result.rows[0];
  if (!row) throw createError({statusCode:404,statusMessage:'Price-sheet draft not found'});
  return {id:row.id,fileName:row.file_name,revision:row.revision,status:row.status,rows:row.rows,warnings:row.warnings,extractedText:row.extracted_text,error:row.error};
}

const extractionCode = `
const {parentPort,workerData} = require('node:worker_threads');
(async () => {
 const {getDocumentProxy} = require(workerData.modulePath);
 const pdf = await getDocumentProxy(new Uint8Array(workerData.bytes),{isEvalSupported:false,disableFontFace:true,maxImageSize:0,useSystemFonts:false,stopAtErrors:true});
 try {
  if(pdf.numPages>20) throw new Error('PDF exceeds the 20-page limit. Split the document before upload.');
  const lines=[];let length=0;
  for(let number=1;number<=pdf.numPages;number++) {
   const page=await pdf.getPage(number);const content=await page.getTextContent();
   if(content.items.length>20000) throw new Error('PDF page is too complex. Upload a simpler exported price sheet.');
   const items=content.items.filter(item => typeof item.str==='string' && item.transform).sort((a,b)=>b.transform[5]-a.transform[5] || a.transform[4]-b.transform[4]);
   let current=[];let y=null;
   const flush=()=>{if(current.length){const text=current.sort((a,b)=>a.transform[4]-b.transform[4]).map(item=>item.str).join(' ').trim();length+=text.length;if(length>1000000)throw new Error('Extracted text exceeds limit. Split the document.');if(text)lines.push({page:number,text});current=[];}};
   for(const item of items){if(y!==null && Math.abs(item.transform[5]-y)>2)flush();if(!current.length)y=item.transform[5];current.push(item);}
   flush();page.cleanup();
  }
  parentPort.postMessage({lines});
 } finally {await pdf.destroy();}
})().catch(error=>parentPort.postMessage({error:error.message || 'PDF extraction failed'}));
`;

export async function extractPDF(bytes: Buffer): Promise<Array<{page:number;text:string}>> {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('PDF extraction requires Node 22+. Manual review/transcription remains available.');
  const modulePath = createRequire(import.meta.url).resolve('unpdf');
  const worker = new Worker(extractionCode,{eval:true,workerData:{bytes,modulePath},resourceLimits:{maxOldGenerationSizeMb:192,maxYoungGenerationSizeMb:32}});
  try {
    return await new Promise((resolve,reject) => {
      const timer = setTimeout(() => reject(new Error('PDF extraction timed out after 30 seconds. Upload a smaller text-based PDF or transcribe manually.')),30000);
      worker.once('message',(message: {lines?:Array<{page:number;text:string}>;error?:string}) => {clearTimeout(timer);message.error?reject(new Error(message.error)):resolve(message.lines ?? []);});
      worker.once('error',(error) => {clearTimeout(timer);reject(new Error(`PDF runtime failure: ${error.message}. Manual transcription is available.`));});
      worker.once('exit',() => {clearTimeout(timer);reject(new Error('PDF worker stopped before returning a result. Upload a simpler document or transcribe manually.'));});
    });
  } finally { await worker.terminate(); }
}

async function extractionSlot(client: PoolClient) {
  const lock = await client.query('SELECT pg_try_advisory_lock(114681) AS acquired');
  if (!lock.rows[0].acquired) throw createError({statusCode:429,statusMessage:'Another PDF is processing. Retry when its review draft is ready.'});
}
async function processPDF(id: string,bytes: Buffer) {
  try {
    const lines = await extractPDF(bytes);
    const {rows,warnings} = parsePriceSheetLines(lines);
    await query(`UPDATE price_sheet_drafts SET status='REVIEW',rows=$2::jsonb,warnings=$3::jsonb,extracted_text=$4,error=NULL,updated_at=NOW() WHERE id=$1`,[id,JSON.stringify(rows),JSON.stringify(warnings),lines.map((line) => `[Page ${line.page}] ${line.text}`).join('\n')]);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0,1000) : 'Extraction failed';
    await query(`UPDATE price_sheet_drafts SET status='FAILED',error=$2,warnings=$3::jsonb,updated_at=NOW() WHERE id=$1`,[id,message,JSON.stringify(['Extraction failed. The previous published prices remain live. Retry or manually transcribe the original PDF.'])]);
  }
  await query(`INSERT INTO price_sheet_draft_revisions(document_id,revision,rows,warnings,status,actor_id)
    SELECT s.id,s.revision,s.rows,s.warnings,s.status,d.uploaded_by FROM price_sheet_drafts s JOIN price_sheet_documents d ON d.id=s.id WHERE s.id=$1 ON CONFLICT DO NOTHING`,[id]);
  return getDraft(id);
}
export async function importPriceSheet(fileName: string,bytes: Buffer,userId: string) {
  if (!bytes.length || bytes.length > MAX_PDF_BYTES || bytes.subarray(0,5).toString() !== '%PDF-') throw createError({statusCode:400,statusMessage:'Upload a valid PDF, maximum 5 MB and 20 pages'});
  const client = await (await getDatabase()).connect();
  let acquired = false;
  try {
    await extractionSlot(client);acquired = true;
    const id = randomUUID();
    await withTransaction(async (transaction) => {
      await transaction.query('INSERT INTO price_sheet_documents(id,file_name,content,byte_size,sha256,uploaded_by) VALUES($1,$2,$3,$4,$5,$6)',[id,fileName.slice(0,200),bytes,bytes.length,createHash('sha256').update(bytes).digest('hex'),userId]);
      await transaction.query("INSERT INTO price_sheet_drafts(id,status) VALUES($1,'PROCESSING')",[id]);
    });
    return await processPDF(id,bytes);
  } finally {if(acquired)await client.query('SELECT pg_advisory_unlock(114681)');client.release();}
}
export async function retryPriceSheet(id: string,revision: number) {
  const client = await (await getDatabase()).connect(); let acquired = false;
  try {
    await extractionSlot(client);acquired = true;
    const bytes = await withTransaction(async (transaction) => {
      const result = await transaction.query('SELECT s.revision,s.status,d.content FROM price_sheet_drafts s JOIN price_sheet_documents d ON d.id=s.id WHERE s.id=$1 FOR UPDATE',[id]);
      const row = result.rows[0];
      if (!row || row.revision!==revision || row.status==='PROCESSING') throw createError({statusCode:409,statusMessage:'Draft changed or is still processing. Refresh before retrying.'});
      await transaction.query("UPDATE price_sheet_drafts SET status='PROCESSING',revision=revision+1,error=NULL,updated_at=NOW() WHERE id=$1",[id]);
      return row.content as Buffer;
    });
    return await processPDF(id,bytes);
  } finally {if(acquired)await client.query('SELECT pg_advisory_unlock(114681)');client.release();}
}

export async function publicPartsPrices(): Promise<PublishedPartsPrices> {
  const result = await query('SELECT v.id,v.rows,a.updated_at FROM price_sheet_active a JOIN price_sheet_versions v ON v.id=a.version_id');
  const version = result.rows[0];
  if (version) return {version:version.id,publishedAt:new Date(version.updated_at).toISOString(),legacy:false,rows:version.rows.map((row:ReviewedPriceRow) => ({id:row.id,category:row.category,name:row.name,priceKind:row.priceKind,price:row.price,unit:row.unit,core:row.core,warranty:row.warranty,conditions:row.conditions}))};
  const legacy = await query("SELECT value FROM app_state WHERE key='mahaffeys_pull_parts'");
  const value = legacy.rows[0]?.value;
  return {version:null,publishedAt:null,legacy:true,rows:Array.isArray(value)?value.filter((row) => row && typeof row.partName==='string' && typeof row.price==='number' && Number.isFinite(row.price) && row.price>=0).map((row) => ({id:String(row.id),name:row.partName,category:typeof row.category==='string'?row.category:'Uncategorized',priceKind:'fixed',price:row.price.toFixed(2),core:typeof row.coreDeposit==='number'&&Number.isFinite(row.coreDeposit)?`$${row.coreDeposit.toFixed(2)}`:'',warranty:typeof row.warrantyFee==='number'&&Number.isFinite(row.warrantyFee)?row.warrantyFee>0?`$${row.warrantyFee.toFixed(2)} fee`:'Included':'',unit:'each',conditions:typeof row.interchangeNotes==='string'?row.interchangeNotes:''})):[]};
}
