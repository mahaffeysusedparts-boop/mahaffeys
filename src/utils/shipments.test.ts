import { describe, expect, it } from 'vitest';
import { displayRate, formatShipmentRate, ratePerLb, settlementLineTotal, settlementTotals, shipmentGrades, shipmentSnapshot } from './shipments';
import type { OutboundShipment, ShipmentSettlementGradeLine } from '@/types/scrap';

const legacy: OutboundShipment = {
  id: 'old-load', loadNumber: 'LD-1', millName: 'Test mill', materialCategory: 'HMS',
  grossWeightLbs: 45000, tareWeightLbs: 5000, netWeightLbs: 40000,
  expectedRatePerLb: 0.15, expectedRevenue: 6000, status: 'STAGED', createdAt: '2026-01-01T00:00:00Z',
};

describe('mill shipment pricing', () => {
  it('compares values rather than object key order and omitted optional fields', () => {
    expect(shipmentSnapshot({ ...legacy, driverName: undefined })).toBe(shipmentSnapshot(Object.fromEntries(Object.entries(legacy).reverse())));
    expect(shipmentSnapshot({ ...legacy, expectedRevenue: 1 })).not.toBe(shipmentSnapshot(legacy));
  });
  it('uses 2,000 pounds per US short ton', () => {
    expect(ratePerLb(300, 'TON')).toBe(0.15);
    expect(40000 * ratePerLb(300, 'TON')).toBe(6000);
    expect(displayRate(0.15, 'TON')).toBe(300);
    expect(displayRate(ratePerLb(300, 'TON'), 'LB')).toBe(0.15);
    expect(formatShipmentRate(0.15, 'TON')).toBe('$300.00/ton');
  });

  it('retains a grade view for pre-existing single-grade shipments', () => {
    expect(shipmentGrades(legacy)).toEqual([{ id: 'old-load', gradeName: 'HMS', netWeightLbs: 40000, soldPricePerLb: 0.15, priceUnit: 'LB' }]);
    expect(shipmentGrades(legacy)[0].netWeightLbs * shipmentGrades(legacy)[0].soldPricePerLb).toBe(legacy.expectedRevenue);
  });

  it('preserves mixed-grade pricing units', () => {
    const grades = [{ id: 'hms', gradeName: 'HMS', netWeightLbs: 30000, soldPricePerLb: ratePerLb(300, 'TON'), priceUnit: 'TON' as const }, { id: 'copper', gradeName: 'Copper', netWeightLbs: 10000, soldPricePerLb: 3.5, priceUnit: 'LB' as const }];
    expect(shipmentGrades({ ...legacy, gradeLines: grades })).toEqual(grades);
    expect(grades.reduce((sum, line) => sum + line.netWeightLbs * line.soldPricePerLb, 0)).toBe(39500);
  });
});

describe('grade-by-grade mill settlement', () => {
  it('sums actual weights, deductions and net grade payment', () => {
    const lines: ShipmentSettlementGradeLine[] = [
      { gradeLineId: 'hms', gradeName: 'HMS', actualNetWeightLbs: 29000, actualRatePerLb: ratePerLb(280, 'TON'), priceUnit: 'TON', deductions: 60 },
      { gradeLineId: 'copper', gradeName: 'Copper', actualNetWeightLbs: 9500, actualRatePerLb: 3.4, priceUnit: 'LB', deductions: 100 },
    ];
    expect(settlementLineTotal(lines[0])).toBe(4000);
    expect(settlementTotals(lines)).toEqual({ weight: 38500, deductions: 160, amount: 36200 });
  });

  it('rounds each net grade value to cents', () => {
    const line: ShipmentSettlementGradeLine = { gradeLineId: 'a', gradeName: 'Steel', actualNetWeightLbs: 3, actualRatePerLb: 0.1234, priceUnit: 'LB', deductions: 0.01 };
    expect(settlementLineTotal(line)).toBe(0.36);
    expect(settlementTotals([line, { ...line, gradeLineId: 'b' }]).amount).toBe(0.72);
  });

  it('supports a zero-weight grade rejected by the mill', () => {
    const line: ShipmentSettlementGradeLine = { gradeLineId: 'a', gradeName: 'Rejected grade', actualNetWeightLbs: 0, actualRatePerLb: 0.2, priceUnit: 'LB', deductions: 0 };
    expect(settlementLineTotal(line)).toBe(0);
  });
});
