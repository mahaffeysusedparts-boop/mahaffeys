import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { H3Event } from 'nitro/h3';
import type { PoolClient } from 'pg';
import { DEFAULT_BIN_CATALOG, type BinReview } from '../../src/types/binDeductions';
const mocks = vi.hoisted(() => ({ user: vi.fn(), query: vi.fn(), lock: vi.fn(), catalog: undefined as unknown, reviews: [] as unknown[], cycle: {} as Record<string,unknown> }));
vi.mock('nitro/h3', () => ({ createError: ({statusCode,statusMessage}: {statusCode:number;statusMessage:string}) => Object.assign(new Error(statusMessage),{statusCode}) }));
vi.mock('./auth', () => ({ requireUser: mocks.user }));
vi.mock('./financialState', () => ({ lockFinancialState: mocks.lock }));
vi.mock('./db', () => ({ query: mocks.query, withTransaction: async (fn: (client: unknown) => unknown) => fn({query:mocks.query}) }));
import { binUser, saveBinCatalog, submitBinReview, consumeBinReview } from './binInspections';
const event = {} as H3Event;
const cycleId = '00000000-0000-4000-8000-000000000001';
const body = () => ({ cycleId,expectedRevision:0,catalogRevision:1,selections:[{itemId:'tire',quantity:2}] });
beforeEach(() => {
  mocks.user.mockReset(); mocks.query.mockReset(); mocks.lock.mockReset(); mocks.catalog = undefined; mocks.reviews = [];
  mocks.user.mockResolvedValue({id:'employee',fullName:'Bin Employee',role:'yard_employee',status:'approved'});
  mocks.cycle = {status:'AWAITING_OUT',weighing_type:'VEHICLE_IN_OUT',stage:'DRAFT',document:{scaleGrossInWeight:2000,buying:{activeCycleId:cycleId,revision:5}}};
  mocks.query.mockImplementation(async (sql: string, params: unknown[]) => {
    if (sql.startsWith('INSERT INTO bin_deduction_catalog')) { mocks.catalog = JSON.parse(params[1] as string); return {rows:[]}; }
    if (sql.startsWith('INSERT INTO bin_inspection_reviews')) { mocks.reviews.push(JSON.parse(params[2] as string)); return {rows:[]}; }
    if (sql.includes('FROM bin_deduction_catalog')) return { rows: mocks.catalog ? [{document:mocks.catalog}] : [] };
    if (sql.includes('FROM bin_inspection_reviews')) return { rows: mocks.reviews.length ? [{document:mocks.reviews.at(-1)}] : [] };
    if (sql.includes('FROM scrap_buying_cycles')) return { rows: [mocks.cycle] };
    throw new Error(`Unexpected SQL ${sql}`);
  });
});
describe('cycle-scoped dedicated bin APIs', () => {
  it('saves independent review revisions and history without writing ticket weighing state', async () => {
    const first = await submitBinReview(event,body());
    expect(first).toMatchObject({revision:1,totalLbs:300,employeeId:'employee',employeeName:'Bin Employee'});
    const next = await submitBinReview(event,{...body(),expectedRevision:1,selections:[]});
    expect(next).toMatchObject({revision:2,totalLbs:0,items:[]});
    expect(mocks.reviews).toEqual([first,next]); expect(mocks.lock).toHaveBeenCalledTimes(2);
    expect(mocks.query.mock.calls.some(([sql]) => sql.includes('UPDATE scrap_buying_tickets'))).toBe(false);
    await expect(submitBinReview(event,body())).rejects.toThrow('changed');
  });
  it.each(['pending','disabled','rejected'])('rejects %s account', async status => {
    mocks.user.mockResolvedValue({role:'yard_employee',status});
    await expect(submitBinReview(event,body())).rejects.toThrow('not permitted'); expect(mocks.reviews).toHaveLength(0);
  });
  it('rejects anonymous users and keeps scale role read-only', async () => {
    mocks.user.mockRejectedValueOnce(new Error('Sign in required')); await expect(binUser(event)).rejects.toThrow();
    mocks.user.mockResolvedValue({role:'scale_operator',status:'approved'});
    await expect(binUser(event)).resolves.toMatchObject({role:'scale_operator'});
    await expect(submitBinReview(event,body())).rejects.toThrow('not permitted');
    await expect(saveBinCatalog(event,DEFAULT_BIN_CATALOG)).rejects.toThrow('not permitted');
  });
  it('requires administrator and expected catalog revision', async () => {
    await expect(saveBinCatalog(event,DEFAULT_BIN_CATALOG)).rejects.toThrow('not permitted');
    mocks.user.mockResolvedValue({id:'admin',fullName:'Admin',role:'admin',status:'approved'});
    const next = await saveBinCatalog(event,{...DEFAULT_BIN_CATALOG,items:DEFAULT_BIN_CATALOG.items.map(item=>({...item,enabled:false}))});
    expect(next.revision).toBe(2);
    await expect(saveBinCatalog(event,DEFAULT_BIN_CATALOG)).rejects.toThrow('changed');
    await expect(saveBinCatalog(event,{revision:2,items:[DEFAULT_BIN_CATALOG.items[0]]})).rejects.toThrow('Disable');
  });
  it.each(['REVIEWED','CANCELLED'])('rejects corrections to %s cycle', async status => { mocks.cycle.status=status; await expect(submitBinReview(event,body())).rejects.toThrow('closed'); });
  it('rejects wrong cycle, paid tickets, catalog changes and arbitrary ticket fields', async () => {
    await expect(submitBinReview(event,{...body(),ticket:{scaleTareOutWeight:1}})).rejects.toThrow('Invalid');
    await expect(submitBinReview(event,{...body(),catalogRevision:2})).rejects.toThrow('rules changed');
    await expect(submitBinReview(event,{...body(),cycleId:'00000000-0000-4000-8000-000000000002'})).rejects.toThrow('eligible');
    mocks.cycle.stage='PAID'; await expect(submitBinReview(event,body())).rejects.toThrow('closed');
  });
  it('uses authoritative snapshots; never skips a late review after missing acknowledgment', async () => {
    const client = {query:mocks.query} as unknown as PoolClient;
    const user = {id:'scale',fullName:'Scale Operator'};
    await expect(consumeBinReview(client,cycleId,{cycleId,reviewRevision:0},user)).rejects.toThrow('Explicit');
    expect(await consumeBinReview(client,cycleId,{cycleId,reviewRevision:0,missingReviewAcknowledged:true},user)).toMatchObject({missingBinReview:{actorId:'scale',cycleId}});
    const review = await submitBinReview(event,body());
    await expect(consumeBinReview(client,cycleId,{cycleId,reviewRevision:0,missingReviewAcknowledged:true},user)).rejects.toThrow('changed');
    const evidence = await consumeBinReview(client,cycleId,{cycleId,reviewRevision:1},user);
    expect(evidence.binReview).toEqual(review);
    mocks.catalog = {...DEFAULT_BIN_CATALOG,revision:2,items:[]};
    expect((await consumeBinReview(client,cycleId,{cycleId,reviewRevision:1},user)).binReview?.items[0].poundsPerUnit).toBe(150);
    expect((mocks.reviews[0] as BinReview).catalogRevision).toBe(1);
  });
});
