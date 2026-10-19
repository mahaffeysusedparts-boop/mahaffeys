import { describe, expect, it } from 'vitest';
import { evaluateBuyingPaymentRules } from './buyingPaymentRules';
import { canRecordBuyingPayment } from './buyingAuthorization';
import type { BuyingPolicy } from '../types/buyingPayments';
import type { MetalGrade, Ticket } from '../types/scrap';

const metal = { id:'grade', name:'Test', code:'T', category:'Ferrous', ratePerLb:1 } as MetalGrade;
const policy: BuyingPolicy = { version:'test', sourceUrl:'https://www.scstatehouse.gov/code/t16c017.php', effectiveFrom:'2020-01-01', effectiveThrough:'2099-12-31', reviewer:'TEST ONLY', reviewReference:'TEST ONLY', grades:[{gradeId:metal.id,classification:'TEST',approved:true,requirePermit:false,paymentClass:'FERROUS',cashAtOrAboveCents:null,sellerDayCashLimitCents:null,definition:{name:metal.name,code:metal.code,category:metal.category}}] };
const ticket = (amount: number, category = 'Ferrous') => ({id:'ticket',finalPayout:amount,buying:{version:1,revision:3,stage:'FINALIZED',sellerIdentity:{idType:'STATE ID',idState:'SC',idNumber:'TEST-ID'}},scrapLines:[{metalGradeId:metal.id,metalCategory:category}]} as Ticket);
const history = { cashCents:0, cashCount:0, unresolved:false, drawerBalance:1000 };
const rules = (amount: number, paymentClass: NonNullable<BuyingPolicy['grades'][number]['paymentClass']> = 'FERROUS', extra = {}, overrides = {}) => evaluateBuyingPaymentRules(ticket(amount,paymentClass==='FERROUS'?'Ferrous':'Non-Ferrous'), {...policy,grades:[{...policy.grades[0],paymentClass,...overrides}]},[metal],'2026-01-01',{...history,...extra});

describe('routine buying authority',()=>{
  it.each(['scale_operator','yard_manager','admin'])('approved %s can pay',role=>expect(canRecordBuyingPayment({role,status:'approved'})).toBe(true));
  it.each(['pending','disabled','rejected'])('a %s account cannot pay',status=>expect(canRecordBuyingPayment({role:'scale_operator',status})).toBe(false));
  it('rejects employee and unauthenticated users',()=>{ expect(canRecordBuyingPayment({role:'yard_employee',status:'approved'})).toBe(false);expect(canRecordBuyingPayment(null)).toBe(false); });
});

describe('payment rule boundaries and fail-closed setup',()=>{
  it.each([[100,true],[100.01,false]])('ferrous yard cap at $%s', (amount,allowed)=>expect(rules(amount).allowedMethods.includes('Cash')).toBe(allowed));
  it.each([[25,true],[25.01,false]])('ordinary nonferrous yard cap at $%s',(amount,allowed)=>expect(rules(amount,'NONFERROUS').allowedMethods.includes('Cash')).toBe(allowed));
  it.each(['COPPER','BEER_KEG'] as const)('%s law is stricter at exact $25',type=>{expect(rules(24.99,type).allowedMethods).toEqual(['Cash','Check']);expect(rules(25,type).allowedMethods).toEqual(['Check']);expect(rules(25,type).reasons.some(reason=>reason.code==='SC_CHECK_REQUIRED')).toBe(true);});
  it('restricts seller/day count even when the previous cash purchase was small',()=>expect(rules(1,'COPPER',{cashCents:1,cashCount:1}).allowedMethods).toEqual(['Check']));
  it('preserves inclusive daily and exclusive transaction policy boundaries',()=>{expect(rules(10,'FERROUS',{cashCents:1000},{sellerDayCashLimitCents:2000}).allowedMethods).toContain('Cash');expect(rules(10.01,'FERROUS',{cashCents:1000},{sellerDayCashLimitCents:2000}).allowedMethods).toEqual(['Check']);expect(rules(10,'FERROUS',{}, {cashAtOrAboveCents:1000}).allowedMethods).toEqual(['Check']);});
  it('mixed loads use the most restrictive class without splitting amounts',()=>{
    const mixed = {...ticket(25),scrapLines:[...ticket(25).scrapLines!,{metalGradeId:'copper',metalCategory:'Non-Ferrous'}]} as Ticket;
    const p = {...policy,grades:[...policy.grades,{...policy.grades[0],gradeId:'copper',paymentClass:'COPPER' as const}]};
    expect(evaluateBuyingPaymentRules(mixed,p,[metal,{...metal,id:'copper'}],'2026-01-01',history).allowedMethods).toEqual(['Check']);
  });
  it('requires nonferrous seller documentation and permits but not aluminum-can permits',()=>{expect(rules(10,'NONFERROUS').permitRequired).toBe(true);expect(rules(10,'NONFERROUS').documentationRequired).toBe(true);expect(rules(10,'ALUMINUM_CANS').permitRequired).toBe(false);});
  it('never allows payment with absent, expired, or unclassified policy',()=>{
    expect(evaluateBuyingPaymentRules(ticket(1),null,[metal],'2026-01-01',history).allowedMethods).toEqual([]);
    expect(evaluateBuyingPaymentRules(ticket(1),{...policy,effectiveThrough:'2025-01-01'},[metal],'2026-01-01',history).allowedMethods).toEqual([]);
    expect(rules(1,'FERROUS',{}, {paymentClass:undefined}).allowedMethods).toEqual([]);
  });
  it('blocks unknown, changed and specialized material definitions',()=>{expect(rules(1,'FERROUS',{}, {approved:false}).allowedMethods).toEqual([]);expect(rules(1,'FERROUS',{}, {definition:{name:'changed',code:'T',category:'Ferrous'}}).allowedMethods).toEqual([]);expect(rules(1,'REQUIRES_SPECIAL_DOCUMENTATION').allowedMethods).toEqual([]);});
  it('blocks cash, not check, for insufficient drawer or unresolved history',()=>{expect(rules(1,'FERROUS',{drawerBalance:0}).allowedMethods).toEqual(['Check']);expect(rules(1,'FERROUS',{unresolved:true}).allowedMethods).toEqual(['Check']);});
  it('allows absent optional identity only where independently applicable rules permit',()=>{
    const absent = {...ticket(1),buying:{...ticket(1).buying!,sellerIdentity:undefined}};
    const unknown = {...history,cashCents:null,cashCount:null};
    expect(evaluateBuyingPaymentRules(absent,policy,[metal],'2026-01-01',unknown).allowedMethods).toEqual(['Cash','Check']);
    const dayLimited = {...policy,grades:[{...policy.grades[0],sellerDayCashLimitCents:1000}]};
    const result=evaluateBuyingPaymentRules(absent,dayLimited,[metal],'2026-01-01',unknown);
    expect(result.allowedMethods).toEqual(['Check']);
    expect(result.reasons.some(reason=>reason.code==='SELLER_DAY_IDENTITY_UNKNOWN')).toBe(true);
    const nonferrous = {...policy,grades:[{...policy.grades[0],paymentClass:'NONFERROUS' as const}]};
    expect(evaluateBuyingPaymentRules(absent,nonferrous,[metal],'2026-01-01',unknown).reasons.some(reason=>reason.code==='MATERIAL_SELLER_ID_REQUIRED')).toBe(true);
  });
  it('keeps Check selectable even when global blockers prevent payment',()=>{
    const result=rules(100,'NONFERROUS',{}, {approved:false});
    expect(result.allowedMethods).toEqual([]);
    expect(result.selectableMethods).toEqual(['Check']);
  });
  it('allows payment without policy setup only when the server disables safeguards',()=>{
    const override=evaluateBuyingPaymentRules(ticket(200),null,[metal],'2026-01-01',history,false);
    expect(override.allowedMethods).toEqual(['Cash','Check']);
    expect(override.policyVersion).toBeUndefined();
    expect(override.permitRequired).toBe(false);expect(override.documentationRequired).toBe(false);
    expect(evaluateBuyingPaymentRules(ticket(200),null,[metal],'2026-01-01',history,true).allowedMethods).toEqual([]);
  });
  it('re-enabling restores material, permit, documentation and cash rules',()=>{
    const p={...policy,grades:[{...policy.grades[0],paymentClass:'COPPER' as const}]};
    const purchase=ticket(25,'Non-Ferrous');
    const off=evaluateBuyingPaymentRules(purchase,p,[metal],'2026-01-01',history,false);
    expect(off.allowedMethods).toEqual(['Cash','Check']);expect(off.permitRequired).toBe(false);
    const on=evaluateBuyingPaymentRules(purchase,p,[metal],'2026-01-01',history,true);
    expect(on.allowedMethods).toEqual(['Check']);expect(on.permitRequired).toBe(true);expect(on.documentationRequired).toBe(true);
  });
  it('retains financial evidence, positive amount and drawer checks with safeguards off',()=>{
    expect(evaluateBuyingPaymentRules(ticket(10),null,[metal],'2026-01-01',{...history,drawerBalance:0},false).allowedMethods).toEqual(['Check']);
    expect(evaluateBuyingPaymentRules(ticket(10),null,[metal],'2026-01-01',{...history,unresolved:true},false).allowedMethods).toEqual(['Check']);
    expect(evaluateBuyingPaymentRules(ticket(0),null,[metal],'2026-01-01',history,false).allowedMethods).toEqual([]);
    expect(evaluateBuyingPaymentRules({...ticket(10),scrapLines:[]},null,[metal],'2026-01-01',history,false).allowedMethods).toEqual([]);
  });
});
