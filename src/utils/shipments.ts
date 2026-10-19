import type { OutboundShipment, ShipmentPriceUnit, ShipmentSettlementGradeLine } from '@/types/scrap';

export const shipmentMoney = (value: number) => value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
export const shipmentStatusLabel = (status: OutboundShipment['status']) => status.toLowerCase().replace(/_/g, ' ');
export const ratePerLb = (price: number, unit: ShipmentPriceUnit) => unit === 'TON' ? price / 2000 : price;
export const displayRate = (pricePerLb: number, unit: ShipmentPriceUnit = 'LB') => unit === 'TON' ? pricePerLb * 2000 : pricePerLb;
export const formatShipmentRate = (pricePerLb: number, unit: ShipmentPriceUnit = 'LB') => `${displayRate(pricePerLb, unit).toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 6 })}/${unit === 'TON' ? 'ton' : 'lb'}`;
export const shipmentGrades = (shipment: OutboundShipment) => shipment.gradeLines?.length ? shipment.gradeLines : [{
  id: shipment.id,
  gradeName: shipment.materialCategory,
  netWeightLbs: shipment.netWeightLbs,
  soldPricePerLb: shipment.expectedRatePerLb,
  priceUnit: 'LB' as const,
}];
export const settlementLineTotal = (line: ShipmentSettlementGradeLine) => Math.round((line.actualNetWeightLbs * line.actualRatePerLb - line.deductions) * 100) / 100;
export const settlementTotals = (lines: ShipmentSettlementGradeLine[]) => ({
  weight: lines.reduce((sum, line) => sum + line.actualNetWeightLbs, 0),
  deductions: Math.round(lines.reduce((sum, line) => sum + line.deductions, 0) * 100) / 100,
  amount: Math.round(lines.reduce((sum, line) => sum + settlementLineTotal(line), 0) * 100) / 100,
});
