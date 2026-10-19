import { createPortal } from 'react-dom';
import type { OutboundShipment } from '@/types/scrap';
import { formatShipmentRate, settlementLineTotal, shipmentGrades, shipmentMoney as money, shipmentStatusLabel } from '@/utils/shipments';
import './shipment-print.css';

export function ShipmentPrintSheet({ shipment }: { shipment: OutboundShipment }) {
  return createPortal(<article id="mill-shipment-print" className="hidden space-y-6 bg-white text-slate-900">
    <div className="flex justify-between border-b-2 border-slate-900 pb-4"><div><p className="text-xs font-bold uppercase tracking-widest">Outbound mill shipment</p><h1 className="text-2xl font-black">{shipment.loadNumber}</h1><p>{shipment.millName}</p></div><div className="text-right text-sm"><p className="capitalize">{shipmentStatusLabel(shipment.status)}</p><p>Created {new Date(shipment.createdAt).toLocaleString()}</p></div></div>
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div><p><b>Driver:</b> {shipment.driverName || '—'}</p><p><b>Trailer / bin:</b> {shipment.trailerNumber || '—'}</p></div>
      <div><p><b>Gross:</b> {shipment.grossWeightLbs.toLocaleString()} lbs</p><p><b>Tare:</b> {shipment.tareWeightLbs.toLocaleString()} lbs</p><p><b>Net:</b> {shipment.netWeightLbs.toLocaleString()} lbs ({(shipment.netWeightLbs / 2000).toLocaleString()} US tons)</p></div>
      <p><b>Departed:</b> {shipment.departedAt ? new Date(shipment.departedAt).toLocaleString() : 'Not yet dispatched'}</p><p><b>Delivered:</b> {shipment.deliveredAt ? new Date(shipment.deliveredAt).toLocaleString() : 'Not yet delivered'}</p>
    </div>
    <section><h2 className="mb-3 font-bold">Shipped grades & agreed sale prices</h2><table className="w-full text-left text-sm"><thead><tr><th>Grade</th><th className="text-right">Net lbs</th><th className="text-right">Sold price</th><th className="text-right">Sale value</th></tr></thead><tbody>{shipmentGrades(shipment).map(line => <tr key={line.id}><td>{line.gradeName}</td><td className="text-right">{line.netWeightLbs.toLocaleString()}</td><td className="text-right">{formatShipmentRate(line.soldPricePerLb, line.priceUnit)}</td><td className="text-right">{money(line.netWeightLbs * line.soldPricePerLb)}</td></tr>)}</tbody></table><p className="mt-3 text-right font-bold">Expected total: {money(shipment.expectedRevenue)}</p></section>
    {shipment.settlement && <section className="space-y-3 border-t border-slate-400 pt-4"><h2 className="font-bold">Mill settlement · {shipment.settlement.scaleTicketNumber}</h2>
      {shipment.settlement.gradeLines?.length ? <table className="w-full text-left text-sm"><thead><tr><th>Grade</th><th className="text-right">Mill lbs</th><th className="text-right">Mill price</th><th className="text-right">Deduction</th><th className="text-right">Net value</th></tr></thead><tbody>{shipment.settlement.gradeLines.map(line => <tr key={line.gradeLineId}><td>{line.gradeName}</td><td className="text-right">{line.actualNetWeightLbs.toLocaleString()}</td><td className="text-right">{formatShipmentRate(line.actualRatePerLb, line.priceUnit)}</td><td className="text-right">{money(line.deductions)}</td><td className="text-right">{money(settlementLineTotal(line))}</td></tr>)}</tbody></table> : <p className="text-sm">Total-only settlement — no grade breakdown recorded.</p>}
      <div className="grid grid-cols-2 gap-2 text-sm"><p>Mill net weight: <b>{shipment.settlement.actualNetWeightLbs.toLocaleString()} lbs</b></p><p>Total deductions: <b>{money(shipment.settlement.deductions)}</b></p><p>Actual amount paid: <b>{money(shipment.settlement.amountPaid)}</b></p><p>Payment variance: <b>{money(shipment.settlement.amountPaid - shipment.expectedRevenue)}</b></p><p>Settled {new Date(shipment.settlement.settledAt).toLocaleString()}</p></div>
    </section>}
    <p className="text-xs">All weights are in pounds. US short ton = 2,000 lbs. Sale values are agreed prices; actual mill payment is recorded separately.</p>
  </article>, document.body);
}
