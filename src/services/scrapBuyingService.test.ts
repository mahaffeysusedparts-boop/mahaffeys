import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ticket } from '../types/scrap';
const mocks = vi.hoisted(()=>({request:vi.fn(),apply:vi.fn()}));
vi.mock('./apiClient',()=>({apiRequest:mocks.request}));
vi.mock('./sharedStorage',()=>({sharedStorage:{applyServerValue:mocks.apply}}));
vi.mock('./storageService',()=>({storageService:{getTickets:()=>[]}}));
const draft = {id:'test-ticket',buying:{version:1,revision:4,stage:'DRAFT'}} as Ticket;
const paid = {...draft,payoutMethod:'Check',checkNumber:'000123-A',buying:{...draft.buying!,revision:5,stage:'PAID',payment:{id:'payment',method:'Check',checkReference:'000123-A'}}} as Ticket;

beforeEach(()=>{
  vi.resetModules();mocks.request.mockReset();mocks.apply.mockReset();
  const store=new Map<string,string>();
  vi.stubGlobal('sessionStorage',{getItem:(key:string)=>store.get(key)??null,setItem:(key:string,value:string)=>store.set(key,value),removeItem:(key:string)=>store.delete(key)});
});
describe('buying payment requests',()=>{
  it('uses combined command, preserves actual number and repeats the same key after an uncertain response and module reload',async()=>{
    mocks.request.mockRejectedValueOnce(new Error('Uncertain response'));
    let service=(await import('./scrapBuyingService')).scrapBuyingService;
    await expect(service.completeAndPay(draft,'Check',' 000123-A ','','',true)).rejects.toThrow('Uncertain');
    const first=JSON.parse(mocks.request.mock.calls[0][1].body);
    expect(first).toMatchObject({action:'FINALIZE_AND_PAY',method:'Check',reference:'000123-A',reviewed:true,disbursed:true,revision:4});
    vi.resetModules();
    service=(await import('./scrapBuyingService')).scrapBuyingService;
    mocks.request.mockResolvedValueOnce(paid).mockResolvedValueOnce({state:{}});
    expect(await service.completeAndPay(draft,'Check',' 000123-A ','','',true)).toEqual(paid);
    const retry=JSON.parse(mocks.request.mock.calls[1][1].body);
    expect(retry.idempotencyKey).toBe(first.idempotencyKey);
    expect(mocks.request.mock.calls.filter(([url])=>url==='/api/scrap-buying/commands')).toHaveLength(2);
  });
  it('retains PAY for finalized purchases and sends no stray check number for cash',async()=>{
    mocks.request.mockResolvedValueOnce(paid).mockResolvedValueOnce({state:{}});
    const service=(await import('./scrapBuyingService')).scrapBuyingService;
    await service.pay({...draft,buying:{...draft.buying!,stage:'FINALIZED'}},'Cash','old unused check','permit');
    expect(JSON.parse(mocks.request.mock.calls[0][1].body)).toMatchObject({action:'PAY',method:'Cash',reference:'',reviewed:false,disbursed:true});
  });
  it('does not manufacture review acknowledgement when completion has no review',async()=>{
    mocks.request.mockResolvedValueOnce(paid).mockResolvedValueOnce({state:{}});
    const service=(await import('./scrapBuyingService')).scrapBuyingService;
    await service.completeAndPay(draft,'Check',' 0009042 ','','',false);
    expect(JSON.parse(mocks.request.mock.calls[0][1].body)).toMatchObject({reviewed:false,reference:'0009042',disbursed:true});
  });
  it.each(['',' ','\t\n'])('rejects blank Check reference %j before sending a request',async reference=>{
    const service=(await import('./scrapBuyingService')).scrapBuyingService;
    await expect(service.completeAndPay(draft,'Check',reference,'','',false)).rejects.toThrow('actual issued check number');
    await expect(service.pay(draft,'Check',reference,'')).rejects.toThrow('actual issued check number');
    expect(mocks.request).not.toHaveBeenCalled();
  });
});
