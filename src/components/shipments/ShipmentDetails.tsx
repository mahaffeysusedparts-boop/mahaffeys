import { CheckCircle2, Factory, Pencil, Printer, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { storageService } from '@/services/storageService';
import type { OutboundShipment } from '@/types/scrap';
import { formatShipmentRate, settlementLineTotal, shipmentGrades, shipmentMoney as money, shipmentStatusLabel } from '@/utils/shipments';
import { ShipmentPrintSheet } from './ShipmentPrintSheet';

export function ShipmentDetails({ shipment, onClose, onSaved, onEdit, onSettle }: {
  shipment: OutboundShipment;
  onClose: () => void;
  onSaved: () => void;
  onEdit: () => void;
  onSettle: () => void;
}) {
  const settled = !!shipment.settlement || ['SETTLED', 'DISCREPANCY'].includes(shipment.status);
  const stages = [
    { label: 'Staged', date: shipment.createdAt, Icon: Factory },
    { label: 'In transit', date: shipment.departedAt, Icon: Truck },
    { label: 'Delivered', date: shipment.deliveredAt, Icon: CheckCircle2 },
    { label: 'Settled', date: shipment.settlement?.settledAt, Icon: CheckCircle2 },
  ];
  const advance = () => {
    const latest = storageService.getShipments().find(load => load.id === shipment.id);
    if (!latest || latest.status !== shipment.status || latest.settlement) {
      toast.error('This load has changed. Close and reopen it.');
      return;
    }
    if (latest.status === 'STAGED') storageService.saveShipment({ ...latest, status: 'IN_TRANSIT', departedAt: new Date().toISOString() });
    else if (latest.status === 'IN_TRANSIT') storageService.saveShipment({ ...latest, status: 'DELIVERED', deliveredAt: new Date().toISOString() });
    else return;
    toast.success(latest.status === 'STAGED' ? 'Load dispatched — now in transit' : 'Load marked delivered');
    onSaved();
  };

  return <>
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto rounded-3xl border-slate-700 bg-slate-900 text-slate-100">
        <DialogHeader><p className="font-mono text-xs tracking-widest text-emerald-400">MILL SHIPMENT</p><DialogTitle className="text-2xl font-black">{shipment.loadNumber}</DialogTitle><p className="text-slate-300">{shipment.millName}</p></DialogHeader>
        <div className="flex flex-wrap items-center gap-2"><Badge className={`rounded-lg px-3 py-1 capitalize ${shipment.status === 'DISCREPANCY' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{shipmentStatusLabel(shipment.status)}</Badge><Button variant="outline" onClick={() => window.print()} className="rounded-xl border-slate-700 bg-slate-950 hover:bg-slate-800"><Printer className="mr-2 h-4 w-4" />Print load details</Button>{!settled && <Button variant="outline" onClick={onEdit} className="rounded-xl border-slate-700 bg-slate-950 hover:bg-slate-800"><Pencil className="mr-2 h-4 w-4" />Edit load</Button>}</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{stages.map(({ label, date, Icon }) => <div key={label} className={`rounded-2xl border p-3 ${date ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-800 bg-slate-950'}`}><Icon className={`mb-2 h-4 w-4 ${date ? 'text-emerald-400' : 'text-slate-500'}`} /><p className="text-sm font-bold">{label}</p><p className="mt-1 text-xs text-slate-300">{date ? new Date(date).toLocaleString() : 'Pending'}</p></div>)}</div>
        <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-slate-950 p-4"><p className="text-xs text-slate-400">Driver · trailer / bin</p><p className="mt-1 font-semibold">{shipment.driverName || 'No driver'} · {shipment.trailerNumber || 'No trailer'}</p></div><div className="rounded-2xl bg-slate-950 p-4"><p className="text-xs text-slate-400">Yard net weight</p><p className="mt-1 font-mono text-lg font-bold">{shipment.netWeightLbs.toLocaleString()} lbs</p><p className="text-xs text-slate-400">Gross {shipment.grossWeightLbs.toLocaleString()} − tare {shipment.tareWeightLbs.toLocaleString()}</p></div><div className="rounded-2xl bg-emerald-500/10 p-4"><p className="text-xs text-emerald-200">Agreed sale value</p><p className="mt-1 font-mono text-lg font-bold text-emerald-300">{money(shipment.expectedRevenue)}</p><p className="text-xs text-emerald-200">{(shipment.netWeightLbs / 2000).toLocaleString()} US short tons</p></div></div>
        <section className="space-y-3"><h3 className="font-bold">Shipped grades & sold prices</h3>{shipmentGrades(shipment).map(line => <div key={line.id} className="flex flex-col justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950 p-4 sm:flex-row"><div><p className="font-semibold">{line.gradeName}</p><p className="text-sm text-slate-300">{line.netWeightLbs.toLocaleString()} lbs · {formatShipmentRate(line.soldPricePerLb, line.priceUnit)}</p></div><b className="font-mono text-emerald-300">{money(line.netWeightLbs * line.soldPricePerLb)}</b></div>)}</section>
        {shipment.settlement && <section className="space-y-3 rounded-2xl border border-slate-700 p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">Mill settlement</h3><span className="font-mono text-xs text-slate-300">{shipment.settlement.scaleTicketNumber}</span></div>{shipment.settlement.gradeLines?.length ? shipment.settlement.gradeLines.map(line => <div key={line.gradeLineId} className="flex flex-col justify-between gap-2 rounded-xl bg-slate-950 p-3 sm:flex-row"><div><p className="font-semibold">{line.gradeName}</p><p className="text-sm text-slate-300">{line.actualNetWeightLbs.toLocaleString()} lbs · {formatShipmentRate(line.actualRatePerLb, line.priceUnit)} · deduction {money(line.deductions)}</p></div><b className="font-mono text-emerald-300">{money(settlementLineTotal(line))}</b></div>) : <p className="text-sm text-slate-400">Total-only settlement; no per-grade mill readings recorded.</p>}<div className="grid gap-3 text-sm sm:grid-cols-3"><div><p className="text-slate-400">Actual payment</p><b className="font-mono text-lg text-emerald-300">{money(shipment.settlement.amountPaid)}</b></div><div><p className="text-slate-400">Mill net / deductions</p><b>{shipment.settlement.actualNetWeightLbs.toLocaleString()} lbs / {money(shipment.settlement.deductions)}</b></div><div><p className="text-slate-400">Payment variance</p><b className="font-mono">{money(shipment.settlement.amountPaid - shipment.expectedRevenue)}</b></div></div></section>}
        <div className="flex flex-wrap gap-3 border-t border-slate-800 pt-4">
          {['STAGED', 'IN_TRANSIT'].includes(shipment.status) && !settled && <Button onClick={advance} className="h-11 rounded-xl bg-emerald-600 font-bold hover:bg-emerald-500"><Truck className="mr-2 h-4 w-4" />{shipment.status === 'STAGED' ? 'Dispatch load' : 'Mark delivered'}</Button>}
          {(shipment.status === 'DELIVERED' || settled) && <Button onClick={onSettle} className="h-11 rounded-xl bg-emerald-600 font-bold hover:bg-emerald-500"><CheckCircle2 className="mr-2 h-4 w-4" />{settled ? 'Update settlement' : 'Reconcile mill settlement'}</Button>}
          {settled && <p className="self-center text-xs text-slate-400">Shipped grades are locked after settlement. Mill settlement can still be corrected.</p>}
        </div>
        <p className="text-xs text-slate-400">US short ton = 2,000 lbs. All scale weights are stored in pounds.</p>
      </DialogContent>
    </Dialog>
    <ShipmentPrintSheet shipment={shipment} />
  </>;
}
