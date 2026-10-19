export interface WheelFitmentRecord {
  id: string;
  make: string;
  model: string;
  startYear: number;
  endYear: number;
  chassis: string;
  boltPattern: string;
  lugCount: number;
  centerBore: number | null;
  rearCenterBore: number | null;
  factoryWheel: string;
  sourceUrl: string;
}

export interface WheelCatalogSnapshot {
  version: string;
  fetchedAt: string;
  sourceRecords: number;
  rejectedRecords: number;
  records: WheelFitmentRecord[];
}

export interface WheelFitmentResponse {
  version: string;
  fetchedAt: string;
  recordCount: number;
  rejectedRecords: number;
  stale: boolean;
  options: WheelFitmentRecord[];
  selected: WheelFitmentRecord | null;
  candidates: WheelFitmentRecord[];
}
