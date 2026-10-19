import type { BuyingPolicy, PaymentEligibility } from '../types/buyingPayments';
import type { MetalGrade, Ticket } from '../types/scrap';

export function evaluateBuyingPaymentRules(ticket: Ticket, policy: BuyingPolicy | null, metals: MetalGrade[], day: string, history: { cashCents: number | null; cashCount: number | null; unresolved: boolean; drawerBalance: number }, safeguardsEnabled = true): PaymentEligibility {
  const result: PaymentEligibility = { ticketId: ticket.id, revision: ticket.buying?.revision ?? 0, allowedMethods: [], selectableMethods: ['Check'], reasons: [], permitRequired: false, documentationRequired: false, policyVersion: safeguardsEnabled ? policy?.version : undefined };
  const block = (code: string, message: string, method?: 'Cash') => result.reasons.push({ code, message, method });
  if (!safeguardsEnabled) {
    const cents = Math.round(ticket.finalPayout * 100);
    if (!ticket.scrapLines?.length || !Number.isSafeInteger(cents) || cents <= 0) block('INVALID_AMOUNT', 'Purchase must have confirmed weighed lines and a positive validated payout.');
    if (history.unresolved) block('HISTORICAL_CASH_UNRESOLVED', 'Historical seller payment evidence is unresolved. Reconcile it before recording further cash payments.', 'Cash');
    if (!Number.isFinite(history.drawerBalance) || history.drawerBalance < ticket.finalPayout) block('DRAWER_BALANCE', 'Recorded drawer balance is insufficient or ambiguous for this cash payment.', 'Cash');
    result.selectableMethods = result.reasons.some(reason => reason.method === 'Cash') ? ['Check'] : ['Cash','Check'];
    if (!result.reasons.some(reason => !reason.method)) result.allowedMethods = result.selectableMethods;
    return result;
  }
  if (!policy?.version || day < policy.effectiveFrom || day > policy.effectiveThrough) {
    block('POLICY_SETUP_REQUIRED', 'Payment-rule safeguards are on, but a current reviewed ruleset is missing or expired. An administrator must verify the ruleset or explicitly disable enforcement in Payment safeguards. This is not a ticket approval request.');
    return result;
  }
  const lines = ticket.scrapLines ?? [];
  const grades = lines.map(line => policy.grades.find(grade => grade.gradeId === line.metalGradeId));
  if (!lines.length || grades.some(grade => !grade?.approved)) block('MATERIAL_NOT_APPROVED', 'Every material must have an approved purchase classification.');
  if (grades.some(grade => !grade?.paymentClass)) block('POLICY_CLASSIFICATION_REQUIRED', 'Policy setup must include reviewed South Carolina payment classes for these grades.');
  if (grades.some(grade => {
    const metal = metals.find(row => row.id === grade?.gradeId);
    return !grade?.definition || !metal || grade.definition.name !== metal.name || grade.definition.code !== metal.code || grade.definition.category !== metal.category;
  })) block('POLICY_GRADE_CHANGED', 'Grade identity changed or the policy definition is missing. Update the reviewed policy in setup.');
  if (grades.some(grade => grade?.paymentClass === 'REQUIRES_SPECIAL_DOCUMENTATION')) block('SPECIAL_DOCUMENTATION_UNSUPPORTED', 'This material requires a specialized legal documentation workflow and cannot be purchased through routine intake.');
  if (grades.some((grade, index) => grade?.paymentClass === 'FERROUS' && lines[index].metalCategory !== 'Ferrous')) block('POLICY_CLASS_CONFLICT', 'Non-ferrous material cannot use a ferrous payment classification.');
  result.permitRequired = grades.some(grade => grade?.requirePermit || (grade?.paymentClass && !['FERROUS','ALUMINUM_CANS'].includes(grade.paymentClass)));
  result.documentationRequired = grades.some(grade => grade?.paymentClass && !['FERROUS','ALUMINUM_CANS'].includes(grade.paymentClass));
  if (result.documentationRequired && !ticket.buying?.sellerIdentity) block('MATERIAL_SELLER_ID_REQUIRED', 'These nonferrous/restricted materials require retained actual seller ID and issuing jurisdiction under the applicable record requirements, independently of yard intake preferences.');
  const cents = Math.round(ticket.finalPayout * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) block('INVALID_AMOUNT', 'Purchase must have a positive validated payout.');
  const restricted = grades.some(grade => ['COPPER','BEER_KEG'].includes(grade?.paymentClass ?? ''));
  if ((restricted && history.cashCount === null) || (history.cashCents === null && grades.some(grade => grade?.sellerDayCashLimitCents != null))) block('SELLER_DAY_IDENTITY_UNKNOWN', 'Actual seller identity is unavailable, so same-seller/day cash activity cannot be established for these material/payment rules. Record identity or use Check where otherwise eligible.', 'Cash');
  if (restricted && cents >= 2500) block('SC_CHECK_REQUIRED', 'S.C. §16-17-680(D)(4): copper or beer-keg purchases at $25 or more require a check payable to the seller.', 'Cash');
  if (restricted && history.cashCount !== null && history.cashCount > 0) block('SC_SELLER_DAY_CASH_COUNT', 'S.C. §16-17-680(D)(4): only one cash transaction per seller/day for restricted materials. Earlier cash activity prevents another restricted-material cash purchase.', 'Cash');
  if (grades.some(grade => grade?.cashAtOrAboveCents != null && cents >= grade.cashAtOrAboveCents)) block('POLICY_CHECK_REQUIRED', 'Reviewed material policy requires Check at this amount.', 'Cash');
  if (history.cashCents !== null && grades.some(grade => grade?.sellerDayCashLimitCents != null && history.cashCents! + cents > grade.sellerDayCashLimitCents)) block('SELLER_DAY_CASH_LIMIT', 'Reviewed seller/day cash limit would be exceeded (America/New_York).', 'Cash');
  if (cents > (lines.some(line => line.metalCategory !== 'Ferrous') ? 2500 : 10000)) block('YARD_CASH_CAP', 'Yard preference: cash cap is $25 for non-ferrous/mixed loads and $100 for ferrous-only loads; these broad caps are not universal legal limits.', 'Cash');
  if (history.unresolved) block('HISTORICAL_CASH_UNRESOLVED', 'Historical seller payment evidence is unresolved. Cash is unavailable; historical review remains separate and never makes old purchases payable again.', 'Cash');
  if (!Number.isFinite(history.drawerBalance) || history.drawerBalance < ticket.finalPayout) block('DRAWER_BALANCE', 'Recorded drawer balance is insufficient or ambiguous for this cash payment.', 'Cash');
  result.selectableMethods = result.reasons.some(reason => reason.method === 'Cash') ? ['Check'] : ['Cash','Check'];
  if (!result.reasons.some(reason => !reason.method)) {
    result.allowedMethods = result.selectableMethods;
  }
  return result;
}
