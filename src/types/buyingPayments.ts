export interface BuyingState {
  version: 1;
  revision: number;
  stage: 'DRAFT' | 'FINALIZED' | 'PAID' | 'VOIDED';
  activeCycleId?: string;
  cycleNumber?: number;
  finalizedAt?: string;
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
  }>;
}
