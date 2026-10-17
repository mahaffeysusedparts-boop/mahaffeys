export interface IntakeRequirementFlags {
  requirePhotos: boolean;
  requirePhone: boolean;
  requireAddress: boolean;
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
  revision: 0,
  updatedAt: null,
  updatedBy: null,
  reason: 'Default yard intake requirements',
};
