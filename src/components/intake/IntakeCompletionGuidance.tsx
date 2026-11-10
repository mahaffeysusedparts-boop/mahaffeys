import { useAuth } from '@/context/AuthContext';
import { IntakeRequirementsSettings } from '@/components/settings/IntakeRequirementsSettings';
import { PaymentSafeguardsSettings } from '@/components/settings/PaymentSafeguardsSettings';
import type { PaymentEligibility } from '@/types/buyingPayments';
import type { IntakeRequirements } from '@/types/intakeRequirements';
import type { Ticket } from '@/types/scrap';
import type { BuyingPaymentInput } from './BuyingPaymentFields';
import { IntakeFieldGuidance, type IntakeIssue } from './IntakeFieldGuidance';
import { assessScrapEvidence } from '@/utils/scrapIntakeProgress';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function IntakeCompletionGuidance({ ticket, requirements, eligibility, eligibilityError, reviewed, paymentInput, sellerDirty = false, identityVerified, profileAddress, pauseReason, paymentAllowed = true, onRetryPayment, onRetryRequirements }: {
  ticket: Ticket;
  requirements?: IntakeRequirements;
  eligibility?: PaymentEligibility;
  eligibilityError?: string;
  reviewed: boolean;
  paymentInput?: BuyingPaymentInput;
  sellerDirty?: boolean;
  identityVerified?: boolean;
  profileAddress?: string;
  pauseReason?: string;
  paymentAllowed?: boolean;
  onRetryPayment: () => void;
  onRetryRequirements: () => void;
}) {
  const { isAdmin } = useAuth();
  const unfinished = !!ticket.pendingPlatformCapture || ticket.scaleGrossInWeight != null || !!ticket.buying?.activeCycleId;
  const evidence = assessScrapEvidence({ ...ticket, customerAddress: ticket.customerAddress || profileAddress }, requirements, { verified: !!requirements, identity: identityVerified, addressVerified: profileAddress !== undefined });
  const issues: IntakeIssue[] = [
    ...(sellerDirty ? [{ target: 'scale-seller-editor', message: 'Save the seller corrections before completing.' }] : []),
    ...evidence.attention.filter(issue => issue.required).map(issue => ({ target: issue.target, message: `${issue.label}${issue.unknown ? ' — verification needed.' : ' — correct and save before completion.'}` })),
    ...(unfinished ? [{ target: 'scale-weighing', message: 'Finish or explicitly cancel the unfinished weighing cycle.' }] : []),
    ...(!ticket.scrapLines?.length ? [{ target: 'scale-weighing', message: 'Add at least one confirmed weighed material line.' }] : []),
    ...(requirements?.requireExplicitReview && !reviewed ? [{ target: 'scale-purchase-review', message: 'Acknowledge your review of this purchase.' }] : []),
    ...(paymentInput?.method === 'Check' && !paymentInput.reference.trim() ? [{ target: 'scale-payment', message: 'Enter the actual issued check number.' }] : []),
    ...(eligibility?.permitRequired && !paymentInput?.permitReference.trim() ? [{ target: 'scale-payment', message: 'Enter the required permit reference.' }] : []),
    ...(eligibility?.documentationRequired && !paymentInput?.documentationReference.trim() ? [{ target: 'scale-payment', message: 'Enter the required supporting documentation reference.' }] : []),
    ...(eligibility?.reasons.map(reason => ({ target: reason.code === 'INTAKE_NOT_READY' ? 'scale-seller-editor' : 'scale-payment', message: reason.message })) ?? []),
  ];
  const paymentVerified = !!eligibility && !eligibilityError;
  const methodAllowed = !!paymentInput && !!eligibility?.allowedMethods.includes(paymentInput.method);
  return <section id="scale-completion-guidance" aria-label="Payment completion guidance" className="space-y-3 rounded-2xl border border-sky-700 bg-sky-950 p-4">
    <h3 className="flex items-center gap-2 font-bold text-sky-100"><ShieldCheck className="h-5 w-5 shrink-0"/>What is stopping completion?</h3>
    {pauseReason && <p role="status" className="rounded-xl border border-amber-700 bg-amber-950 p-3 text-sm text-amber-100">{pauseReason}</p>}
    {!paymentAllowed && <p role="status" className="text-sm text-amber-100">Your account cannot record payments. Ask an authorized payment operator or administrator to complete this purchase; do not use another person’s login.</p>}
    <IntakeFieldGuidance issues={issues} title="Finish these before payment" description="Weighing and payment are separate. These items must be resolved before “Complete & Record Payment” can finish the purchase."/>
    {!requirements && <div className="text-sm text-sky-100"><p>Saved yard requirements are not verified. Payment is paused until they load.</p><Button variant="outline" onClick={onRetryRequirements} className="mt-2 min-h-11 rounded-xl border-sky-700 bg-sky-950 text-sky-100">Retry yard requirements</Button></div>}
    {(!paymentVerified || (!methodAllowed && !eligibility?.reasons.length)) && <div className="text-sm text-sky-100"><p>{eligibilityError ? 'Payment checks failed to load. Retry them; entered check details are kept.' : 'The server has not approved a payment method yet. Wait for the checks, or retry them.'}</p><Button variant="outline" onClick={onRetryPayment} className="mt-2 min-h-11 rounded-xl border-sky-700 bg-sky-950 text-sky-100">Retry payment checks</Button></div>}
    {!issues.length && requirements && paymentVerified && methodAllowed && paymentAllowed && !pauseReason && <p role="status" className="text-sm text-emerald-100">Ready to record payment. The server rechecks the saved purchase when you complete.</p>}
    <div className="rounded-xl border border-amber-800 bg-amber-950 p-3 text-xs leading-relaxed text-amber-100">
      <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4"/>Complete with payment</p>
      <p className="mt-2">The material category and amount choose Cash or Check. Enter the issued check number when Check is selected.</p>
      {eligibilityError && <p className="mt-2">Payment method could not load: {eligibilityError}. Refresh it before completing.</p>}
      <p className="mt-2 font-semibold">Completion records actual cash handover or check issuance and opens a PAID receipt.</p>
    </div>
    <details className="rounded-xl border border-sky-700 bg-slate-900 p-3">
      <summary className="cursor-pointer font-semibold text-sky-100">Choose intake safeguards</summary>
      <p className="my-3 text-xs leading-relaxed text-slate-200">Select photos, phone, address, seller ID, plate and review requirements below. Valid confirmed weighing remains required.</p>
      <IntakeRequirementsSettings/>
    </details>
    <PaymentSafeguardsSettings/>
    {!isAdmin && <p className="text-xs text-sky-100">An administrator can change yard-wide intake requirements. Payment needs no buying-policy setup.</p>}
  </section>;
}
