import { afterAll,beforeAll,describe,it,expect,vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { validatedBreakdown } from '../../src/utils/weighingContract';
import type { PublicUser } from './auth';
import type { Ticket } from '../../src/types/scrap';

const testUrl=process.env.TEST_DATABASE_URL;
const safe=!!testUrl && /test/i.test(new URL(testUrl).pathname) && testUrl!==process.env.NITRO_DATABASE_URL && testUrl!==process.env.DATABASE_URL;
const namespace=`buying_test_${randomUUID().replace(/-/g,'')}`;
let connection:Pool;
let db:typeof import('./db');
let buying:typeof import('./scrapBuying');
let finance:typeof import('./financialState');
const user={id:'test-admin',fullName:'SYNTHETIC TEST OPERATOR',username:'test-admin',role:'admin',status:'approved',createdAt:new Date().toISOString()} as PublicUser;
let ticket:Ticket;
const grade={id:'test-grade',name:'TEST FERROUS',code:'TEST',category:'Ferrous',ratePerLb:0.5,description:'Synthetic test grade'};
const command=(action:'CREATE'|'SAVE'|'FINALIZE'|'FINALIZE_AND_PAY'|'PAY',extra:Record<string,unknown>={})=>({action,id:ticket?.id??'test-ticket',revision:ticket?.buying?.revision??0,idempotencyKey:randomUUID(),...extra});

describe.skipIf(!safe)('real PostgreSQL buying invariants (isolated TEST_DATABASE_URL schema)',()=>{
  beforeAll(async()=>{
    connection=new Pool({connectionString:testUrl});
    await connection.query(`CREATE SCHEMA "${namespace}"`);
    const url=new URL(testUrl!);url.searchParams.set('options',`-c search_path=${namespace}`);
    vi.stubEnv('NITRO_DATABASE_URL',url.toString());
    db=await import('./db');buying=await import('./scrapBuying');finance=await import('./financialState');
    await db.getDatabase();
    await db.query(`INSERT INTO users(id,full_name,username,password_hash,role,status,created_at) VALUES($1,$2,$3,'not-a-login-hash','admin','approved',NOW())`,[user.id,user.fullName,user.username]);
    await db.query(`INSERT INTO customers(id,full_name,phone,id_type,id_number,id_state,address,created_at,updated_at) VALUES('test-seller','TEST SELLER','5550001234','Driver License','TEST-ID','SC','TEST ADDRESS',NOW(),NOW())`);
    await db.withTransaction(async(client)=>{
      await finance.putState(client,'mahaffeys_metals',[grade],user.id);
      await finance.putState(client,'mahaffeys_settings',{scales:[{id:'test-platform',weighingMode:'SINGLE_WEIGHT',supportedWeighingTypes:['PLATFORM'],capacityLbs:10000,resolutionLbs:1}]},user.id);
      await finance.putState(client,'mahaffeys_cash_drawer',[{id:'test-float',timestamp:new Date().toISOString(),type:'OPENING_FLOAT',amount:1000,balanceAfter:1000,operatorName:user.fullName}],user.id);
    });
  });
  afterAll(async()=>{
    if(db)await(await db.getDatabase()).end();
    if(connection){await connection.query(`DROP SCHEMA "${namespace}" CASCADE`);await connection.end();}
    vi.unstubAllEnvs();
  });
  it('idempotent create and concurrent stale draft updates',async()=>{
    const request=command('CREATE',{ticket:{customerId:'test-seller',customerName:'TEST SELLER',customerPhone:'5550001234',customerIdNumber:'TEST-ID',vehicleLicensePlate:'TEST-PLATE',complianceCaptures:{idPhotoUrl:'/TEST/id',personPhotoUrl:'/TEST/person',vehiclePhotoUrl:'/TEST/vehicle',licensePlatePhotoUrl:'/TEST/plate',loadPhotoUrl:'/TEST/load'}}});
    ticket=await buying.executeBuyingCommand(request as Parameters<typeof buying.executeBuyingCommand>[0],user);
    expect(await buying.executeBuyingCommand(request as Parameters<typeof buying.executeBuyingCommand>[0],user)).toEqual(ticket);
    const revision=ticket.buying!.revision;
    const results=await Promise.allSettled(['A','B'].map(notes=>buying.executeBuyingCommand({...command('SAVE'),revision,ticket:{...ticket,notes}} as Parameters<typeof buying.executeBuyingCommand>[0],user)));
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    ticket=(await db.query('SELECT document FROM scrap_buying_tickets WHERE ticket_id=$1',[ticket.id])).rows[0].document;
  });
  it('confirms one platform cycle and one payable line without auto-finalization',async()=>{
    const at=new Date().toISOString();const id=randomUUID();
    const capture={id,scaleId:'test-platform',originalWeight:200,originalUnit:'LBS' as const,normalizedLbs:200,actorId:user.id,capturedAt:at,stable:false,source:'MANUAL' as const};
    ticket=await buying.executeBuyingCommand({...command('SAVE'),ticket:{...ticket,selectedWeighingType:'PLATFORM',pendingPlatformCapture:{capture,capturedLbs:200,tareLbs:50,tareTreatment:'MANUAL',isManual:true},weightTransactions:[{id,type:'SINGLE_WEIGHT',weightLbs:200,recordedAt:at,capture}]}} as Parameters<typeof buying.executeBuyingCommand>[0],user);
    expect(ticket.buying!.activeCycleId).toBeTruthy();
    const line={id:randomUUID(),metalGradeId:grade.id,metalName:grade.name,metalCategory:grade.category,...validatedBreakdown(200,50,10,0.5),deductionPercent:10,ratePerLb:0.5,deductionReason:'TEST contamination',weighingMode:'SINGLE_WEIGHT',sourceCaptureIds:[id],tareTreatment:'MANUAL',loadNumber:1};
    ticket=await buying.executeBuyingCommand({...command('SAVE'),ticket:{...ticket,pendingPlatformCapture:undefined,scrapLines:[line]}} as Parameters<typeof buying.executeBuyingCommand>[0],user);
    expect(ticket.buying!.stage).toBe('DRAFT');expect(ticket.buying!.activeCycleId).toBeUndefined();
    expect(Number((await db.query('SELECT COUNT(*) FROM scrap_buying_line_sources')).rows[0].count)).toBe(1);
    ticket=await buying.executeBuyingCommand(command('FINALIZE',{reviewed:true}) as Parameters<typeof buying.executeBuyingCommand>[0],user);
    expect(ticket.buying!.stage).toBe('FINALIZED');expect(ticket.buying!.payment).toBeUndefined();
  });
  it('gates payment until policy, enforces roles and records simultaneous cash payment once',async()=>{
    await expect(buying.executeBuyingCommand(command('PAY',{method:'Cash',reviewed:true,disbursed:true}) as Parameters<typeof buying.executeBuyingCommand>[0],user)).rejects.toThrow();
    const policy={sourceUrl:'https://www.scstatehouse.gov/code/t16c017.php',effectiveFrom:'2020-01-01',effectiveThrough:'2099-12-31',reviewer:'SYNTHETIC TEST REVIEWER',reviewReference:'NOT A LIVE POLICY',grades:[{gradeId:grade.id,classification:'TEST ONLY',approved:true,requirePermit:false,paymentClass:'FERROUS',cashAtOrAboveCents:10000,sellerDayCashLimitCents:10000,definition:{name:grade.name,code:grade.code,category:grade.category}}]};
    await db.query('INSERT INTO scrap_buying_policies(version,document,created_by) VALUES($1,$2::jsonb,$3)',[randomUUID(),JSON.stringify(policy),user.id]);
    await expect(buying.executeBuyingCommand(command('PAY',{method:'Cash',reviewed:true,disbursed:true}) as Parameters<typeof buying.executeBuyingCommand>[0],{...user,role:'yard_employee'})).rejects.toThrow();
    const responses=await Promise.all([1,2].map(()=>buying.executeBuyingCommand(command('PAY',{method:'Cash',reviewed:true,disbursed:true}) as Parameters<typeof buying.executeBuyingCommand>[0],{...user,role:'scale_operator'})));
    expect(responses[0].buying!.payment!.id).toBe(responses[1].buying!.payment!.id);
    expect(Number((await db.query('SELECT COUNT(*) FROM scrap_buying_payments')).rows[0].count)).toBe(1);
    const drawer=(await db.query("SELECT value FROM app_state WHERE key='mahaffeys_cash_drawer'")).rows[0].value;
    expect(drawer.filter((row:{type:string})=>row.type==='PAYOUT_DISBURSEMENT')).toHaveLength(1);
    expect(drawer.at(-1).balanceAfter).toBe(932.5);
    ticket=responses[0];
  });
  it('approved operators atomically complete Check purchases; invalid details roll back and retries preserve the actual number',async()=>{
    const original = ticket;
    const create = command('CREATE',{id:'combined-check-test',revision:0,ticket:{customerId:'test-seller',customerName:'TEST SELLER',customerPhone:'5550001234',customerIdNumber:'TEST-ID',vehicleLicensePlate:'TEST-PLATE',complianceCaptures:original.complianceCaptures}});
    ticket=await buying.executeBuyingCommand(create as Parameters<typeof buying.executeBuyingCommand>[0],user);
    const at=new Date().toISOString();const captureId=randomUUID();
    const capture={id:captureId,scaleId:'test-platform',originalWeight:10,originalUnit:'LBS',normalizedLbs:10,actorId:user.id,capturedAt:at,stable:false,source:'MANUAL'};
    ticket=await buying.executeBuyingCommand({...command('SAVE'),ticket:{...ticket,selectedWeighingType:'PLATFORM',pendingPlatformCapture:{capture,capturedLbs:10,tareLbs:0,tareTreatment:'NONE',isManual:true},weightTransactions:[{id:captureId,type:'SINGLE_WEIGHT',weightLbs:10,recordedAt:at,capture}]}} as Parameters<typeof buying.executeBuyingCommand>[0],user);
    const line={id:randomUUID(),metalGradeId:grade.id,metalName:grade.name,metalCategory:grade.category,...validatedBreakdown(10,0,0,0.5),deductionPercent:0,ratePerLb:0.5,weighingMode:'SINGLE_WEIGHT',sourceCaptureIds:[captureId],tareTreatment:'NONE',loadNumber:1};
    ticket=await buying.executeBuyingCommand({...command('SAVE'),ticket:{...ticket,pendingPlatformCapture:undefined,scrapLines:[line]}} as Parameters<typeof buying.executeBuyingCommand>[0],user);
    const preview=await buying.previewPaymentEligibility(ticket.id,ticket.buying!.revision,{...user,role:'scale_operator'});
    expect(preview.allowedMethods).toContain('Check');
    const request=command('FINALIZE_AND_PAY',{method:'Check',reference:'',reviewed:true,disbursed:true});
    await expect(buying.executeBuyingCommand(request as Parameters<typeof buying.executeBuyingCommand>[0],{...user,role:'scale_operator'})).rejects.toThrow();
    expect((await db.query('SELECT stage FROM scrap_buying_tickets WHERE ticket_id=$1',[ticket.id])).rows[0].stage).toBe('DRAFT');
    expect(Number((await db.query('SELECT COUNT(*) FROM scrap_buying_payments WHERE ticket_id=$1',[ticket.id])).rows[0].count)).toBe(0);
    await expect(buying.executeBuyingCommand({...request,reference:'00123-Ab',disbursed:false} as Parameters<typeof buying.executeBuyingCommand>[0],user)).rejects.toThrow();
    const valid={...request,reference:'00123-Ab'};
    const paid=await Promise.all([user,{...user,role:'scale_operator'}].map(actor=>buying.executeBuyingCommand(valid as Parameters<typeof buying.executeBuyingCommand>[0],actor)));
    expect(paid[0].buying!.payment!.id).toBe(paid[1].buying!.payment!.id);
    expect(paid[0].checkNumber).toBe('00123-Ab');
    expect(paid[0].buying!.payment!.checkReference).toBe('00123-Ab');
    expect(await buying.executeBuyingCommand(valid as Parameters<typeof buying.executeBuyingCommand>[0],user)).toEqual(paid[0]);
    const stored=(await db.query('SELECT document FROM scrap_buying_tickets WHERE ticket_id=$1',[ticket.id])).rows[0].document;
    expect(stored.checkNumber).toBe('00123-Ab');
    const canonical=(await db.query('SELECT check_reference FROM scrap_buying_payments WHERE ticket_id=$1',[ticket.id])).rows[0];
    expect(canonical.check_reference).toBe('00123-Ab');
    const drawer=(await db.query("SELECT value FROM app_state WHERE key='mahaffeys_cash_drawer'")).rows[0].value;
    expect(drawer.filter((row:{ticketId?:string})=>row.ticketId===ticket.id)).toHaveLength(0);
    await expect(buying.executeBuyingCommand(valid as Parameters<typeof buying.executeBuyingCommand>[0],{...user,status:'pending'})).rejects.toThrow();
    // A separate legitimate finalized purchase cannot reuse this number, even with changed casing.
    const duplicate={...stored,id:'duplicate-check-test',status:'COMPLETED',checkNumber:undefined,buying:{...stored.buying,revision:1,stage:'FINALIZED',payment:undefined}};
    await db.query('INSERT INTO scrap_buying_tickets(ticket_id,revision,stage,document,created_by) VALUES($1,1,$2,$3::jsonb,$4)',[duplicate.id,'FINALIZED',JSON.stringify(duplicate),user.id]);
    await expect(buying.executeBuyingCommand({...command('PAY'),id:duplicate.id,revision:1,method:'Check',reference:'00123-ab',disbursed:true} as Parameters<typeof buying.executeBuyingCommand>[0],user)).rejects.toThrow();
    expect(Number((await db.query('SELECT COUNT(*) FROM scrap_buying_payments WHERE ticket_id=$1',[duplicate.id])).rows[0].count)).toBe(0);
    ticket=original;
  });
  it('generic state cannot replace paid canonical data, create another drawer payment, or reopen legacy terminal tickets',async()=>{
    const protectedValue=await db.withTransaction(client=>finance.protectFinancialState(client,'mahaffeys_tickets',[{...ticket,status:'PENDING',finalPayout:0}],'admin',user.fullName));
    expect((protectedValue as Ticket[]).find(row=>row.id===ticket.id)?.buying?.stage).toBe('PAID');
    await expect(db.withTransaction(client=>finance.protectFinancialState(client,'mahaffeys_cash_drawer',[{id:randomUUID(),type:'PAYOUT_DISBURSEMENT',ticketId:ticket.id,amount:-67.5,balanceAfter:865,timestamp:new Date().toISOString()}],'admin',user.fullName))).rejects.toThrow();
    const legacy={...ticket,id:'legacy-test',buying:undefined,status:'COMPLETED'};
    await db.withTransaction(client=>finance.putState(client,'mahaffeys_tickets',[ticket,legacy],user.id));
    await expect(db.withTransaction(client=>finance.protectFinancialState(client,'mahaffeys_tickets',[ticket,{...legacy,status:'PENDING'}],'admin',user.fullName))).rejects.toThrow();
  });
});
