import { describe, expect, it } from 'vitest';
import { DEFAULT_PAYMENT_SAFEGUARDS, normalizePaymentSafeguards } from './paymentSafeguards';

describe('payment safeguard compatibility defaults',()=>{
  it('defaults existing yards to enabled',()=>{
    expect(normalizePaymentSafeguards()).toEqual(DEFAULT_PAYMENT_SAFEGUARDS);
    expect(normalizePaymentSafeguards({revision:3})).toMatchObject({enabled:true,revision:3});
  });
  it('preserves an explicit administrator disable and its evidence',()=>{
    const saved={enabled:false,revision:4,updatedAt:'2026-01-01T00:00:00.000Z',updatedBy:'Test admin',reason:'Synthetic override'};
    expect(normalizePaymentSafeguards(saved)).toEqual(saved);
  });
});
