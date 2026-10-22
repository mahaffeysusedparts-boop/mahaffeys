export type BinDeductionItem = { id: string; name: string; enabled: boolean } & (
  { mode: 'FIXED'; pounds: number } | { mode: 'RANGED'; minPounds: number; maxPounds: number }
);
export interface BinDeductionCatalog { revision: number; items: BinDeductionItem[] }
export interface BinSelection { itemId: string; quantity: number; poundsPerUnit?: number }
export interface BinDeductionEntry { itemId: string; name: string; quantity: number; poundsPerUnit: number }
export interface BinReview {
  cycleId: string; revision: number; catalogRevision: number; items: BinDeductionEntry[];
  totalLbs: number; employeeId: string; employeeName: string; submittedAt: string;
}
export interface BinReviewAcknowledgment { cycleId: string; reviewRevision: number; missingReviewAcknowledged?: true }
export interface MissingBinReview { cycleId: string; actorId: string; actorName: string; acknowledgedAt: string }
export interface BinCycle { cycleId: string; ticketId: string; number: number; sellerName: string; plate: string; inLbs: number; open: boolean; review: BinReview | null }
export const DEFAULT_BIN_CATALOG: BinDeductionCatalog = { revision: 1, items: [
  { id: 'dirt', name: 'Dirt, Mud, & Excessive Rust', enabled: true, mode: 'FIXED', pounds: 5 },
  { id: 'tire', name: 'Tire', enabled: true, mode: 'FIXED', pounds: 150 },
  { id: 'fluids', name: 'Fluids & Hazardous Liquids', enabled: true, mode: 'RANGED', minPounds: 5, maxPounds: 50 },
  { id: 'tanks', name: 'Tanks', enabled: true, mode: 'FIXED', pounds: 200 },
] };
