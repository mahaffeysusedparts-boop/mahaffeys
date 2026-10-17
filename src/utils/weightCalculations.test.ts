import { describe, expect, it } from 'vitest';
import { buildScrapTicketLine, computeNetWeight, computeWeightBreakdown } from './weightCalculations';
import type { MetalGrade } from '../types/scrap';

const grade: MetalGrade = { id: 'steel', category: 'Ferrous', name: 'Steel', code: 'ST', description: '', ratePerLb: 0.125 };

describe('reviewed material lines', () => {
  it('keeps repeated same-grade batches as separate snapshots', () => {
    const breakdown = computeWeightBreakdown(100, 10, 5, grade);
    const first = buildScrapTicketLine(breakdown, grade, 1, 'SINGLE_WEIGHT');
    const second = buildScrapTicketLine(breakdown, grade, 2, 'SINGLE_WEIGHT');
    expect(first.id).not.toBe(second.id);
    expect(first.lineTotal + second.lineTotal).toBe(21.38);
    grade.ratePerLb = 0.2;
    expect(first.ratePerLb).toBe(0.125);
    grade.ratePerLb = 0.125;
  });
  it('keeps separately paired truck loads on the same ticket', () => {
    const first = buildScrapTicketLine(computeWeightBreakdown(13000, 7000, 0, grade), grade, 1, 'VEHICLE_IN_OUT');
    const second = buildScrapTicketLine(computeWeightBreakdown(12000, 7000, 0, grade), grade, 2, 'VEHICLE_IN_OUT');
    expect(first.netWeight).toBe(6000);
    expect(second.netWeight).toBe(5000);
    expect(first.lineTotal + second.lineTotal).toBe(1375);
  });
  it('does not infer an unsupported legacy weighing mode', () => {
    expect(buildScrapTicketLine(computeWeightBreakdown(100, 0, 0, grade), grade, 1).weighingMode).toBeUndefined();
  });
  it('rejects negative net inputs in the existing public helper', () => {
    expect(() => computeNetWeight(100, 101)).toThrow('Tare');
  });
});
