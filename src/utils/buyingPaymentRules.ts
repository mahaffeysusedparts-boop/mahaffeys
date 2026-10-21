import type { PaymentEligibility } from '../types/buyingPayments';
import type { Ticket } from '../types/scrap';

export const BUYING_PAYMENT_RULE_VERSION = 'category-thresholds-v1';

export function evaluateBuyingPaymentRules(ticket: Ticket): PaymentEligibility {
  const lines = ticket.scrapLines ?? [];
  const cents = Math.round(ticket.finalPayout * 100);
  const result: PaymentEligibility = {
    ticketId: ticket.id, revision: ticket.buying?.revision ?? 0,
    allowedMethods: [], selectableMethods: [], reasons: [],
    permitRequired: false, documentationRequired: false,
    paymentRuleVersion: BUYING_PAYMENT_RULE_VERSION,
  };
  if (!lines.length || !Number.isSafeInteger(cents) || cents <= 0) {
    result.reasons.push({ code: 'INVALID_AMOUNT', message: 'Add confirmed weighed lines with a positive payout before recording payment.' });
    return result;
  }
  // Mixed loads use the lower cash threshold for the whole purchase.
  const cashLimitCents = lines.some(line => line.metalCategory === 'Ferrous') ? 2500 : 10000;
  const method = cents > cashLimitCents ? 'Check' : 'Cash';
  result.allowedMethods = [method];
  result.selectableMethods = [method];
  return result;
}
