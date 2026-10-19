import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BuyingPaymentFields, buyingPaymentReady, initialBuyingPayment } from './BuyingPaymentFields';
import type { PaymentEligibility } from '@/types/buyingPayments';

const eligible: PaymentEligibility = {ticketId:'test',revision:1,allowedMethods:['Cash','Check'],selectableMethods:['Cash','Check'],reasons:[],permitRequired:false,documentationRequired:false};
describe('single actual check-number field',()=>{
  it.each(['',' ','\t'])('requires a nonblank Check reference %j',reference=>{
    expect(buyingPaymentReady(eligible,{...initialBuyingPayment,method:'Check',reference})).toBe(false);
  });
  it.each(['0009042','AB-009042'])('accepts actual text reference %s and does not mutate input',reference=>{
    const value={...initialBuyingPayment,method:'Check' as const,reference};
    expect(buyingPaymentReady(eligible,value)).toBe(true);
    const html=renderToStaticMarkup(createElement(BuyingPaymentFields,{eligibility:eligible,loading:false,value,onChange:vi.fn()}));
    expect(html).toContain('Record Check Number · Required');
    expect(html).toContain(`value="${reference}"`);
    expect(html).toContain('e.g. 9042');
    expect(value.reference).toBe(reference);
  });
  it('keeps a prominent editable check field even with intake eligibility blockers',()=>{
    const blocked={...eligible,allowedMethods:[],selectableMethods:['Check'],reasons:[{code:'INTAKE_NOT_READY',message:'Required photos missing'}]} as PaymentEligibility;
    const html=renderToStaticMarkup(createElement(BuyingPaymentFields,{eligibility:blocked,loading:false,value:{...initialBuyingPayment,method:'Check',reference:'0009042'},onChange:vi.fn()}));
    expect(html).toContain('Record Check Number · Required');
    expect(html).toContain('value="0009042"');
    expect(html).toContain('Required photos missing');
    expect(buyingPaymentReady(blocked,{...initialBuyingPayment,method:'Check',reference:'0009042'})).toBe(false);
  });
  it('Cash requires no check field or reference',()=>{
    expect(buyingPaymentReady(eligible,initialBuyingPayment)).toBe(true);
    const html=renderToStaticMarkup(createElement(BuyingPaymentFields,{eligibility:eligible,loading:false,value:initialBuyingPayment,onChange:vi.fn()}));
    expect(html).not.toContain('Record Check Number');
  });
});
