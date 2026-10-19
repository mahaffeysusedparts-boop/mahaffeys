import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaymentSafeguards } from '../../src/types/paymentSafeguards';

const mocks=vi.hoisted(()=>({body:{} as Record<string,unknown>,admin:vi.fn(),audit:vi.fn(),states:new Map<string,unknown>(),lock:vi.fn()}));
vi.mock('nitro',()=>({defineHandler:(handler:unknown)=>handler}));
vi.mock('nitro/h3',()=>({assertBodySize:vi.fn(),readBody:async()=>mocks.body,createError:({statusCode,statusMessage}:{statusCode:number;statusMessage:string})=>Object.assign(new Error(statusMessage),{statusCode})}));
vi.mock('./auth',()=>({requireAdmin:mocks.admin}));
vi.mock('./audit',()=>({auditFor:(_user:unknown,entry:unknown)=>entry,recordAudit:mocks.audit}));
vi.mock('./db',()=>({withTransaction:async(fn:(client:unknown)=>unknown)=>fn({})}));
vi.mock('./financialState',()=>({lockFinancialState:mocks.lock,stateValue:async(_client:unknown,key:string,fallback:unknown)=>mocks.states.get(key)??fallback,putState:async(_client:unknown,key:string,value:unknown)=>{mocks.states.set(key,value);}}));
import route from '../routes/api/scrap-buying/safeguards.put';
const handler=route as unknown as (event:unknown)=>Promise<PaymentSafeguards>;

beforeEach(()=>{
  mocks.states.clear();mocks.admin.mockReset();mocks.audit.mockReset();mocks.lock.mockReset();
  mocks.admin.mockResolvedValue({id:'test-admin',fullName:'Test admin',role:'admin'});
  mocks.body={enabled:false,revision:0,reason:'Synthetic admin override'};
});
describe('revisioned administrator payment safeguard endpoint',()=>{
  it('records disabling and re-enabling with administrator attribution and revision history',async()=>{
    const disabled=await handler({});
    expect(disabled).toMatchObject({enabled:false,revision:1,updatedBy:'Test admin',reason:'Synthetic admin override'});
    expect(mocks.states.get('mahaffeys_payment_safeguards_revision_1')).toEqual(disabled);
    expect(mocks.audit).toHaveBeenCalled();expect(mocks.lock).toHaveBeenCalled();
    mocks.body={enabled:true,revision:1,reason:'Re-enable safeguards'};
    expect(await handler({})).toMatchObject({enabled:true,revision:2});
    expect(mocks.states.get('mahaffeys_payment_safeguards_revision_1')).toEqual(disabled);
  });
  it('cannot change settings if administrator authorization rejects the request',async()=>{
    mocks.admin.mockRejectedValue(new Error('Administrator required'));
    await expect(handler({})).rejects.toThrow('Administrator required');
    expect(mocks.states.size).toBe(0);
  });
  it('rejects stale changes and retains the original override history',async()=>{
    const saved=await handler({});
    mocks.body={enabled:true,revision:0,reason:'Stale attempt'};
    await expect(handler({})).rejects.toThrow('another workstation');
    expect(mocks.states.get('mahaffeys_payment_safeguards')).toEqual(saved);
  });
  it.each([{enabled:false,revision:0,reason:' '},{enabled:'false',revision:0,reason:'Bad flag'},{enabled:false,revision:0,reason:'Injected',policy:{}}])('rejects invalid or injected values %j',async body=>{
    mocks.body=body;
    await expect(handler({})).rejects.toThrow('Choose the safeguard state');
    expect(mocks.states.size).toBe(0);
  });
});
