import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { DEFAULT_BIN_CATALOG, type BinReview, type BinDeductionCatalog } from '../src/types/binDeductions';
import { resolveBinSelections } from '../src/utils/binDeductionRules';
import { validatedItemBreakdown, itemDeductionTotal } from '../src/utils/weighingContract';
import type { Ticket } from '../src/types/scrap';

test.setTimeout(120000);
// Independent browsers share only this synthetic API. No yard records or payments are written.
function syntheticServer() {
  const cycleId = '00000000-0000-4000-8000-000000000001';
  const now = new Date().toISOString();
  const captureId = '00000000-0000-4000-8000-000000000010';
  let catalog: BinDeductionCatalog = structuredClone(DEFAULT_BIN_CATALOG);
  let review: BinReview | null = null;
  let failSubmission = false;
  let ticket = { id:'BIN-SYNC',ticketType:'SCRAP_METAL',customerName:'Bin Test Seller',vehicleLicensePlate:'BIN-251',customerIdNumber:'PRIVATE-ID',createdAt:now,status:'PENDING',operatorName:'Scale Tester',grossTotal:0,totalDeductions:0,finalPayout:0,payoutMethod:'Cash',selectedWeighingType:'VEHICLE_IN_OUT',scaleGrossInWeight:2000,scaleGrossInAt:now,
    buying:{version:1,revision:1,stage:'DRAFT',activeCycleId:cycleId,cycleNumber:1},scrapLines:[],weightTransactions:[{id:captureId,type:'SCALE_IN',weightLbs:2000,recordedAt:now,capture:{id:captureId,scaleId:'truck',originalWeight:2000,originalUnit:'LBS',normalizedLbs:2000,actorId:'scale',capturedAt:now,stable:true,source:'SCALE'}}] } as Ticket;
  const metal = {id:'grade',name:'Test Ferrous',code:'TEST',category:'Ferrous',ratePerLb:0.1};
  const settings = {yardName:'Synthetic Yard',operatorName:'Scale Tester',defaultWeightUnit:'LBS',currentScaleId:'truck',scales:[{id:'truck',name:'Truck',connectionType:'TCP',weighingMode:'VEHICLE_IN_OUT',supportedWeighingTypes:['VEHICLE_IN_OUT'],capacityLbs:10000,resolutionLbs:1}]};
  const state = () => ({mahaffeys_tickets:[ticket],mahaffeys_metals:[metal],mahaffeys_settings:settings,mahaffeys_cash_drawer:[]});
  const cycle = () => ({cycleId,ticketId:ticket.id,number:1,sellerName:ticket.customerName,plate:ticket.vehicleLicensePlate,inLbs:2000,open:!!ticket.buying?.activeCycleId,review});
  return {
    failNextSubmission: () => { failSubmission = true; },
    getTicket: () => ticket,
    async attach(context: BrowserContext, role: 'yard_employee'|'scale_operator'|'admin') {
      const user = {id:role,fullName:role === 'yard_employee' ? 'Bin Employee' : 'Scale Tester',username:role,role,status:'approved',createdAt:now};
      await context.addInitScript(values => { for (const [key,value] of Object.entries(values)) localStorage.setItem(key,JSON.stringify(value)); }, state());
      await context.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        const path = url.pathname;
        const method = route.request().method();
        let response: unknown = {ok:true};
        if (path === '/api/auth/status') response={user,hasAdmin:true};
        else if (path === '/api/users') response={users:[user]};
        else if (path === '/api/state') response={state:state()};
        else if (path === '/api/state/since') response={entries:Object.entries(state()).map(([key,value])=>({key,value,updatedAt:new Date().toISOString(),updatedBy:'scale_operator'})),serverTime:new Date().toISOString()};
        else if (path === '/api/printers') response=[];
        else if (path === '/api/scale/status') response={connected:true,weight:1000,unit:'LBS',isStable:true,isZero:false,registry:[]};
        else if (path === '/api/scrap-buying/queue') response={tickets:[ticket],policy:null,legacyReviews:[]};
        else if (path === '/api/scrap-buying/requirements') response={revision:1,requirePhotos:false,requirePhone:false,requireAddress:false,requireSellerId:false,requireVehiclePlate:false,requireExplicitReview:false};
        else if (path === '/api/scrap-buying/eligibility') response={allowedMethods:[],selectableMethods:[],reasons:[],permitRequired:false,documentationRequired:false};
        else if (path === '/api/scrap-buying/bin-deduction-catalog') {
          if (method === 'PUT') { expect(role).toBe('admin'); const body=route.request().postDataJSON(); expect(body.revision).toBe(catalog.revision); catalog={...body,revision:catalog.revision+1}; }
          response=catalog;
        } else if (path === '/api/scrap-buying/bin-inspections') {
          if (method === 'POST') {
            if (failSubmission) { failSubmission=false; await route.fulfill({status:503,json:{statusMessage:'Synthetic server unavailable'}}); return; }
            const body=route.request().postDataJSON();
            expect(role).toBe('yard_employee'); expect(body.cycleId).toBe(cycleId); expect(body.expectedRevision).toBe(review?.revision ?? 0);
            expect(Object.keys(body).sort()).toEqual(['catalogRevision','cycleId','expectedRevision','selections']);
            const items=resolveBinSelections(catalog,body.selections);
            review={cycleId,revision:(review?.revision ?? 0)+1,catalogRevision:catalog.revision,items,totalLbs:itemDeductionTotal(items),employeeId:user.id,employeeName:user.fullName,submittedAt:new Date().toISOString()};
            response=review;
          } else response={cycles:url.searchParams.has('cycleId') || ticket.buying?.activeCycleId ? [cycle()] : []};
        } else if (path === '/api/scrap-buying/commands') {
          const body=route.request().postDataJSON(); expect(role).not.toBe('yard_employee');
          if (body.action === 'SAVE') {
            if (body.ticket.scrapLines.length) {
              expect(body.binAcknowledgment.reviewRevision).toBe(review?.revision ?? 0);
              const line=body.ticket.scrapLines[0];
              expect(line.deductionPercent).toBe(0);
              Object.assign(line,validatedItemBreakdown(2000,1000,review?.items ?? [],0.1));
              if (review) line.binReview=review;
              else { expect(body.binAcknowledgment.missingReviewAcknowledged).toBe(true); line.missingBinReview={cycleId,actorId:user.id,actorName:user.fullName,acknowledgedAt:new Date().toISOString()}; }
              body.ticket.buying={...ticket.buying,activeCycleId:undefined};
            }
            ticket={...body.ticket,buying:{...body.ticket.buying,revision:ticket.buying!.revision+1}};
          } else expect(body.action).toBe('ADOPT');
          response=ticket;
        }
        await route.fulfill({json:response});
      });
    },
  };
}
async function openDesk(page: Page) {
  await page.goto('/intake');
  await page.getByText('Start Metal Scrap Ticket',{exact:true}).click();
  await page.getByRole('button',{name:/Switch to This Intake|Continue This Intake/}).click();
}

test('Employee retry and correction sync live without stale weighing conflicts; late review replaces missing acknowledgment', async ({browser}) => {
  const contexts=await Promise.all([browser.newContext(),browser.newContext()]);
  try {
    const server=syntheticServer(); await server.attach(contexts[0],'scale_operator'); await server.attach(contexts[1],'yard_employee');
    const desk=await contexts[0].newPage(); const employee=await contexts[1].newPage();
    await openDesk(desk);
    const card=desk.getByRole('region',{name:'Bin Review'});
    await expect(card.getByText('Awaiting bin review.',{exact:false})).toBeVisible();
    await card.getByRole('checkbox').check();
    await desk.getByRole('button',{name:/LOG OUT WEIGHT/}).click();
    await expect(desk.getByText('Net Scrap',{exact:true})).toBeVisible();
    await expect(desk.getByRole('button',{name:/Add Load · Keep Ticket Open/})).toBeEnabled();
    await employee.goto('/bin-inspection');
    await employee.getByRole('button',{name:/Ticket BIN-SYNC · Load 1/}).click();
    await expect(employee.getByText('PRIVATE-ID',{exact:false})).toHaveCount(0);
    await employee.getByRole('button',{name:'Increase Tire',exact:true}).click();
    await contexts[1].setOffline(true);
    await expect(employee.getByText('Offline — not submitted',{exact:true})).toBeVisible();
    await employee.getByRole('button',{name:'Submit bin review',exact:true}).click();
    await expect(card.getByText('Item deduction total: 150 lb',{exact:true})).toHaveCount(0);
    await contexts[1].setOffline(false);
    await expect(employee.getByText('Unsaved',{exact:true})).toBeVisible();
    server.failNextSubmission();
    await employee.getByRole('button',{name:'Submit bin review',exact:true}).click();
    await expect(employee.getByText('Failed / Retry',{exact:true})).toBeVisible();
    await expect(employee.getByRole('spinbutton',{name:'Tire quantity',exact:true})).toHaveValue('1');
    await employee.getByRole('button',{name:'Submit bin review',exact:true}).click();
    await expect(employee.getByText('Saved on server',{exact:true})).toBeVisible();
    await expect(card.getByText('Item deduction total: 150 lb',{exact:true})).toBeVisible();
    expect(server.getTicket().buying!.revision).toBe(2); // The employee did not mutate this revision.
    await expect(desk.getByText('This ticket changed or closed remotely',{exact:false})).toHaveCount(0);
    await employee.getByRole('button',{name:'Increase Tire',exact:true}).click();
    await expect(employee.getByText('Unsaved',{exact:true})).toBeVisible();
    await employee.getByRole('button',{name:'Submit bin review',exact:true}).click();
    await expect(card.getByText('Item deduction total: 300 lb',{exact:true})).toBeVisible();
    await desk.getByRole('button',{name:/Add Load · Keep Ticket Open/}).click();
    await expect(desk.getByRole('cell',{name:'700 lb',exact:true})).toBeVisible();
    expect(server.getTicket().scrapLines![0]).toMatchObject({netWeight:1000,deductionLbs:300,billableWeight:700,binReview:{revision:2}});
    expect(server.getTicket().scrapLines![0].missingBinReview).toBeUndefined();
    await expect(employee.getByText('Read-only: this review cannot be edited.',{exact:true})).toBeVisible();
    await desk.goto('/tickets'); await desk.getByRole('button',{name:'Receipt',exact:true}).click();
    await expect(desk.getByRole('dialog').getByText('Item deduction total: 300 lb',{exact:true})).toHaveCount(2);
  } finally { await Promise.all(contexts.map(context=>context.close())); }
});

test('OUT remains warning-only and confirming without review requires recorded explicit acknowledgment', async ({browser}) => {
  const context=await browser.newContext();
  try {
    const server=syntheticServer(); await server.attach(context,'scale_operator'); const page=await context.newPage();
    await openDesk(page);
    await page.getByRole('button',{name:/LOG OUT WEIGHT/}).click();
    const confirm=page.getByRole('button',{name:/Add Load · Keep Ticket Open/});
    await expect(confirm).toBeDisabled();
    await page.getByRole('region',{name:'Bin Review'}).getByRole('checkbox').check();
    await confirm.click();
    await expect(page.getByRole('cell',{name:'1,000 lb',exact:true}).last()).toBeVisible();
    expect(server.getTicket().scrapLines![0]).toMatchObject({deductionLbs:0,missingBinReview:{actorId:'scale_operator'}});
    await page.goto('/tickets'); await page.getByRole('button',{name:'Receipt',exact:true}).click();
    await expect(page.getByRole('dialog').getByText(/No bin review; no item deduction. Explicitly acknowledged by Scale Tester/)).toHaveCount(2);
  } finally { await context.close(); }
});

test('An empty server review is distinct from missing review and needs no missing acknowledgment', async ({browser}) => {
  const contexts=await Promise.all([browser.newContext(),browser.newContext()]);
  try {
    const server=syntheticServer(); await server.attach(contexts[0],'yard_employee'); await server.attach(contexts[1],'scale_operator');
    const employee=await contexts[0].newPage(); await employee.goto('/bin-inspection');
    await employee.getByRole('button',{name:/Ticket BIN-SYNC · Load 1/}).click();
    await employee.getByRole('button',{name:'No deduction items found',exact:true}).click();
    await expect(employee.getByText('Saved on server',{exact:true})).toBeVisible();
    const desk=await contexts[1].newPage(); await openDesk(desk);
    const card=desk.getByRole('region',{name:'Bin Review'});
    await expect(card.getByText('No deduction items found',{exact:true})).toBeVisible();
    await expect(card.getByRole('checkbox')).toHaveCount(0);
    await desk.getByRole('button',{name:/LOG OUT WEIGHT/}).click();
    const confirm=desk.getByRole('button',{name:/Add Load · Keep Ticket Open/});
    await expect(confirm).toBeEnabled(); await confirm.click();
    await expect(desk.getByRole('cell',{name:'1,000 lb',exact:true}).last()).toBeVisible();
    expect(server.getTicket().scrapLines![0].binReview).toMatchObject({revision:1,items:[],totalLbs:0});
    expect(server.getTicket().scrapLines![0].missingBinReview).toBeUndefined();
  } finally { await Promise.all(contexts.map(context=>context.close())); }
});

test('Administrator saves a revised fixed weight and scale operators only read inspections', async ({browser}) => {
  const contexts=await Promise.all([browser.newContext(),browser.newContext()]);
  try {
    const server=syntheticServer(); await server.attach(contexts[0],'admin'); await server.attach(contexts[1],'scale_operator');
    const admin=await contexts[0].newPage(); await admin.goto('/settings');
    await admin.getByRole('spinbutton',{name:'Item 2 pounds',exact:true}).fill('175');
    await admin.getByRole('button',{name:'Save bin deduction items',exact:true}).click();
    await expect(admin.getByText('Catalog revision 2',{exact:true})).toBeVisible();
    const scale=await contexts[1].newPage(); await scale.goto('/bin-inspection');
    await scale.getByRole('button',{name:/Ticket BIN-SYNC · Load 1/}).click();
    await expect(scale.getByText('Read-only: this review cannot be edited.',{exact:true})).toBeVisible();
    await expect(scale.getByRole('button',{name:'Submit bin review',exact:true})).toHaveCount(0);
  } finally { await Promise.all(contexts.map(context=>context.close())); }
});
