export interface IntakeRequirementFlags {
  requirePhotos: boolean;
  requirePhone: boolean;
  requireAddress: boolean;
  requireSellerId: boolean;
  requireVehiclePlate: boolean;
  requireExplicitReview: boolean;
}

export interface IntakeRequirements extends IntakeRequirementFlags {
  revision: number;
  updatedAt: string | null;
  updatedBy: string | null;
  reason: string;
}

export const DEFAULT_INTAKE_REQUIREMENTS: IntakeRequirements = {
  requirePhotos: true,
  requirePhone: true,
  requireAddress: true,
  requireSellerId: true,
  requireVehiclePlate: true,
  requireExplicitReview: true,
  revision: 0,
  updatedAt: null,
  updatedBy: null,
  reason: 'Default yard intake requirements',
};

export function normalizeIntakeRequirements(value: Partial<IntakeRequirements> = {}): IntakeRequirements {
  return {
    ...DEFAULT_INTAKE_REQUIREMENTS,
    ...value,
    requirePhotos: value.requirePhotos !== false,
    requirePhone: value.requirePhone !== false,
    requireAddress: value.requireAddress !== false,
    requireSellerId: value.requireSellerId !== false,
    requireVehiclePlate: value.requireVehiclePlate !== false,
    requireExplicitReview: value.requireExplicitReview !== false,
  };
}
