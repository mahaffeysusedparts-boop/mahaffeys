import { useAuth } from '@/context/AuthContext';
import { IntakeRequirementsSettings } from '@/components/settings/IntakeRequirementsSettings';
import { PaymentSafeguardsSettings } from '@/components/settings/PaymentSafeguardsSettings';
import type { PaymentEligibility } from '@/types/buyingPayments';
import type { IntakeRequirements } from '@/types/intakeRequirements';
import type { Ticket } from '@/types/scrap';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

export function IntakeCompletionGuidance({ ticket, requirements, eligibility, eligibilityError, reviewed }: {
  ticket: Ticket;
  requirements?: IntakeRequirements;
  eligibility?: PaymentEligibility;
  eligibilityError?: string;
  reviewed: boolean;
}) {
  const { isAdmin } = useAuth();
  const intakeReasons = eligibility?.reasons.filter(reason => reason.code === 'INTAKE_NOT_READY') ?? [];
  const paymentReasons = eligibility?.reasons.filter(reason => reason.code !== 'INTAKE_NOT_READY') ?? [];
  const unfinished = !!ticket.pendingPlatformCapture || ticket.scaleGrossInWeight != null || !!ticket.buying?.activeCycleId;
  return <section className="space-y-3 rounded-2xl border border-sky-700 bg-sky-950 p-4">
    <h3 className="flex items-center gap-2 font-bold text-sky-100"><ShieldCheck className="h-5 w-5"/>What is stopping completion?</h3>
    <div className="rounded-xl border border-sky-800 bg-slate-950 p-3 text-sm text-slate-100">
      <p className="font-semibold text-sky-200">Intake completion checks</p>
      <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed">
        {unfinished && <li>Finish or cancel the unfinished weighing cycle.</li>}
        {!ticket.scrapLines?.length && <li>Add at least one confirmed weighed material line.</li>}
        {!requirements && <li>Load the saved intake requirements before completing.</li>}
        {requirements?.requireExplicitReview && !reviewed && <li>Tick the purchase-review acknowledgement below, or make review optional in intake safeguards.</li>}
        {intakeReasons.map(reason => <li key={reason.code}>{reason.message}</li>)}
        {!unfinished && !!ticket.scrapLines?.length && !!requirements && (!requirements.requireExplicitReview || reviewed) && !intakeReasons.length && <li>Local intake checks are ready. The server rechecks saved requirements when you complete.</li>}
      </ul>
    </div>
    <div className="rounded-xl border border-amber-800 bg-amber-950 p-3 text-xs leading-relaxed text-amber-100">
      <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4"/>Payment checks — do not prevent “Complete Intake · Pay Later”</p>
      {paymentReasons.length ? <ul className="mt-2 list-inside list-disc space-y-1">{paymentReasons.map(reason => <li key={reason.code}>{reason.method ? `${reason.method}: ` : ''}{reason.message}</li>)}</ul> : <p className="mt-2">Payment separately checks policy, payment method, check number, required documentation and drawer funds.</p>}
      {eligibilityError && <p className="mt-2">Payment eligibility could not load: {eligibilityError}. You can still complete an otherwise-ready intake as unpaid.</p>}
      <p className="mt-2 font-semibold">Pay Later saves a completed, unpaid intake and opens its voucher. It does not record cash handover or check issuance.</p>
    </div>
    <details className="rounded-xl border border-sky-700 bg-slate-900 p-3">
      <summary className="cursor-pointer font-semibold text-sky-100">Choose intake safeguards</summary>
      <p className="my-3 text-xs leading-relaxed text-slate-200">Select photos, phone, address, seller ID, plate and review requirements below. Valid confirmed weighing remains required. The administrator’s master payment-rule switch is separate and shown below.</p>
      <IntakeRequirementsSettings/>
    </details>
    <PaymentSafeguardsSettings/>
    {!isAdmin && <p className="text-xs text-sky-100">An administrator can change yard-wide safeguard settings. Authorized operators can complete intakes without waiting for payment-rule setup.</p>}
  </section>;
}
