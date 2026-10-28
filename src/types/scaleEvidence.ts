export const SCALE_EVIDENCE_CATEGORIES = ['load', 'vehicle', 'plate'] as const;
export type ScaleEvidenceCategory = typeof SCALE_EVIDENCE_CATEGORIES[number];
export type ScaleEvidenceCameraMappings = Partial<Record<ScaleEvidenceCategory, string>>;

export const SCALE_EVIDENCE_LABELS: Record<ScaleEvidenceCategory, string> = {
  load: 'Load',
  vehicle: 'Truck / Vehicle',
  plate: 'License Plate',
};
