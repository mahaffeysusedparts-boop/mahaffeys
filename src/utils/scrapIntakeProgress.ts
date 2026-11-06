import type { ComplianceCaptures, Ticket } from '../types/scrap';
import type { IntakeRequirementFlags } from '../types/intakeRequirements';
import type { WeighingType } from '../types/scrapBuying';
import { INTAKE_PHOTO_FIELDS } from './intakeRequirements';

export type StepState = 'complete' | 'current' | 'needs attention' | 'pending' | 'not applicable' | 'unverified';
export interface EvidenceIssue { key: string; label: string; target: string; required: boolean; unknown: boolean }
export interface SellerEvidence {
  customerName?: string; customerPhone?: string; customerAddress?: string; customerIdNumber?: string;
  vehicleLicensePlate?: string; complianceCaptures?: ComplianceCaptures;
}
export const PHOTO_LABELS: Record<typeof INTAKE_PHOTO_FIELDS[number], string> = {
  personPhotoUrl: 'Seller photo', idPhotoUrl: 'ID photo', vehiclePhotoUrl: 'Vehicle photo', licensePlatePhotoUrl: 'Plate photo', loadPhotoUrl: 'Load photo',
};
export function assessScrapEvidence(evidence: SellerEvidence, requirements?: IntakeRequirementFlags, options: {
  verified: boolean; identity?: boolean; collection?: boolean; addressVerified?: boolean;
}) {
  const prefix = options.collection ? 'collection' : 'scale-seller';
  const issues: EvidenceIssue[] = [];
  const add = (key: string, label: string, target: string, required: boolean, unknown = false) => issues.push({ key, label, target, required, unknown });
  if (!options.verified || !requirements) add('verification', 'Saved evidence / requirements need verification', `${prefix === 'collection' ? 'collection-seller-name' : 'scale-seller-editor'}`, true, true);
  if (!evidence.customerName?.trim()) add('name', 'Seller name', options.collection ? 'collection-seller-name' : 'scale-seller-editor', true);
  if (!evidence.customerPhone?.trim()) add('phone', 'Phone', `${prefix}-phone`, !!requirements?.requirePhone);
  if (!evidence.customerAddress?.trim()) add('address', 'Address', options.collection ? 'seller-address' : 'scale-seller-address', !!requirements?.requireAddress, !options.collection && options.addressVerified !== true);
  if (options.identity !== true) add('identity', options.identity === false ? 'ID details' : 'ID details need verification', options.collection ? 'collection-id' : 'scale-seller-id', !!requirements?.requireSellerId, options.identity === undefined);
  if (!evidence.vehicleLicensePlate?.trim()) add('plate', 'Plate', `${prefix}-plate`, !!requirements?.requireVehiclePlate);
  for (const field of INTAKE_PHOTO_FIELDS) if (!evidence.complianceCaptures?.[field]) add(field, PHOTO_LABELS[field], `${prefix}-photos`, !!requirements?.requirePhotos);
  const attention = issues.filter(issue => issue.required || issue.unknown);
  const photos = attention.filter(issue => INTAKE_PHOTO_FIELDS.some(field => field === issue.key));
  const summary = attention.length ? `Needs ${[...attention.filter(issue => !photos.includes(issue)).map(issue => issue.label.toLowerCase()), ...(photos.length ? [`${photos.length} photos`] : [])].join(' · ')}` : 'Seller evidence complete';
  return { issues, attention, summary, verified: !!requirements && options.verified && attention.length === 0 };
}

export interface ScrapProgressInput {
  evidence: SellerEvidence;
  ticket?: Ticket;
  requirements?: IntakeRequirementFlags;
  verified: boolean;
  identity?: boolean;
  addressVerified?: boolean;
  collection?: boolean;
  mode?: WeighingType | null;
  inspection?: 'complete' | 'pending' | 'unverified';
  inspectionAcknowledged?: boolean;
  reviewed?: boolean;
  paymentVerified?: boolean;
  paymentIssues?: string[];
  unsaved?: boolean;
  saveFailed?: boolean;
}
export function scrapIntakeProgress(input: ScrapProgressInput) {
  const assessment = assessScrapEvidence(input.evidence, input.requirements, input);
  const ticket = input.ticket;
  const mode = ticket?.pendingPlatformCapture ? 'PLATFORM' : ticket?.scaleGrossInWeight != null ? 'VEHICLE_IN_OUT' : input.mode ?? ticket?.selectedWeighingType;
  const hasIn = ticket?.scaleGrossInWeight != null;
  const hasOut = ticket?.scaleTareOutWeight != null;
  const batch = !!ticket?.pendingPlatformCapture;
  const unresolved = hasIn || batch || !!ticket?.buying?.activeCycleId;
  const lines = !!ticket?.scrapLines?.length;
  const prefix = input.collection ? 'collection' : 'scale-seller';
  const stateFor = (photos: boolean): StepState => {
    const issues = assessment.attention.filter(issue => INTAKE_PHOTO_FIELDS.some(field => field === issue.key) === photos);
    if (issues.some(issue => issue.unknown) || !input.verified || !input.requirements) return 'unverified';
    if (issues.length) return 'needs attention';
    if (photos && input.requirements.requirePhotos === false && !INTAKE_PHOTO_FIELDS.every(field => input.evidence.complianceCaptures?.[field])) return 'not applicable';
    return 'complete';
  };
  const steps: { label: string; state: StepState; target: string }[] = [
    { label: 'Seller details', state: stateFor(false), target: input.collection ? 'collection-seller-name' : 'scale-seller-editor' },
    { label: 'Photos', state: stateFor(true), target: `${prefix}-photos` },
  ];
  const blockers = assessment.attention.map(issue => ({ label: `${issue.label}${issue.unknown ? ' (unverified)' : ''}`, target: issue.target }));
  let nextAction = 'Choose weighing type at the scale desk.';
  let nextTarget = 'scale-weighing';
  if (input.collection) {
    nextAction = input.evidence.customerName?.trim() ? 'Save this intake and hand off to the scale. Missing completion evidence may be corrected later.' : 'Enter the seller name to start this load.';
    nextTarget = input.evidence.customerName?.trim() ? 'collection-handoff' : 'collection-seller-name';
  } else if (mode === 'SPLIT_GROUPS') {
    nextAction = 'Split-group commercial completion is disabled. Choose a supported weighing type.';
    blockers.push({ label: 'Split-group commercial flow is disabled', target: 'scale-weighing' });
  } else if (mode === 'PLATFORM') {
    steps.push({ label: 'Weigh batches', state: batch ? 'complete' : lines && !unresolved ? 'complete' : 'current', target: 'scale-weighing' });
    steps.push({ label: 'Review materials', state: batch ? 'current' : unresolved ? 'unverified' : lines ? 'complete' : 'pending', target: 'scale-weighing' });
    nextAction = batch ? 'Review tare, material grade and deductions; confirm this batch before purchase review.' : unresolved ? 'Verify the unresolved active cycle before continuing.' : lines ? 'Review the purchase or weigh another batch, then check payment requirements.' : 'Capture a platform batch, then review its materials.';
  } else {
    steps.push({ label: 'Weigh-in', state: hasIn ? 'complete' : unresolved ? 'unverified' : lines ? 'not applicable' : 'pending', target: 'scale-weighing' });
    steps.push({ label: 'Inspection', state: hasIn ? input.inspection === 'complete' ? 'complete' : input.inspection === 'unverified' ? 'unverified' : 'pending' : 'not applicable', target: hasIn ? 'scale-inspection' : 'scale-weighing' });
    steps.push({ label: 'Weigh-out', state: hasOut ? 'complete' : hasIn ? 'current' : 'pending', target: 'scale-weighing' });
    if (mode === 'VEHICLE_IN_OUT' && !input.collection) {
      nextAction = hasOut ? 'Review material grade and bin deductions; confirm this load before purchase review.' : hasIn ? 'Capture OUT after unloading. Inspection pending does not prevent OUT capture.' : unresolved ? 'Verify the unresolved active cycle before continuing.' : lines ? 'Review the purchase or start another IN/OUT cycle, then check payment requirements.' : 'Capture the loaded truck IN weight.';
      if (!hasIn && !lines && !unresolved) steps[2].state = 'current';
      if (hasOut && input.inspection !== 'complete' && !input.inspectionAcknowledged) blockers.push({ label: 'Acknowledge the missing bin review at material confirmation', target: 'scale-inspection' });
    }
  }
  if (!input.collection) {
    if (unresolved) blockers.push({ label: 'Finish or explicitly cancel the active weighing cycle and confirm materials', target: 'scale-weighing' });
    if (!lines) blockers.push({ label: 'Confirm at least one weighed material line', target: 'scale-weighing' });
    if (input.requirements?.requireExplicitReview && !input.reviewed) blockers.push({ label: 'Review the confirmed purchase', target: 'scale-purchase-review' });
    if (!input.paymentVerified) blockers.push({ label: 'Payment eligibility needs verification', target: 'scale-payment' });
    for (const label of input.paymentIssues ?? []) blockers.push({ label, target: 'scale-payment' });
    if (!unresolved && lines) { nextTarget = input.requirements?.requireExplicitReview && !input.reviewed ? 'scale-purchase-review' : 'scale-payment'; }
  }
  if (input.unsaved) blockers.unshift({ label: 'Unsaved corrections / inputs — saved evidence has not changed', target: input.collection ? 'collection-handoff' : 'scale-seller-editor' });
  if (input.saveFailed) blockers.unshift({ label: 'Save not confirmed — retained inputs require review', target: input.collection ? 'collection-handoff' : 'scale-seller-editor' });
  steps.push({ label: 'Payment', state: input.collection ? 'pending' : !input.paymentVerified ? 'unverified' : blockers.length ? 'needs attention' : 'current', target: input.collection ? 'collection-handoff' : 'scale-payment' });
  return { steps, nextAction, nextTarget, blockers, assessment, source: input.collection ? 'Collection draft evidence' : 'Acknowledged saved evidence' };
}
