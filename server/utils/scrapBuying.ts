import { createHash, randomUUID } from 'node:crypto';
import { createError, type H3Event } from 'nitro/h3';
import { z } from 'zod';
import { requireUser, type PublicUser } from './auth';
import { query, withTransaction } from './db';
import { lockFinancialState, putState, stateValue } from './financialState';
import { serverScale } from './scale';
import { normalizeWeight, validateScaleReading, validatedBreakdown } from '../../src/utils/weighingContract';
import type { Ticket, MetalGrade, ScaleConfig, CashDrawerLog } from '../../src/types/scrap';
import type { BuyingPolicy } from '../../src/types/buyingPayments';
import type { PoolClient } from 'pg';

const fail = (message: string, code = 409): never => { throw createError({ statusCode: code, statusMessage: message }); };
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().filter((key) => (value as Record<string, unknown>)[key] !== undefined).map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
};
const equal = (a: unknown, b: unknown) => canonical(a) === canonical(b);
const weight = z.number().finite().nonnegative().max(1000000000);
const captureSchema = z.object({ id: z.string().uuid(), scaleId: z.string().max(120).nullable(), originalWeight: weight,
  originalUnit: z.enum(['LBS','KG']), normalizedLbs: weight, actorId: z.string(), capturedAt: z.string().datetime(),
  stable: z.boolean(), source: z.enum(['SCALE','MANUAL']), replacesCaptureId: z.string().uuid().optional() }).strict();
export const buyingCommandSchema = z.object({
  action: z.enum(['CREATE','ADOPT','SAVE','FINALIZE','PAY','VOID']), id: z.string().trim().min(1).max(120),
  revision: z.number().int().nonnegative(), idempotencyKey: z.string().uuid(),
  ticket: z.record(z.unknown()).optional(), method: z.enum(['Cash','Check']).optional(),
  reference: z.string().trim().max(120).optional(), permitReference: z.string().trim().max(200).optional(),
  reason: z.string().trim().max(500).optional(), reviewed: z.boolean().optional(),
});
export const policySchema = z.object({ sourceUrl: z.string().url().refine((url) => url.startsWith('https://'), 'HTTPS policy source required'),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), effectiveThrough: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reviewer: z.string().trim().min(1).max(200), reviewReference: z.string().trim().min(1).max(500),
  grades: z.array(z.object({ gradeId: z.string().min(1).max(120), classification: z.string().trim().min(1).max(200),
    approved: z.boolean(), requirePermit: z.boolean(), cashAtOrAboveCents: z.number().int().nonnegative().max(100000000).nullable(),
    sellerDayCashLimitCents: z.number().int().nonnegative().max(100000000).nullable() })).min(1).max(500),
}).strict().superRefine((policy, context) => {
  if (!Number.isFinite(Date.parse(policy.effectiveFrom)) || !Number.isFinite(Date.parse(policy.effectiveThrough)) || policy.effectiveFrom > policy.effectiveThrough) context.addIssue({ code: 'custom', message: 'Invalid policy effective dates' });
  if (new Set(policy.grades.map((grade) => grade.gradeId)).size !== policy.grades.length) context.addIssue({ code: 'custom', message: 'Duplicate policy grade IDs' });
});

export async function buyingUser(event: H3Event, payment = false) {
  const user = await requireUser(event);
  const roles = payment ? ['admin','yard_manager'] : ['admin','yard_manager','scale_operator'];
  if (!roles.includes(user.role)) fail('Buying action is not permitted for this role', 403);
  return user;
}

async function projectTicket(client: PoolClient, ticket: Ticket, userId: string) {
  const tickets = await stateValue<Ticket[]>(client, 'mahaffeys_tickets', []);
  await putState(client, 'mahaffeys_tickets', [...tickets.filter((row) => row.id !== ticket.id), ticket], userId);
}

async function validateSave(client: PoolClient, previous: Ticket, submitted: Ticket, user: PublicUser): Promise<Ticket> {
  const buying = {...previous.buying!};
  if (!Array.isArray(submitted.weightTransactions ?? []) || !Array.isArray(submitted.scrapLines ?? []) || !Array.isArray(submitted.weighingCorrections ?? [])) fail('Ticket histories must be arrays',400);
  if (submitted.id !== previous.id || submitted.ticketType !== 'SCRAP_METAL') fail('Ticket identity cannot change');
  const editable = new Set(['notes','selectedWeighingType','pendingPlatformCapture','scaleGrossInWeight','scaleGrossInAt','scaleTareOutWeight','scaleTareOutAt','weightTransactions','scrapLines','weighingCorrections','buying']);
  for (const key of new Set([...Object.keys(previous), ...Object.keys(submitted)])) {
    if (!editable.has(key) && !equal(previous[key as keyof Ticket], submitted[key as keyof Ticket])) fail(`Protected ticket field: ${key}`);
  }
  if (!['PLATFORM','VEHICLE_IN_OUT', undefined].includes(submitted.selectedWeighingType)) fail('Commercial split weighing is not enabled');
  const oldTx = previous.weightTransactions ?? [];
  const tx = submitted.weightTransactions ?? [];
  if (tx.length < oldTx.length || !oldTx.every((row, index) => equal(row, tx[index]))) fail('Original captures are immutable');
  if (tx.length > oldTx.length + 1) fail('Confirm one capture at a time');
  const settings = await stateValue<{ scales?: ScaleConfig[] }>(client, 'mahaffeys_settings', {});
  const addedTx = tx.slice(oldTx.length);
  for (const row of addedTx) {
    const parsed = captureSchema.safeParse(row.capture);
    if (!parsed.success) fail('New capture requires valid original reading metadata', 400);
    const capture = parsed.data;
    if (row.id !== capture.id || row.weightLbs !== capture.normalizedLbs || row.recordedAt !== capture.capturedAt || normalizeWeight(capture.originalWeight,capture.originalUnit) !== capture.normalizedLbs) fail('Capture reading metadata conflicts');
    if (Math.abs(Date.now() - Date.parse(capture.capturedAt)) > 300000) fail('Capture expired; take a fresh reading');
    const scale = settings.scales?.find((item) => item.id === capture.scaleId);
    if (capture.scaleId && !scale) fail('Unknown scale');
    const mode = row.type === 'SINGLE_WEIGHT' ? 'PLATFORM' : 'VEHICLE_IN_OUT';
    if (scale && !(scale.supportedWeighingTypes ?? [scale.weighingMode === 'SINGLE_WEIGHT' ? 'PLATFORM' : 'VEHICLE_IN_OUT']).includes(mode)) fail('Scale is incompatible with weighing mode');
    validateScaleReading(capture.normalizedLbs, scale?.capacityLbs, scale?.resolutionLbs);
    if (capture.normalizedLbs <= 0 || capture.replacesCaptureId) fail('Use an audited cancellation and new capture for corrections');
    if (capture.source === 'SCALE') {
      const live = serverScale.getStatus();
      if (scale?.connectionType !== 'SERVER') fail('This scale source cannot be verified server-side. Use explicitly reviewed manual entry.');
      if (!live.connected || !live.updatedAt || Date.now()-Date.parse(live.updatedAt) > 5000 || !live.isStable || !capture.stable || Math.abs(normalizeWeight(live.weight,live.unit)-capture.normalizedLbs) > (scale.resolutionLbs ?? 1)) fail('Server scale reading is stale, unstable or conflicts with capture');
    }
    if (mode === 'PLATFORM') {
      if (previous.pendingPlatformCapture || previous.scaleGrossInWeight != null || submitted.pendingPlatformCapture?.capture.id !== capture.id) fail('Platform capture conflicts with unfinished weighing');
      if (submitted.pendingPlatformCapture.capturedLbs !== capture.normalizedLbs) fail('Platform gross conflicts with original capture');
      validatedBreakdown(capture.normalizedLbs, submitted.pendingPlatformCapture.tareLbs, 0, 0);
      if (!['NONE','SCALE_TARE','MANUAL'].includes(submitted.pendingPlatformCapture.tareTreatment) || (submitted.pendingPlatformCapture.tareTreatment === 'NONE' && submitted.pendingPlatformCapture.tareLbs !== 0)) fail('Invalid tare treatment');
    } else if (row.type === 'SCALE_IN') {
      if (previous.scaleGrossInWeight != null || previous.pendingPlatformCapture || submitted.scaleGrossInWeight !== capture.normalizedLbs || submitted.scaleGrossInAt !== capture.capturedAt) fail('IN capture conflicts with cycle');
    } else if (row.type === 'SCALE_OUT') {
      if (previous.scaleGrossInWeight == null || previous.scaleTareOutWeight != null || submitted.scaleTareOutWeight !== capture.normalizedLbs || submitted.scaleTareOutAt !== capture.capturedAt) fail('OUT requires its own unresolved IN');
      if (capture.normalizedLbs >= previous.scaleGrossInWeight) fail('OUT must be below IN');
    } else fail('Unknown capture purpose');
    capture.actorId = user.id;
    row.capture = capture;
    row.operatorName = user.fullName;
    if (submitted.pendingPlatformCapture) { submitted.pendingPlatformCapture.capture = capture; submitted.pendingPlatformCapture.isManual = capture.source === 'MANUAL'; }
    await client.query('INSERT INTO scrap_buying_captures(id,ticket_id,document) VALUES($1,$2,$3::jsonb)', [capture.id,previous.id,JSON.stringify(capture)]);
    let cycleId = previous.buying?.activeCycleId;
    if (row.type !== 'SCALE_OUT') {
      if (cycleId) fail('An unresolved canonical cycle already exists');
      const number = Number((await client.query('SELECT COALESCE(MAX(number),0)+1 AS next FROM scrap_buying_cycles WHERE ticket_id=$1',[previous.id])).rows[0].next);
      cycleId = randomUUID();
      await client.query('INSERT INTO scrap_buying_cycles(id,ticket_id,number,weighing_type,status,document) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[cycleId,previous.id,number,mode,mode==='PLATFORM'?'REVIEW':'AWAITING_OUT',JSON.stringify({number,mode,createdAt:new Date().toISOString()})]);
      buying.activeCycleId=cycleId;buying.cycleNumber=number;
    } else {
      const cycle = (await client.query('SELECT weighing_type,status FROM scrap_buying_cycles WHERE id=$1 AND ticket_id=$2',[cycleId,previous.id])).rows[0];
      if (!cycle || cycle.weighing_type!=='VEHICLE_IN_OUT' || cycle.status!=='AWAITING_OUT') fail('OUT requires its own canonical loaded pass; cancel and reweigh legacy unresolved pairs');
      await client.query("UPDATE scrap_buying_cycles SET status='REVIEW' WHERE id=$1",[cycleId]);
    }
    const passId = randomUUID();
    await client.query('INSERT INTO scrap_buying_passes(id,cycle_id,purpose,document) VALUES($1,$2,$3,$4::jsonb)',[passId,cycleId,row.type==='SCALE_OUT'?'TARE':'LOADED',JSON.stringify({totalLbs:capture.normalizedLbs,complete:true,reviewed:false})]);
    await client.query('INSERT INTO scrap_buying_capture_context(capture_id,cycle_id,pass_id,component_label) VALUES($1,$2,$3,$4)',[capture.id,cycleId,passId,mode==='PLATFORM'?'Platform batch':'Whole vehicle']);
  }
  const oldLines = previous.scrapLines ?? [];
  const lines = submitted.scrapLines ?? [];
  if (new Set(lines.map((line) => line.id)).size !== lines.length) fail('Duplicate payable line');
  const oldCorrections = previous.weighingCorrections ?? [];
  const corrections = submitted.weighingCorrections ?? [];
  if (corrections.length < oldCorrections.length || !oldCorrections.every((row,index) => equal(row,corrections[index]))) fail('Correction history is immutable');
  const addedCorrections = corrections.slice(oldCorrections.length);
  if (addedCorrections.length > 1) fail('Confirm one correction at a time');
  for (const correction of addedCorrections) {
    if (!correction.reason?.trim() || correction.reason.length > 500) fail('Correction reason is required');
    correction.actor = user.fullName; correction.at = new Date().toISOString();
    if (correction.action === 'REMOVE_LINE') {
      const original = oldLines.find((line) => line.id === correction.originalLine?.id);
      if (!original || !equal(original,correction.originalLine)) fail('Correction must preserve the original payable line');
    } else if (correction.action === 'CANCEL_WEIGHING') {
      if (!previous.pendingPlatformCapture && previous.scaleGrossInWeight == null) fail('No unfinished weighing to cancel');
      if (correction.originalGrossLbs !== (previous.pendingPlatformCapture?.capturedLbs ?? previous.scaleGrossInWeight) || correction.originalTareLbs !== (previous.pendingPlatformCapture?.tareLbs ?? previous.scaleTareOutWeight)) fail('Cancellation must preserve original weights');
    } else fail('Invalid correction action');
  }
  for (const old of oldLines) {
    const retained = lines.find((line) => line.id === old.id);
    if (retained && !equal(old, retained)) fail('Confirmed lines are immutable; remove with an audited correction');
    if (!retained) {
      if (!addedCorrections.some((correction) => correction.action === 'REMOVE_LINE' && correction.originalLine?.id === old.id)) fail('Line removal requires audited correction');
      await client.query('UPDATE scrap_buying_lines SET active=FALSE WHERE id=$1 AND ticket_id=$2', [old.id, previous.id]);
      await client.query("UPDATE scrap_buying_cycles SET status='CANCELLED' WHERE id=(SELECT source_cycle_id FROM scrap_buying_lines WHERE id=$1 AND ticket_id=$2)",[old.id,previous.id]);
    }
  }
  const newLines = lines.filter((line) => !oldLines.some((old) => old.id === line.id));
  if (newLines.length > 1 || (newLines.length && addedTx.length)) fail('Review captured weights separately from capture');
  const metals = await stateValue<MetalGrade[]>(client,'mahaffeys_metals',[]);
  for (const line of newLines) {
    const metal = metals.find((grade) => grade.id === line.metalGradeId);
    if (!metal || line.ratePerLb !== metal.ratePerLb) fail('Buying rate changed; refresh and review');
    if (line.deductionPercent > 0 && !line.deductionReason?.trim()) fail('Deduction reason required');
    const sources = line.sourceCaptureIds ?? [];
    let gross: number; let tare: number;
    if (line.weighingMode === 'SINGLE_WEIGHT') {
      const draft = previous.pendingPlatformCapture;
      if (!draft || sources.length !== 1 || sources[0] !== draft.capture.id || submitted.pendingPlatformCapture) fail('Platform line must consume its reviewed batch exactly once');
      gross = draft.capturedLbs; tare = draft.tareLbs;
      line.tareTreatment = draft.tareTreatment;
    } else if (line.weighingMode === 'VEHICLE_IN_OUT') {
      const pair = oldTx.filter((row) => (row.type === 'SCALE_IN' && row.recordedAt === previous.scaleGrossInAt) || (row.type === 'SCALE_OUT' && row.recordedAt === previous.scaleTareOutAt));
      if (previous.scaleGrossInWeight == null || previous.scaleTareOutWeight == null || pair.length !== 2 || sources.length !== 2 || !pair.every((row) => sources.includes(row.id)) || submitted.scaleGrossInWeight != null || submitted.scaleTareOutWeight != null) fail('Truck line needs one separately measured complete IN/OUT pair');
      gross = previous.scaleGrossInWeight; tare = previous.scaleTareOutWeight;
    } else fail('Legacy/unspecified or split weighing cannot create a canonical payable line');
    const resolved = await client.query('SELECT c.id,c.document FROM scrap_buying_captures c JOIN scrap_buying_capture_context x ON x.capture_id=c.id WHERE c.id=ANY($1::uuid[]) AND c.ticket_id=$2 AND x.cycle_id=$3', [sources,previous.id,previous.buying?.activeCycleId]);
    if (resolved.rows.length !== sources.length || resolved.rows.some((row) => row.document.source === 'SCALE' && !row.document.stable)) fail('Every source must belong to this canonical cycle and be stable or reviewed manual');
    const breakdown = validatedBreakdown(gross,tare,line.deductionPercent,metal.ratePerLb);
    for (const [key,value] of Object.entries(breakdown)) if (line[key as keyof typeof line] !== value) fail('Payable line calculations conflict with server result');
    Object.assign(line,breakdown,{metalName:metal.name,metalCategory:metal.category});
    await client.query('INSERT INTO scrap_buying_lines(id,ticket_id,document,source_cycle_id) VALUES($1,$2,$3::jsonb,$4)', [line.id,previous.id,JSON.stringify(line),previous.buying?.activeCycleId]);
    for (const id of sources) await client.query('INSERT INTO scrap_buying_line_sources(capture_id,line_id) VALUES($1,$2)', [id,line.id]);
    await client.query("UPDATE scrap_buying_cycles SET status='REVIEWED',document=document||$2::jsonb WHERE id=$1",[previous.buying?.activeCycleId,JSON.stringify({netLbs:breakdown.netWeight,lineId:line.id,reviewedAt:new Date().toISOString()})]);
    await client.query("UPDATE scrap_buying_passes SET document=document||'{\"reviewed\":true}'::jsonb WHERE cycle_id=$1",[previous.buying?.activeCycleId]);
    buying.activeCycleId=undefined;
  }
  const cancelled = addedCorrections.some((correction) => correction.action === 'CANCEL_WEIGHING');
  if (cancelled && (addedTx.length || newLines.length || submitted.pendingPlatformCapture || submitted.scaleGrossInWeight != null || submitted.scaleTareOutWeight != null || submitted.scaleGrossInAt || submitted.scaleTareOutAt)) fail('Cancellation must clear the unfinished cycle; capture new weights in a separate command');
  if (cancelled) {
    await client.query("UPDATE scrap_buying_cycles SET status='CANCELLED' WHERE id=$1 AND ticket_id=$2",[previous.buying?.activeCycleId,previous.id]);
    buying.activeCycleId=undefined;
  }
  if (newLines.length && (submitted.scaleGrossInWeight != null || submitted.scaleTareOutWeight != null || submitted.scaleGrossInAt || submitted.scaleTareOutAt || submitted.pendingPlatformCapture)) fail('A reviewed line must consume and clear its source cycle');
  if (addedTx.length) {
    const row = addedTx[0];
    if (newLines.length || addedCorrections.length) fail('Capture must be a separate command');
    if (row.type === 'SCALE_IN' && (submitted.scaleTareOutWeight != null || submitted.scaleTareOutAt || submitted.pendingPlatformCapture)) fail('IN cannot create OUT or platform readings');
    if (row.type === 'SCALE_OUT' && (submitted.scaleGrossInWeight !== previous.scaleGrossInWeight || submitted.scaleGrossInAt !== previous.scaleGrossInAt || submitted.pendingPlatformCapture)) fail('OUT must preserve its own IN');
    if (row.type === 'SINGLE_WEIGHT' && (submitted.scaleGrossInWeight != null || submitted.scaleTareOutWeight != null || submitted.scaleGrossInAt || submitted.scaleTareOutAt)) fail('Platform captures cannot create vehicle passes');
  }
  if ((previous.pendingPlatformCapture && !equal(previous.pendingPlatformCapture,submitted.pendingPlatformCapture)) ||
    (previous.scaleGrossInWeight != null && (previous.scaleGrossInWeight !== submitted.scaleGrossInWeight || previous.scaleGrossInAt !== submitted.scaleGrossInAt)) ||
    (previous.scaleTareOutWeight != null && (previous.scaleTareOutWeight !== submitted.scaleTareOutWeight || previous.scaleTareOutAt !== submitted.scaleTareOutAt))) {
    if (!newLines.length && !cancelled) fail('Unfinished readings cannot be reinterpreted or discarded');
  }
  if (!addedTx.length && !newLines.length && !cancelled && (!equal(previous.pendingPlatformCapture,submitted.pendingPlatformCapture) || previous.scaleGrossInWeight !== submitted.scaleGrossInWeight || previous.scaleTareOutWeight !== submitted.scaleTareOutWeight || previous.scaleGrossInAt !== submitted.scaleGrossInAt || previous.scaleTareOutAt !== submitted.scaleTareOutAt)) fail('Use a capture command for new weights');
  if ((previous.pendingPlatformCapture || previous.scaleGrossInWeight != null) && previous.selectedWeighingType !== submitted.selectedWeighingType) fail('Finish or cancel before changing mode');
  return { ...submitted, buying };
}

export async function currentBuyingPolicy(client?: PoolClient): Promise<BuyingPolicy | null> {
  const result = client ? await client.query('SELECT version,document FROM scrap_buying_policies ORDER BY created_at DESC LIMIT 1') : await query('SELECT version,document FROM scrap_buying_policies ORDER BY created_at DESC LIMIT 1');
  return result.rows[0] ? { ...result.rows[0].document, version: result.rows[0].version } : null;
}

async function pay(client: PoolClient, ticket: Ticket, command: z.infer<typeof buyingCommandSchema>, user: PublicUser) {
  if (!['admin','yard_manager'].includes(user.role)) fail('Only a manager or administrator can record payment',403);
  if (ticket.buying?.stage === 'PAID') return ticket;
  if (ticket.buying?.stage !== 'FINALIZED' || !ticket.buying.sellerIdentity || !command.reviewed || !command.method) fail('Finalize with a confirmed seller identity and explicitly verify compliance before payment');
  const policy = await currentBuyingPolicy(client);
  const day = new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if (!policy?.version || day < policy.effectiveFrom || day > policy.effectiveThrough) fail('A current reviewer-confirmed policy is required before any payment');
  const relevant = (ticket.scrapLines ?? []).map((line) => policy.grades.find((grade) => grade.gradeId === line.metalGradeId));
  if (relevant.some((grade) => !grade?.approved)) fail('One or more material classifications are not approved for purchase');
  if (relevant.some((grade) => grade?.requirePermit) && !command.permitReference) fail('Required seller permit reference is missing');
  const cents = Math.round(ticket.finalPayout*100);
  if (command.method === 'Cash') {
    if (relevant.some((grade) => grade?.cashAtOrAboveCents !== null && cents >= (grade?.cashAtOrAboveCents ?? 0))) fail('Policy requires check payment at this transaction amount');
    const daily = await client.query(`SELECT COALESCE(SUM(p.amount),0) AS total FROM scrap_buying_payments p JOIN scrap_buying_tickets t ON t.ticket_id=p.ticket_id
      WHERE p.method='Cash' AND t.document->'buying'->'sellerIdentity'=$1::jsonb AND (p.paid_at AT TIME ZONE 'America/New_York')::date=$2::date`,[JSON.stringify(ticket.buying.sellerIdentity),day]);
    const dayCents = Math.round(Number(daily.rows[0].total)*100)+cents;
    if (relevant.some((grade) => grade?.sellerDayCashLimitCents !== null && dayCents > (grade?.sellerDayCashLimitCents ?? 0))) fail('Seller/day cash limit exceeded');
    const restricted = (ticket.scrapLines ?? []).some((line) => line.metalCategory !== 'Ferrous');
    if (cents > (restricted ? 2500 : 10000)) fail('Stricter existing yard cash preference exceeded');
  }
  if (command.method === 'Check' && !command.reference) fail('Enter the actual check reference');
  const id = randomUUID(); const now = new Date().toISOString();
  const payment = { id,amount:ticket.finalPayout,method:command.method,checkReference:command.method === 'Check' ? command.reference : undefined,
    paidAt:now,paidBy:user.fullName,policyVersion:policy.version,permitReference:command.permitReference };
  if (payment.checkReference) {
    payment.checkReference = payment.checkReference.toUpperCase();
    const legacy = await stateValue<Ticket[]>(client,'mahaffeys_tickets',[]);
    if (legacy.some((row)=>row.id!==ticket.id && row.checkNumber?.trim().toUpperCase()===payment.checkReference)) fail('This check reference already appears in canonical or historical ticket evidence');
  }
  let drawerEntry: CashDrawerLog | undefined;
  if (command.method === 'Cash') {
    const drawer = await stateValue<CashDrawerLog[]>(client,'mahaffeys_cash_drawer',[]);
    const balance = [...drawer].sort((a,b) => b.timestamp.localeCompare(a.timestamp))[0]?.balanceAfter ?? 0;
    if (!Number.isFinite(balance) || balance < ticket.finalPayout) fail('Insufficient or ambiguous recorded drawer balance; reconcile before payment');
    drawerEntry = { id:`payment-${id}`,ticketId:ticket.id,timestamp:now,type:'PAYOUT_DISBURSEMENT',amount:-ticket.finalPayout,
      operatorName:user.fullName,balanceAfter:Math.round((balance-ticket.finalPayout)*100)/100,notes:`Canonical payment ${id}` };
    await putState(client,'mahaffeys_cash_drawer',[...drawer,drawerEntry],user.id);
  }
  await client.query(`INSERT INTO scrap_buying_payments(ticket_id,id,amount,method,check_reference,drawer_entry_id,policy_version,document)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,[ticket.id,id,ticket.finalPayout,command.method,payment.checkReference ?? null,drawerEntry?.id ?? null,policy.version,JSON.stringify({...payment,drawerEntry})]);
  return { ...ticket,payoutMethod:command.method,checkNumber:payment.checkReference,buying:{...ticket.buying!,stage:'PAID' as const,payment} };
}

export async function executeBuyingCommand(command: z.infer<typeof buyingCommandSchema>, user: PublicUser) {
  const hash = createHash('sha256').update(canonical(command)).digest('hex');
  return withTransaction(async (client) => {
    await lockFinancialState(client);
    const retry = await client.query('SELECT request_hash,result FROM scrap_buying_events WHERE actor_id=$1 AND idempotency_key=$2',[user.id,command.idempotencyKey]);
    if (retry.rows[0]) { if (retry.rows[0].request_hash !== hash) fail('Idempotency key was reused for another request'); return retry.rows[0].result as Ticket; }
    const result = await client.query('SELECT document FROM scrap_buying_tickets WHERE ticket_id=$1 FOR UPDATE',[command.id]);
    const previous: Ticket | undefined = result.rows[0]?.document;
    let next: Ticket;
    if (command.action === 'CREATE' || command.action === 'ADOPT') {
      if (previous) { if (command.action === 'ADOPT') return previous; fail('Ticket already exists'); }
      const tickets = await stateValue<Ticket[]>(client,'mahaffeys_tickets',[]);
      const legacy = tickets.find((ticket) => ticket.id === command.id);
      if (command.action === 'ADOPT') {
        if (!legacy || legacy.ticketType !== 'SCRAP_METAL' || legacy.status !== 'PENDING') fail('Only open legacy scrap drafts can be adopted; historical completed payment meaning remains unchanged');
        next = { ...legacy };
      } else {
        if (legacy) fail('Ticket number already exists');
        const seller = z.object({customerName:z.string().trim().min(1).max(200),customerId:z.string().max(120).optional(),customerPhone:z.string().max(80).optional(),customerIdNumber:z.string().max(120).optional(),vehicleLicensePlate:z.string().max(80).optional(),notes:z.string().max(2000).optional(),complianceCaptures:z.record(z.string().max(1000000).optional()).optional()}).safeParse(command.ticket);
        if (!seller.success) fail('Invalid seller draft',400);
        next = { ...seller.data,id:command.id,ticketType:'SCRAP_METAL',createdAt:new Date().toISOString(),status:'PENDING',scrapLines:[],grossTotal:0,totalDeductions:0,finalPayout:0,payoutMethod:'Cash',operatorName:user.fullName };
      }
      next.buying = {version:1,revision:1,stage:'DRAFT'};
      await client.query('INSERT INTO scrap_buying_tickets(ticket_id,revision,stage,document,created_by) VALUES($1,1,$2,$3::jsonb,$4)',[next.id,'DRAFT',JSON.stringify(next),user.id]);
    } else {
      if (!previous?.buying) fail('Canonical buying ticket not found',404);
      if (command.action === 'PAY' && previous.buying.stage === 'PAID') return previous;
      if (previous.buying.revision !== command.revision) fail('Ticket changed on another workstation. Refresh before continuing.');
      next = { ...previous };
      if (command.action === 'SAVE') {
        if (previous.buying.stage !== 'DRAFT' || !command.ticket) fail('Only draft buying tickets can be edited');
        next = await validateSave(client,previous,command.ticket as unknown as Ticket,user);
      } else if (command.action === 'FINALIZE') {
        if (previous.buying.stage !== 'DRAFT' || previous.buying.activeCycleId || previous.pendingPlatformCapture || previous.scaleGrossInWeight != null || !previous.scrapLines?.length) fail('Finish every weighing cycle before final review');
        if (!previous.customerId || !previous.customerIdNumber || !previous.customerPhone || !previous.vehicleLicensePlate || !command.reviewed) fail('Seller ID, phone, vehicle plate and explicit review are required');
        const seller = await client.query('SELECT id_type,id_state,id_number,address,phone FROM customers WHERE id=$1',[previous.customerId]);
        if (!seller.rows[0]?.id_state || !seller.rows[0]?.address || !seller.rows[0]?.phone) fail('Complete the seller issuing jurisdiction, phone and address in the customer registry');
        if (seller.rows[0].id_number!==previous.customerIdNumber) fail('Seller ID conflicts with the confirmed customer profile');
        const photos = previous.complianceCaptures;
        if (['personPhotoUrl','idPhotoUrl','vehiclePhotoUrl','licensePlatePhotoUrl','loadPhotoUrl'].some((key) => !photos?.[key as keyof typeof photos])) fail('Complete the current seller/ID/vehicle/plate/load verification photos');
        if (previous.scrapLines.some((line) => !line.sourceCaptureIds?.length)) fail('Legacy weighed lines must be explicitly corrected and reweighed before canonical finalization');
        const lineIds = previous.scrapLines.map((line) => line.id);
        const stored = await client.query('SELECT id FROM scrap_buying_lines WHERE ticket_id=$1 AND active=TRUE AND id=ANY($2::text[])',[previous.id,lineIds]);
        if (stored.rows.length !== lineIds.length) fail('Every payable line must be server-confirmed');
        const cents = previous.scrapLines.reduce((sum,line) => sum+Math.round(line.lineTotal*100),0);
        if (!Number.isSafeInteger(cents) || cents > 99999999999999) fail('Ticket amount exceeds supported limits');
        next = { ...previous,status:'COMPLETED',grossTotal:cents/100,finalPayout:cents/100,totalDeductions:0,
          buying:{...previous.buying,stage:'FINALIZED',finalizedAt:new Date().toISOString(),sellerIdentity:{idType:seller.rows[0].id_type,idState:seller.rows[0].id_state.toUpperCase(),idNumber:seller.rows[0].id_number.toUpperCase()}} };
      } else if (command.action === 'PAY') next = await pay(client,previous,command,user);
      else if (command.action === 'VOID') {
        if (previous.buying.stage === 'PAID') fail('A paid ticket cannot be voided through draft cancellation; reconcile payment evidence separately');
        if (!command.reason) fail('Void reason required');
        next = {...previous,status:'VOIDED',voidedAt:new Date().toISOString(),voidedBy:user.fullName,voidReason:command.reason,buying:{...previous.buying,stage:'VOIDED'}};
      }
      next.buying = {...next.buying!,revision:previous.buying.revision+1};
      await client.query('UPDATE scrap_buying_tickets SET revision=$2,stage=$3,document=$4::jsonb,updated_at=NOW() WHERE ticket_id=$1',[next.id,next.buying.revision,next.buying.stage,JSON.stringify(next)]);
    }
    await projectTicket(client,next,user.id);
    await client.query('INSERT INTO scrap_buying_events(id,ticket_id,revision,actor_id,idempotency_key,request_hash,action,result) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)',[randomUUID(),next.id,next.buying!.revision,user.id,command.idempotencyKey,hash,command.action,JSON.stringify(next)]);
    return next;
  });
}
