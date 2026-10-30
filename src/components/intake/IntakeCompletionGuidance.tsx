import { useAuth } from '@/context/AuthContext';
import { IntakeRequirementsSettings } from '@/components/settings/IntakeRequirementsSettings';
import { PaymentSafeguardsSettings } from '@/components/settings/PaymentSafeguardsSettings';
import type { PaymentEligibility } from '@/types/buyingPayments';
import type { IntakeRequirements } from '@/types/intakeRequirements';
import type { Ticket } from '@/types/scrap';
import type { BuyingPaymentInput } from './BuyingPaymentFields';
import { IntakeFieldGuidance, type IntakeIssue } from './IntakeFieldGuidance';
import { INTAKE_PHOTO_FIELDS } from '@/utils/intakeRequirements';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

export function IntakeCompletionGuidance({ ticket, requirements, eligibility, eligibilityError, reviewed, paymentInput, sellerDirty = false }: {
  ticket: Ticket;
  requirements?: IntakeRequirements;
  eligibility?: PaymentEligibility;
  eligibilityError?: string;
  reviewed: boolean;
  paymentInput?: BuyingPaymentInput;
  sellerDirty?: boolean;
}) {
  const { isAdmin } = useAuth();
  const unfinished = !!ticket.pendingPlatformCapture || ticket.scaleGrossInWeight != null || !!ticket.buying?.activeCycleId;
  const issues: IntakeIssue[] = [
    ...(sellerDirty ? [{ target: 'scale-seller-editor', message: 'Save the seller corrections before completing.' }] : []),
    ...(!ticket.customerPhone?.trim() && requirements?.requirePhone ? [{ target: 'scale-seller-phone', message: 'Enter and save the seller phone.' }] : []),
    ...(!ticket.customerAddress?.trim() && requirements?.requireAddress ? [{ target: 'scale-seller-address', message: 'Confirm and save the seller address.' }] : []),
    ...(!ticket.customerIdNumber?.trim() && requirements?.requireSellerId ? [{ target: 'scale-seller-id', message: 'Confirm and save seller ID details.' }] : []),
    ...(!ticket.vehicleLicensePlate?.trim() && requirements?.requireVehiclePlate ? [{ target: 'scale-seller-plate', message: 'Enter and save today’s vehicle plate.' }] : []),
    ...(requirements?.requirePhotos && INTAKE_PHOTO_FIELDS.some(field => !ticket.complianceCaptures?.[field]) ? [{ target: 'scale-seller-photos', message: 'Capture and save the missing intake photos.' }] : []),
    ...(unfinished ? [{ target: 'scale-weighing', message: 'Finish or explicitly cancel the unfinished weighing cycle.' }] : []),
    ...(!ticket.scrapLines?.length ? [{ target: 'scale-weighing', message: 'Add at least one confirmed weighed material line.' }] : []),
    ...(requirements?.requireExplicitReview && !reviewed ? [{ target: 'scale-purchase-review', message: 'Acknowledge your review of this purchase.' }] : []),
    ...(paymentInput?.method === 'Check' && !paymentInput.reference.trim() ? [{ target: 'scale-payment', message: 'Enter the actual issued check number.' }] : []),
    ...(eligibility?.permitRequired && !paymentInput?.permitReference.trim() ? [{ target: 'scale-payment', message: 'Enter the required permit reference.' }] : []),
    ...(eligibility?.documentationRequired && !paymentInput?.documentationReference.trim() ? [{ target: 'scale-payment', message: 'Enter the required supporting documentation reference.' }] : []),
    ...(eligibility?.reasons.map(reason => ({ target: reason.code === 'INTAKE_NOT_READY' ? 'scale-seller-editor' : 'scale-payment', message: reason.message })) ?? []),
  ];
  return <section className="space-y-3 rounded-2xl border border-sky-700 bg-sky-950 p-4">
    <h3 className="flex items-center gap-2 font-bold text-sky-100"><ShieldCheck className="h-5 w-5"/>What is stopping completion?</h3>
    <IntakeFieldGuidance issues={issues}/>
    {!requirements && <p className="text-xs text-sky-100">Load the saved intake requirements before completing.</p>}
    {!issues.length && requirements && <p className="text-xs text-sky-100">Local checks are ready. The server rechecks saved requirements when you complete.</p>}
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
