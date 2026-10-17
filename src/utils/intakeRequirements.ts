import type { ComplianceCaptures } from '../types/scrap';
import type { IntakeRequirementFlags } from '../types/intakeRequirements';

export const INTAKE_PHOTO_FIELDS = [
  'personPhotoUrl', 'idPhotoUrl', 'vehiclePhotoUrl', 'licensePlatePhotoUrl', 'loadPhotoUrl',
] as const;

export function intakeRequirementReview(
  flags: IntakeRequirementFlags,
  evidence: { captures?: ComplianceCaptures; phone?: string; address?: string },
) {
  const missingPhotos = INTAKE_PHOTO_FIELDS.filter((key) => !evidence.captures?.[key]);
  const missing = [
    ...(missingPhotos.length ? [{ label: 'Intake photos', required: flags.requirePhotos }] : []),
    ...(!evidence.phone?.trim() ? [{ label: 'Seller phone', required: flags.requirePhone }] : []),
    ...(!evidence.address?.trim() ? [{ label: 'Seller address', required: flags.requireAddress }] : []),
  ];
  return {
    blockers: missing.filter((item) => item.required).map((item) => item.label),
    optionalMissing: missing.filter((item) => !item.required).map((item) => item.label),
  };
}
