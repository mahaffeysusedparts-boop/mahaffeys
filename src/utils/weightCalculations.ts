import type { MetalGrade, ScrapTicketLine } from '@/types/scrap';

/**
 * Shared weight math used by both the vehicle IN/OUT workflow and the
 * small-load single-weight capture path. All persisted weights are in pounds.
 */

export interface WeightBreakdown {
  grossWeight: number;
  tareWeight: number;
  netWeight: number;
  deductionPercent: number;
  deductionLbs: number;
  billableWeight: number;
  ratePerLb: number;
  lineTotal: number;
}

/** Net = max(0, gross - tare). */
export function computeNetWeight(grossWeight: number, tareWeight: number): number {
  return Math.max(0, grossWeight - tareWeight);
}

/** Deduction pounds, rounded to 1 decimal place. */
export function computeDeductionLbs(netWeight: number, deductionPercent: number): number {
  return Math.round(netWeight * (deductionPercent / 100) * 10) / 10;
}

/** Billable weight after deduction, floored at 0 and rounded to 1 decimal. */
export function computeBillableWeight(netWeight: number, deductionLbs: number): number {
  return Math.max(0, Math.round((netWeight - deductionLbs) * 10) / 10);
}

/** Line total = billable * rate, rounded to cents. */
export function computeLineTotal(billableWeight: number, ratePerLb: number): number {
  return Math.round(billableWeight * ratePerLb * 100) / 100;
}

/** Full breakdown for a load given gross, tare, deduction, and grade. */
export function computeWeightBreakdown(
  grossWeight: number,
  tareWeight: number,
  deductionPercent: number,
  metal: MetalGrade,
): WeightBreakdown {
  const netWeight = computeNetWeight(grossWeight, tareWeight);
  const deductionLbs = computeDeductionLbs(netWeight, deductionPercent);
  const billableWeight = computeBillableWeight(netWeight, deductionLbs);
  const lineTotal = computeLineTotal(billableWeight, metal.ratePerLb);
  return {
    grossWeight,
    tareWeight,
    netWeight,
    deductionPercent,
    deductionLbs,
    billableWeight,
    ratePerLb: metal.ratePerLb,
    lineTotal,
  };
}

/** Build a ScrapTicketLine from a weight breakdown. */
export function buildScrapTicketLine(
  breakdown: WeightBreakdown,
  metal: MetalGrade,
  loadNumber: number,
  weighingMode?: ScrapTicketLine['weighingMode'],
): ScrapTicketLine {
  return {
    id: `line-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    loadNumber,
    capturedAt: new Date().toISOString(),
    metalGradeId: metal.id,
    metalName: metal.name,
    metalCategory: metal.category,
    grossWeight: breakdown.grossWeight,
    tareWeight: breakdown.tareWeight,
    netWeight: breakdown.netWeight,
    deductionPercent: breakdown.deductionPercent,
    deductionLbs: breakdown.deductionLbs,
    billableWeight: breakdown.billableWeight,
    ratePerLb: breakdown.ratePerLb,
    lineTotal: breakdown.lineTotal,
    weighingMode,
  };
}
