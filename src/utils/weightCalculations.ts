import type { MetalGrade, ScrapTicketLine } from '@/types/scrap';
import { validatedBreakdown } from './weighingContract';

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

/** Invalid negative or non-finite net inputs are rejected. */
export function computeNetWeight(grossWeight: number, tareWeight: number): number {
  return validatedBreakdown(grossWeight, tareWeight, 0, 0).netWeight;
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
  return validatedBreakdown(grossWeight, tareWeight, deductionPercent, metal.ratePerLb);
}

/** Build a ScrapTicketLine from a weight breakdown. */
export function buildScrapTicketLine(
  breakdown: WeightBreakdown,
  metal: MetalGrade,
  loadNumber: number,
  weighingMode?: ScrapTicketLine['weighingMode'],
): ScrapTicketLine {
  return {
    id: `line-${crypto.randomUUID()}`,
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
