export const VEHICLE_SECTIONS = ['Domestic Trucks & SUVs', 'Ford & Lincoln', 'GM & Chevrolet', 'Chrysler & Dodge', 'Asian Imports', 'European'] as const;
export type PartAvailabilityStatus = 'NOT_CHECKED' | 'AVAILABLE' | 'REMOVED';
export interface VehiclePartCheck {
  name: string;
  status: PartAvailabilityStatus;
  checkedBy: string;
  checkedAt: string;
  notes?: string;
}
export interface VehicleHistoryEvent {
  id: string;
  kind: 'INTAKE' | 'LOCATION' | 'STATUS' | 'PHOTO' | 'PART' | 'PROCESSING' | 'DETAILS';
  at: string;
  actor: string;
  description: string;
  photoUrl?: string;
}
