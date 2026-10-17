export interface BuyingState {
  version: 1;
  revision: number;
  stage: 'DRAFT' | 'FINALIZED' | 'PAID' | 'VOIDED';
  activeCycleId?: string;
  cycleNumber?: number;
  finalizedAt?: string;
  intakeRequirementReview?: {
    revision: number;
    requirePhotos: boolean;
    requirePhone: boolean;
    requireAddress: boolean;
    optionalMissing: string[];
  };
  sellerIdentity?: {idType:string;idState:string;idNumber:string};
  payment?: {
    id: string;
    method: 'Cash' | 'Check';
    amount: number;
    checkReference?: string;
    paidAt: string;
    paidBy: string;
    policyVersion: string;
    permitReference?: string;
  };
}

export interface BuyingPolicy {
  version?: string;
  sourceUrl: string;
  effectiveFrom: string;
  effectiveThrough: string;
  reviewer: string;
  reviewReference: string;
  grades: Array<{
    gradeId: string;
    classification: string;
    approved: boolean;
    requirePermit: boolean;
    cashAtOrAboveCents: number | null;
    sellerDayCashLimitCents: number | null;
    definition?: {name:string;code:string;category:string};
  }>;
}

export interface LegacyBuyingReview {
  ticketId:string;
  revision:number;
  disbursed:boolean;
  method?:'Cash'|'Check';
  paidAt?:string;
  amount:number;
  evidenceReference:string;
  sellerIdentity:{idType:string;idState:string;idNumber:string};
  reviewedBy:string;
  reviewedAt:string;
}
