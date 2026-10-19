import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { storageService } from '@/services/storageService';
import type { OutboundShipment } from '@/types/scrap';

const money = (value: number) => value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });

export function ShipmentSettlement({ shipment, onClose, onSaved }: {
  shipment: OutboundShipment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [actual, setActual] = useState(shipment.settlement ? String(shipment.settlement.actualNetWeightLbs) : '');
  const [paid, setPaid] = useState(shipment.settlement ? String(shipment.settlement.amountPaid) : '');
  const gradeLines = shipment.gradeLines?.length ? shipment.gradeLines : [{
    id: shipment.id,
    gradeName: shipment.materialCategory,
    netWeightLbs: shipment.netWeightLbs,
    soldPricePerLb: shipment.expectedRatePerLb,
  }];

  const save = () => {
    const actualWeight = actual === '' ? shipment.netWeightLbs : Number(actual);
    const amount = Number(paid);
    if (!Number.isFinite(actualWeight) || actualWeight <= 0 || !Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a positive mill weight and amount paid');
      return;
    }
    const variance = Math.abs(amount - shipment.expectedRevenue) / Math.max(shipment.expectedRevenue, 1) * 100;
    storageService.saveShipment({
      ...shipment,
      status: variance > 2 ? 'DISCREPANCY' : 'SETTLED',
      deliveredAt: shipment.deliveredAt || new Date().toISOString(),
      settlement: {
        scaleTicketNumber: shipment.settlement?.scaleTicketNumber || `MILL-${Date.now().toString().slice(-6)}`,
        actualNetWeightLbs: actualWeight,
        actualRatePerLb: amount / actualWeight,
        deductions: 0,
        amountPaid: amount,
        settledAt: new Date().toISOString(),
      },
    });
    toast.success(variance > 2 ? 'Settlement saved with discrepancy flag' : 'Settlement reconciled');
    onSaved();
    onClose();
  };

  return <Dialog open onOpenChange={open => !open && onClose()}>
    <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-2xl border-slate-700 bg-slate-900 text-white">
      <DialogHeader><DialogTitle>{shipment.loadNumber} · settlement</DialogTitle></DialogHeader>
      <p className="text-sm text-slate-400">{shipment.millName} · Expected {money(shipment.expectedRevenue)} from {shipment.netWeightLbs.toLocaleString()} lbs.</p>
      <section className="space-y-2 rounded-2xl border border-slate-700 p-4">
        <h3 className="mb-3 font-bold">Grades & sold prices</h3>
        {gradeLines.map(line => <div key={line.id} className="flex flex-col justify-between gap-2 rounded-xl bg-slate-950 p-3 sm:flex-row sm:items-center">
          <div><p className="font-semibold">{line.gradeName}</p><p className="text-sm text-slate-300">{line.netWeightLbs.toLocaleString()} lbs × {line.soldPricePerLb.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 6 })}/lb</p></div>
          <b className="font-mono text-emerald-300">{money(line.netWeightLbs * line.soldPricePerLb)}</b>
        </div>)}
        <div className="flex justify-between pt-2 text-sm"><span>Total sale</span><b className="font-mono text-emerald-300">{money(shipment.expectedRevenue)}</b></div>
      </section>
      <Label htmlFor="settlement-weight">Mill net weight (lbs)</Label>
      <Input id="settlement-weight" type="number" min="0" step="any" placeholder={String(shipment.netWeightLbs)} value={actual} onChange={event => setActual(event.target.value)} className="rounded-xl border-slate-700 bg-slate-950" />
      <Label htmlFor="settlement-paid">Actual amount paid</Label>
      <Input id="settlement-paid" type="number" min="0" step="0.01" placeholder="0.00" value={paid} onChange={event => setPaid(event.target.value)} className="rounded-xl border-slate-700 bg-slate-950" />
      <Button onClick={save} className="h-11 rounded-xl bg-emerald-600 font-bold hover:bg-emerald-500"><CheckCircle2 className="mr-2 h-4 w-4" />Reconcile settlement</Button>
    </DialogContent>
  </Dialog>;
}
