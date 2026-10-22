import { afterAll,beforeAll,describe,it,expect,vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { validatedBreakdown, validatedItemBreakdown } from '../../src/utils/weighingContract';
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
  it('consumes authoritative truck review, rejects stale acknowledgment and never carries deductions into the next cycle',async()=>{
    let draft=await buying.executeBuyingCommand({action:'CREATE',id:'bin-canonical-test',revision:0,idempotencyKey:randomUUID(),ticket:{customerName:'BIN TEST'}} as Parameters<typeof buying.executeBuyingCommand>[0],user);
    const save=async(next:Ticket,binAcknowledgment?:Record<string,unknown>)=>buying.executeBuyingCommand({action:'SAVE',id:draft.id,revision:draft.buying!.revision,idempotencyKey:randomUUID(),ticket:next,binAcknowledgment} as Parameters<typeof buying.executeBuyingCommand>[0],user);
    const capture=async(type:'SCALE_IN'|'SCALE_OUT',lbs:number)=>{
      const id=randomUUID();const at=new Date().toISOString();
      const reading={id,scaleId:null,originalWeight:lbs,originalUnit:'LBS' as const,normalizedLbs:lbs,actorId:user.id,capturedAt:at,stable:false,source:'MANUAL' as const};
      draft=await save({...draft,selectedWeighingType:'VEHICLE_IN_OUT',...(type==='SCALE_IN'?{scaleGrossInWeight:lbs,scaleGrossInAt:at}:{scaleTareOutWeight:lbs,scaleTareOutAt:at}),weightTransactions:[...(draft.weightTransactions??[]),{id,type,weightLbs:lbs,recordedAt:at,capture:reading}]});
    };
    await capture('SCALE_IN',2000);const firstCycle=draft.buying!.activeCycleId!;
    await capture('SCALE_OUT',1000); // Missing review does not gate OUT.
    const revision=draft.buying!.revision;
    const review={cycleId:firstCycle,revision:1,catalogRevision:1,items:[{itemId:'tire',name:'Tire',quantity:2,poundsPerUnit:150}],totalLbs:300,employeeId:user.id,employeeName:user.fullName,submittedAt:new Date().toISOString()};
    await db.query('INSERT INTO bin_inspection_reviews(cycle_id,revision,document,actor_id) VALUES($1,1,$2::jsonb,$3)',[firstCycle,JSON.stringify(review),user.id]);
    expect((await db.query('SELECT revision FROM scrap_buying_tickets WHERE ticket_id=$1',[draft.id])).rows[0].revision).toBe(revision);
    const line={id:randomUUID(),metalGradeId:grade.id,metalName:grade.name,metalCategory:grade.category,...validatedItemBreakdown(2000,1000,review.items,grade.ratePerLb),weighingMode:'VEHICLE_IN_OUT' as const,sourceCaptureIds:draft.weightTransactions!.map(row=>row.id),loadNumber:1};
    const next={...draft,scaleGrossInWeight:undefined,scaleGrossInAt:undefined,scaleTareOutWeight:undefined,scaleTareOutAt:undefined,scrapLines:[line]};
    await expect(save(next,{cycleId:firstCycle,reviewRevision:0,missingReviewAcknowledged:true})).rejects.toThrow('Bin review changed');
    await expect(save({...next,scrapLines:[{...line,deductionPercent:10,deductionReason:'forged'}]},{cycleId:firstCycle,reviewRevision:1})).rejects.toThrow('cannot combine');
    await expect(save({...next,scrapLines:[{...line,deductionLbs:1}]},{cycleId:firstCycle,reviewRevision:1})).rejects.toThrow('calculations conflict');
    draft=await save(next,{cycleId:firstCycle,reviewRevision:1});
    expect(draft.scrapLines![0]).toMatchObject({binReview:review,netWeight:1000,billableWeight:700,deductionPercent:0});
    expect((await db.query('SELECT result FROM scrap_buying_events WHERE ticket_id=$1 ORDER BY revision DESC LIMIT 1',[draft.id])).rows[0].result.scrapLines[0].binReview).toEqual(review);
    await capture('SCALE_IN',3000);await capture('SCALE_OUT',2000);const secondCycle=draft.buying!.activeCycleId!;
    expect(secondCycle).not.toBe(firstCycle);
    const second={...line,id:randomUUID(),loadNumber:2,...validatedItemBreakdown(3000,2000,[],grade.ratePerLb),sourceCaptureIds:draft.weightTransactions!.slice(-2).map(row=>row.id)};
    const secondNext={...draft,scaleGrossInWeight:undefined,scaleGrossInAt:undefined,scaleTareOutWeight:undefined,scaleTareOutAt:undefined,scrapLines:[...draft.scrapLines!,second]};
    await expect(save(secondNext,{cycleId:secondCycle,reviewRevision:0})).rejects.toThrow('Explicit');
    draft=await save(secondNext,{cycleId:secondCycle,reviewRevision:0,missingReviewAcknowledged:true});
    expect(draft.scrapLines![1]).toMatchObject({deductionLbs:0,billableWeight:1000,missingBinReview:{cycleId:secondCycle,actorId:user.id}});
    expect(draft.scrapLines![1].binReview).toBeUndefined();
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
  it('logs browser-connected scale readings and reviews them without keyed manual weights',async()=>{
    const settings=(await db.query("SELECT value FROM app_state WHERE key='mahaffeys_settings'")).rows[0].value;
    const scales=['WEB_SERIAL','WEBSOCKET'].map(connectionType=>({id:`live-${connectionType}`,connectionType,weighingMode:'SINGLE_WEIGHT',supportedWeighingTypes:['PLATFORM'],capacityLbs:10000,resolutionLbs:1}));
    await db.withTransaction(client=>finance.putState(client,'mahaffeys_settings',{...settings,scales:[...settings.scales,...scales]},user.id));
    try {
      for(const scale of scales) {
        let draft=await buying.executeBuyingCommand(command('CREATE',{id:`live-ticket-${scale.connectionType}`,revision:0,ticket:{customerName:'LIVE SCALE TEST'}}) as Parameters<typeof buying.executeBuyingCommand>[0],user);
        const at=new Date().toISOString();const id=randomUUID();
        const capture={id,scaleId:scale.id,originalWeight:200,originalUnit:'LBS',normalizedLbs:200,actorId:user.id,capturedAt:at,stable:true,source:'SCALE'};
        const save={action:'SAVE',id:draft.id,revision:draft.buying!.revision,idempotencyKey:randomUUID(),ticket:{...draft,selectedWeighingType:'PLATFORM',pendingPlatformCapture:{capture,capturedLbs:200,tareLbs:0,tareTreatment:'NONE',isManual:false},weightTransactions:[{id,type:'SINGLE_WEIGHT',weightLbs:200,recordedAt:at,capture}]}};
        await expect(buying.executeBuyingCommand({...save,ticket:{...save.ticket,pendingPlatformCapture:{...save.ticket.pendingPlatformCapture,capture:{...capture,stable:false}},weightTransactions:[{...save.ticket.weightTransactions[0],capture:{...capture,stable:false}}]}} as Parameters<typeof buying.executeBuyingCommand>[0],user)).rejects.toThrow();
        draft=await buying.executeBuyingCommand(save as Parameters<typeof buying.executeBuyingCommand>[0],user);
        expect(draft.pendingPlatformCapture?.isManual).toBe(false);
        expect(draft.weightTransactions?.[0].capture?.source).toBe('SCALE');
        const line={id:randomUUID(),metalGradeId:grade.id,metalName:grade.name,metalCategory:grade.category,...validatedBreakdown(200,0,0,0.5),deductionPercent:0,ratePerLb:0.5,weighingMode:'SINGLE_WEIGHT',sourceCaptureIds:[id],tareTreatment:'NONE',loadNumber:1};
        draft=await buying.executeBuyingCommand({action:'SAVE',id:draft.id,revision:draft.buying!.revision,idempotencyKey:randomUUID(),ticket:{...draft,pendingPlatformCapture:undefined,scrapLines:[line]}} as Parameters<typeof buying.executeBuyingCommand>[0],user);
        expect(draft.scrapLines?.[0].netWeight).toBe(200);
        expect(draft.buying!.activeCycleId).toBeUndefined();
      }
    } finally {
      await db.withTransaction(client=>finance.putState(client,'mahaffeys_settings',settings,user.id));
    }
  });
  it('confirms one platform cycle and one payable line without auto-finalization',async()=>{
    const at=new Date().toISOString();const id=randomUUID();
    const capture={id,scaleId:'test-platform',originalWeight:200,originalUnit:'LBS' as const,normalizedLbs:200,actorId:user.id,capturedAt:at,stable:false,source:'MANUAL' as const};
    ticket=await buying.executeBuyingCommand({...command('SAVE'),ticket:{...ticket,selectedWeighingType:'PLATFORM',pendingPlatformCapture:{capture,capturedLbs:200,tareLbs:50,tareTreatment:'MANUAL',isManual:true},weightTransactions:[{id,type:'SINGLE_WEIGHT',weightLbs:200,recordedAt:at,capture}]}} as Parameters<typeof buying.executeBuyingCommand>[0],user);
    expect(ticket.buying!.activeCycleId).toBeTruthy();
    const line={id:randomUUID(),metalGradeId:grade.id,metalName:grade.name,metalCategory:grade.category,...validatedBreakdown(200,50,10,0.5),deductionPercent:10,ratePerLb:0.5,deductionReason:'TEST contamination',weighingMode:'SINGLE_WEIGHT',sourceCaptureIds:[id],tareTreatment:'MANUAL',loadNumber:1};
    ticket=await buying.executeBuyingCommand({...command('SAVE'),ticket:{...ticket,pendingPlatformCapture:undefined,scrapLines:[line]}} as Parameters<typeof buying.executeBuyingCommand>[0],user);
    expect(ticket.buying!.stage).toBe('DRAFT');expect(ticket.buying!.activeCycleId).toBeUndefined();
    expect(Number((await db.query('SELECT COUNT(*) FROM scrap_buying_line_sources WHERE line_id=$1',[line.id])).rows[0].count)).toBe(1);
    ticket=await buying.executeBuyingCommand(command('FINALIZE',{reviewed:true}) as Parameters<typeof buying.executeBuyingCommand>[0],user);
    expect(ticket.buying!.stage).toBe('FINALIZED');expect(ticket.buying!.payment).toBeUndefined();
  });
  it('chooses Check above the ferrous threshold without policy and records concurrent payment once',async()=>{
    const preview=await buying.previewPaymentEligibility(ticket.id,ticket.buying!.revision,user);
    expect(preview.allowedMethods).toEqual(['Check']);
    await expect(buying.executeBuyingCommand(command('PAY',{method:'Cash',disbursed:true}) as Parameters<typeof buying.executeBuyingCommand>[0],user)).rejects.toThrow();
    await expect(buying.executeBuyingCommand(command('PAY',{method:'Check',reference:'FIRST-001',disbursed:true}) as Parameters<typeof buying.executeBuyingCommand>[0],{...user,role:'yard_employee'})).rejects.toThrow();
    const responses=await Promise.all([1,2].map(()=>buying.executeBuyingCommand(command('PAY',{method:'Check',reference:'FIRST-001',disbursed:true}) as Parameters<typeof buying.executeBuyingCommand>[0],{...user,role:'scale_operator'})));
    expect(responses[0].buying!.payment!.id).toBe(responses[1].buying!.payment!.id);
    expect(responses[0].buying!.payment!.paymentRuleVersion).toBe('category-thresholds-v1');
    expect(Number((await db.query('SELECT COUNT(*) FROM scrap_buying_payments')).rows[0].count)).toBe(1);
    const drawer=(await db.query("SELECT value FROM app_state WHERE key='mahaffeys_cash_drawer'")).rows[0].value;
    expect(drawer.filter((row:{type:string})=>row.type==='PAYOUT_DISBURSEMENT')).toHaveLength(0);
    ticket=responses[0];
  });
  it('approved operators atomically complete Check purchases; invalid details roll back and retries preserve the actual number',async()=>{
    const original = ticket;
    const create = command('CREATE',{id:'combined-check-test',revision:0,ticket:{customerId:'test-seller',customerName:'TEST SELLER',customerPhone:'5550001234',customerIdNumber:'TEST-ID',vehicleLicensePlate:'TEST-PLATE',complianceCaptures:original.complianceCaptures}});
    ticket=await buying.executeBuyingCommand(create as Parameters<typeof buying.executeBuyingCommand>[0],user);
    const at=new Date().toISOString();const captureId=randomUUID();
    const capture={id:captureId,scaleId:'test-platform',originalWeight:100,originalUnit:'LBS',normalizedLbs:100,actorId:user.id,capturedAt:at,stable:false,source:'MANUAL'};
    ticket=await buying.executeBuyingCommand({...command('SAVE'),ticket:{...ticket,selectedWeighingType:'PLATFORM',pendingPlatformCapture:{capture,capturedLbs:100,tareLbs:0,tareTreatment:'NONE',isManual:true},weightTransactions:[{id:captureId,type:'SINGLE_WEIGHT',weightLbs:100,recordedAt:at,capture}]}} as Parameters<typeof buying.executeBuyingCommand>[0],user);
    const line={id:randomUUID(),metalGradeId:grade.id,metalName:grade.name,metalCategory:grade.category,...validatedBreakdown(100,0,0,0.5),deductionPercent:0,ratePerLb:0.5,weighingMode:'SINGLE_WEIGHT',sourceCaptureIds:[captureId],tareTreatment:'NONE',loadNumber:1};
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
  it('enforces all eight server-saved requirement combinations without fabricating identity or review',async()=>{
    const original=ticket;
    for(let mask=0;mask<8;mask++) {
      const flags={requirePhotos:false,requirePhone:false,requireAddress:false,requireSellerId:!!(mask&1),requireVehiclePlate:!!(mask&2),requireExplicitReview:!!(mask&4),revision:mask+1,updatedAt:null,updatedBy:user.fullName,reason:'SYNTHETIC TEST'};
      await db.withTransaction(client=>finance.putState(client,'mahaffeys_intake_requirements',flags,user.id));
      ticket=await buying.executeBuyingCommand(command('CREATE',{id:`optional-${mask}`,revision:0,ticket:{customerName:`TEST OPTIONAL ${mask}`,customerId:flags.requireSellerId?'test-seller':undefined,customerIdNumber:flags.requireSellerId?'TEST-ID':undefined,vehicleLicensePlate:flags.requireVehiclePlate?'TEST-PLATE':undefined}}) as Parameters<typeof buying.executeBuyingCommand>[0],{...user,role:'scale_operator'});
      const at=new Date().toISOString();const captureId=randomUUID();
      const capture={id:captureId,scaleId:'test-platform',originalWeight:100,originalUnit:'LBS',normalizedLbs:100,actorId:user.id,capturedAt:at,stable:false,source:'MANUAL'};
      ticket=await buying.executeBuyingCommand({...command('SAVE'),ticket:{...ticket,selectedWeighingType:'PLATFORM',pendingPlatformCapture:{capture,capturedLbs:100,tareLbs:0,tareTreatment:'NONE',isManual:true},weightTransactions:[{id:captureId,type:'SINGLE_WEIGHT',weightLbs:100,recordedAt:at,capture}]}} as Parameters<typeof buying.executeBuyingCommand>[0],user);
      const line={id:randomUUID(),metalGradeId:grade.id,metalName:grade.name,metalCategory:grade.category,...validatedBreakdown(100,0,0,0.5),deductionPercent:0,ratePerLb:0.5,weighingMode:'SINGLE_WEIGHT',sourceCaptureIds:[captureId],tareTreatment:'NONE',loadNumber:1};
      ticket=await buying.executeBuyingCommand({...command('SAVE'),ticket:{...ticket,pendingPlatformCapture:undefined,scrapLines:[line]}} as Parameters<typeof buying.executeBuyingCommand>[0],user);
      const preview=await buying.previewPaymentEligibility(ticket.id,ticket.buying!.revision,user);
      expect(preview.allowedMethods).toContain('Check');
      if(!flags.requireSellerId) {
        expect(preview.allowedMethods).not.toContain('Cash');
        expect(preview.reasons).toEqual([]);
      }
      if(flags.requireExplicitReview) await expect(buying.executeBuyingCommand(command('FINALIZE_AND_PAY',{method:'Check',reference:`TEST-${mask}`,disbursed:true,reviewed:false}) as Parameters<typeof buying.executeBuyingCommand>[0],user)).rejects.toThrow();
      await expect(buying.executeBuyingCommand(command('FINALIZE_AND_PAY',{method:'Check',reference:'   ',disbursed:true,reviewed:flags.requireExplicitReview}) as Parameters<typeof buying.executeBuyingCommand>[0],user)).rejects.toThrow();
      const request=command('FINALIZE_AND_PAY',{method:'Check',reference:mask===0?' 0009042 ':`TEST-00${mask}-Ab`,disbursed:true,reviewed:flags.requireExplicitReview});
      const paid=await buying.executeBuyingCommand(request as Parameters<typeof buying.executeBuyingCommand>[0],{...user,role:'scale_operator'});
      expect(paid.buying!.stage).toBe('PAID');
      expect(paid.buying!.sellerIdentity).toEqual(flags.requireSellerId?{idType:'DRIVER LICENSE',idState:'SC',idNumber:'TEST-ID'}:undefined);
      expect(paid.buying!.intakeRequirementReview).toMatchObject({revision:flags.revision,requirePhotos:false,requirePhone:false,requireAddress:false,requireSellerId:flags.requireSellerId,requireVehiclePlate:flags.requireVehiclePlate,requireExplicitReview:flags.requireExplicitReview,reviewed:flags.requireExplicitReview});
      expect(paid.checkNumber).toBe(mask===0?'0009042':`TEST-00${mask}-Ab`);
      expect(paid.buying!.payment!.checkReference).toBe(paid.checkNumber);
      expect(await buying.executeBuyingCommand({...request,idempotencyKey:randomUUID()} as Parameters<typeof buying.executeBuyingCommand>[0],user)).toEqual(paid);
      expect(Number((await db.query('SELECT COUNT(*) FROM scrap_buying_payments WHERE ticket_id=$1',[ticket.id])).rows[0].count)).toBe(1);
    }
    // A forged client preference cannot remove server requirements, and preview still permits check-number entry.
    await db.withTransaction(client=>finance.putState(client,'mahaffeys_intake_requirements',{requirePhotos:false,requirePhone:false,requireAddress:false,requireSellerId:true,requireVehiclePlate:true,requireExplicitReview:true,revision:20},user.id));
    const draft={...original,id:'forged-optional',status:'PENDING',customerId:undefined,customerIdNumber:undefined,vehicleLicensePlate:undefined,buying:{version:1,revision:1,stage:'DRAFT'}};
    await db.query('INSERT INTO scrap_buying_tickets(ticket_id,revision,stage,document,created_by) VALUES($1,1,$2,$3::jsonb,$4)',[draft.id,'DRAFT',JSON.stringify(draft),user.id]);
    const preview=await buying.previewPaymentEligibility(draft.id,1,user);
    expect(preview.allowedMethods).toEqual([]);expect(preview.selectableMethods).toContain('Check');
    await expect(buying.executeBuyingCommand({...command('FINALIZE'),id:draft.id,revision:1,reviewed:false,ticket:{...draft,requireSellerId:false,requireVehiclePlate:false,requireExplicitReview:false}} as Parameters<typeof buying.executeBuyingCommand>[0],user)).rejects.toThrow();
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
  it('ignores old policy switches, preserves payment evidence and records cash even without drawer funds',async()=>{
    const original=ticket;
    const finalized={...original,id:'category-check',customerId:undefined,customerIdNumber:undefined,checkNumber:undefined,buying:{...original.buying!,revision:1,stage:'FINALIZED',sellerIdentity:undefined,payment:undefined}};
    await db.query('INSERT INTO scrap_buying_tickets(ticket_id,revision,stage,document,created_by) VALUES($1,1,$2,$3::jsonb,$4)',[finalized.id,'FINALIZED',JSON.stringify(finalized),user.id]);
    for(const enabled of [false,true]) {
      await db.withTransaction(client=>finance.putState(client,'mahaffeys_payment_safeguards',{enabled,revision:7},user.id));
      expect((await buying.previewPaymentEligibility(finalized.id,1,user)).allowedMethods).toEqual(['Check']);
    }
    const request={...command('PAY'),id:finalized.id,revision:1,method:'Check',reference:'CATEGORY-009',disbursed:true};
    const paid=await Promise.all([1,2].map(()=>buying.executeBuyingCommand(request as Parameters<typeof buying.executeBuyingCommand>[0],user)));
    expect(paid[0].buying!.payment!.id).toBe(paid[1].buying!.payment!.id);
    expect(paid[0].buying!.payment!.paymentRuleVersion).toBe('category-thresholds-v1');
    expect(paid[0].buying!.payment!.safeguardReview).toBeUndefined();
    expect(await buying.executeBuyingCommand({...request,idempotencyKey:randomUUID()} as Parameters<typeof buying.executeBuyingCommand>[0],user)).toEqual(paid[0]);
    const duplicate={...finalized,id:'category-duplicate'};
    await db.query('INSERT INTO scrap_buying_tickets(ticket_id,revision,stage,document,created_by) VALUES($1,1,$2,$3::jsonb,$4)',[duplicate.id,'FINALIZED',JSON.stringify(duplicate),user.id]);
    await expect(buying.executeBuyingCommand({...request,id:duplicate.id,idempotencyKey:randomUUID(),reference:'category-009'} as Parameters<typeof buying.executeBuyingCommand>[0],user)).rejects.toThrow();
    await expect(db.query('INSERT INTO scrap_buying_payments(ticket_id,id,amount,method,document) VALUES($1,$2,10,$3,$4::jsonb)',[duplicate.id,randomUUID(),'Cash',JSON.stringify({})])).rejects.toThrow();
    const cashTicket={...finalized,id:'category-cash',finalPayout:10};
    await db.query('INSERT INTO scrap_buying_tickets(ticket_id,revision,stage,document,created_by) VALUES($1,1,$2,$3::jsonb,$4)',[cashTicket.id,'FINALIZED',JSON.stringify(cashTicket),user.id]);
    await db.withTransaction(client=>finance.putState(client,'mahaffeys_cash_drawer',[],user.id));
    const cashRequest={...command('PAY'),id:cashTicket.id,revision:1,method:'Cash',disbursed:true};
    const cash=await Promise.all([1,2].map(()=>buying.executeBuyingCommand({...cashRequest,idempotencyKey:randomUUID()} as Parameters<typeof buying.executeBuyingCommand>[0],user)));
    expect(cash[0].buying!.payment!.id).toBe(cash[1].buying!.payment!.id);
    const drawer=(await db.query("SELECT value FROM app_state WHERE key='mahaffeys_cash_drawer'")).rows[0].value;
    expect(drawer.filter((row:{ticketId?:string})=>row.ticketId===cashTicket.id)).toHaveLength(1);
    expect(drawer.at(-1).balanceAfter).toBe(-10);
    ticket=original;
  });
});
