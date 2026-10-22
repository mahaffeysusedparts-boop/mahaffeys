import { createError, type H3Event } from 'nitro/h3';
import type { PoolClient } from 'pg';
import { requireUser } from './auth';
import { query, withTransaction } from './db';
import { lockFinancialState } from './financialState';
import { DEFAULT_BIN_CATALOG, type BinDeductionCatalog, type BinReview, type BinCycle, type BinReviewAcknowledgment } from '../../src/types/binDeductions';
import { binCatalogSchema, binSubmissionSchema, resolveBinSelections } from '../../src/utils/binDeductionRules';
import { itemDeductionTotal, validatedItemBreakdown } from '../../src/utils/weighingContract';
const fail = (message: string, statusCode = 409): never => { throw createError({ statusCode, statusMessage: message }); };
export async function binUser(event: H3Event, write = false, admin = false) {
  const user = await requireUser(event);
  if (user.status !== 'approved' || !['admin','yard_manager','yard_employee','scale_operator'].includes(user.role) || (write && user.role === 'scale_operator') || (admin && user.role !== 'admin')) fail('Bin inspection action is not permitted', 403);
  return user;
}
export async function binCatalog(client?: PoolClient): Promise<BinDeductionCatalog> {
  const result = client ? await client.query('SELECT document FROM bin_deduction_catalog ORDER BY revision DESC LIMIT 1') : await query('SELECT document FROM bin_deduction_catalog ORDER BY revision DESC LIMIT 1');
  return result.rows[0]?.document ?? DEFAULT_BIN_CATALOG;
}
export async function currentBinReview(client: PoolClient, cycleId: string): Promise<BinReview | null> {
  return (await client.query('SELECT document FROM bin_inspection_reviews WHERE cycle_id=$1 ORDER BY revision DESC LIMIT 1', [cycleId])).rows[0]?.document ?? null;
}
export async function binQueue(cycleId?: string): Promise<BinCycle[]> {
  if (cycleId && !/^[0-9a-f-]{36}$/i.test(cycleId)) fail('Invalid cycle ID', 400);
  const result = await query(`SELECT c.id,c.number,c.status,t.ticket_id,t.document,t.stage,
    (SELECT (document->>'totalLbs')::numeric FROM scrap_buying_passes p WHERE p.cycle_id=c.id AND p.purpose='LOADED') AS in_lbs,
    (SELECT document FROM bin_inspection_reviews r WHERE r.cycle_id=c.id ORDER BY revision DESC LIMIT 1) AS review
    FROM scrap_buying_cycles c JOIN scrap_buying_tickets t ON t.ticket_id=c.ticket_id
    WHERE c.weighing_type='VEHICLE_IN_OUT' AND ($1::uuid IS NOT NULL AND c.id=$1 OR $1::uuid IS NULL AND c.status IN ('AWAITING_OUT','REVIEW') AND t.stage='DRAFT') ORDER BY t.updated_at DESC`, [cycleId ?? null]);
  return result.rows.map(row => ({ cycleId: row.id, ticketId: row.ticket_id, number: row.number, sellerName: row.document.customerName, plate: row.document.vehicleLicensePlate ?? '', inLbs: Number(row.in_lbs ?? row.document.scaleGrossInWeight ?? 0), open: row.stage === 'DRAFT' && ['AWAITING_OUT','REVIEW'].includes(row.status), review: row.review ?? null }));
}
export async function saveBinCatalog(event: H3Event, body: unknown) {
  const user = await binUser(event, true, true);
  const parsed = binCatalogSchema.safeParse(body);
  if (!parsed.success) fail(parsed.error.issues.map(issue => issue.message).join('; '), 400);
  return withTransaction(async client => {
    await lockFinancialState(client);
    const current = await binCatalog(client);
    if (current.revision !== parsed.data.revision) fail('Catalog changed; reload before saving');
    if (current.items.some(item => !parsed.data.items.some(next => next.id === item.id))) fail('Disable existing items instead of deleting or renaming their IDs', 400);
    const next = { ...parsed.data, revision: current.revision + 1 };
    await client.query('INSERT INTO bin_deduction_catalog(revision,document,actor_id) VALUES($1,$2::jsonb,$3)', [next.revision, JSON.stringify(next), user.id]);
    return next;
  });
}
export async function submitBinReview(event: H3Event, body: unknown) {
  const user = await binUser(event, true);
  const parsed = binSubmissionSchema.safeParse(body);
  if (!parsed.success) fail('Invalid bin selections or revision', 400);
  const input = parsed.data;
  return withTransaction(async client => {
    await lockFinancialState(client);
    const cycle = (await client.query('SELECT c.status,c.weighing_type,t.stage,t.document FROM scrap_buying_cycles c JOIN scrap_buying_tickets t ON t.ticket_id=c.ticket_id WHERE c.id=$1', [input.cycleId])).rows[0];
    if (!cycle || cycle.stage !== 'DRAFT' || cycle.weighing_type !== 'VEHICLE_IN_OUT' || !['AWAITING_OUT','REVIEW'].includes(cycle.status) || cycle.document.buying?.activeCycleId !== input.cycleId || cycle.document.scaleGrossInWeight == null) fail('This cycle is closed or not eligible for inspection');
    const previous = await currentBinReview(client, input.cycleId);
    const catalog = await binCatalog(client);
    if ((previous?.revision ?? 0) !== input.expectedRevision) fail('Bin review changed; reload the saved review before correcting');
    if (catalog.revision !== input.catalogRevision) fail('Deduction rules changed; reload the catalog');
    let items;
    try {
      items = resolveBinSelections(catalog, input.selections);
      if (cycle.document.scaleTareOutWeight != null) validatedItemBreakdown(cycle.document.scaleGrossInWeight, cycle.document.scaleTareOutWeight, items, 0);
    } catch (error) { fail(error instanceof Error ? error.message : 'Invalid deductions', 400); }
    const review: BinReview = { cycleId: input.cycleId, revision: (previous?.revision ?? 0) + 1, catalogRevision: catalog.revision, items, totalLbs: itemDeductionTotal(items), employeeId: user.id, employeeName: user.fullName, submittedAt: new Date().toISOString() };
    await client.query('INSERT INTO bin_inspection_reviews(cycle_id,revision,document,actor_id) VALUES($1,$2,$3::jsonb,$4)', [review.cycleId,review.revision,JSON.stringify(review),user.id]);
    return review;
  });
}
export async function consumeBinReview(client: PoolClient, cycleId: string | undefined, acknowledgment: BinReviewAcknowledgment | undefined, user: { id: string; fullName: string }) {
  if (!cycleId || !acknowledgment || acknowledgment.cycleId !== cycleId) fail('Review this cycle’s bin deductions or explicitly acknowledge the missing review');
  const review = await currentBinReview(client, cycleId);
  if ((review?.revision ?? 0) !== acknowledgment.reviewRevision) fail('Bin review changed; refresh and review deductions before confirming');
  if (review) return { binReview: review, missingBinReview: undefined };
  if (!('missingReviewAcknowledged' in acknowledgment) || acknowledgment.missingReviewAcknowledged !== true) fail('Explicit missing bin review acknowledgment required');
  return { binReview: undefined, missingBinReview: { cycleId, actorId: user.id, actorName: user.fullName, acknowledgedAt: new Date().toISOString() } };
}
