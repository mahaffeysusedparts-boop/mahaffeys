import { describe, expect, it } from 'vitest';
import { evaluateBuyingPaymentRules, BUYING_PAYMENT_RULE_VERSION } from './buyingPaymentRules';
import { canRecordBuyingPayment } from './buyingAuthorization';
import type { Ticket } from '../types/scrap';

const ticket = (amount: number, categories = ['Ferrous']) => ({
  id: 'ticket', finalPayout: amount, buying: { version: 1, revision: 3, stage: 'FINALIZED' },
  scrapLines: categories.map(metalCategory => ({ metalGradeId: 'grade', metalCategory })),
} as Ticket);

describe('routine buying authority', () => {
  it.each(['scale_operator','yard_manager','admin'])('approved %s can pay', role => expect(canRecordBuyingPayment({role,status:'approved'})).toBe(true));
  it.each(['pending','disabled','rejected'])('a %s account cannot pay', status => expect(canRecordBuyingPayment({role:'scale_operator',status})).toBe(false));
  it('rejects employee and unauthenticated users', () => { expect(canRecordBuyingPayment({role:'yard_employee',status:'approved'})).toBe(false); expect(canRecordBuyingPayment(null)).toBe(false); });
});

describe('automatic category payment thresholds', () => {
  it.each([[24.99,'Cash'],[25,'Cash'],[25.01,'Check'],[100,'Check']])('ferrous $%s uses %s', (amount, method) => {
    const result = evaluateBuyingPaymentRules(ticket(Number(amount)));
    expect(result.allowedMethods).toEqual([method]);
    expect(result.selectableMethods).toEqual([method]);
  });
  it.each([[25,'Cash'],[99.99,'Cash'],[100,'Cash'],[100.01,'Check']])('non-ferrous $%s uses %s', (amount, method) => {
    expect(evaluateBuyingPaymentRules(ticket(Number(amount), ['Non-Ferrous'])).allowedMethods).toEqual([method]);
  });
  it('uses the lower threshold for mixed loads without splitting amounts', () => {
    expect(evaluateBuyingPaymentRules(ticket(25, ['Non-Ferrous','Ferrous'])).allowedMethods).toEqual(['Cash']);
    expect(evaluateBuyingPaymentRules(ticket(25.01, ['Non-Ferrous','Ferrous'])).allowedMethods).toEqual(['Check']);
  });
  it('needs no policy, seller identity, permit, documentation or cash history', () => {
    const result = evaluateBuyingPaymentRules(ticket(100, ['Non-Ferrous']));
    expect(result.reasons).toEqual([]);
    expect(result.permitRequired).toBe(false);
    expect(result.documentationRequired).toBe(false);
    expect(result.policyVersion).toBeUndefined();
    expect(result.paymentRuleVersion).toBe(BUYING_PAYMENT_RULE_VERSION);
  });
  it.each([0,-1,NaN,Infinity])('rejects invalid payout %s', amount => expect(evaluateBuyingPaymentRules(ticket(amount)).allowedMethods).toEqual([]));
  it('requires weighed lines', () => expect(evaluateBuyingPaymentRules(ticket(10, [])).allowedMethods).toEqual([]));
});
