import { useState } from 'react';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { shipmentService } from '@/services/shipmentService';
import type { OutboundShipment, ShipmentPriceUnit, ShipmentSettlementGradeLine } from '@/types/scrap';
import { displayRate, ratePerLb, settlementTotals, shipmentGrades, shipmentMoney as money, shipmentSnapshot } from '@/utils/shipments';

const inputStyle = 'mt-1 rounded-xl border-slate-700 bg-slate-950';

export function ShipmentSettlement({ shipment, onClose, onSaved, onBack }: {
  shipment: OutboundShipment;
  onClose: () => void;
  onSaved: () => void;
  onBack: () => void;
}) {
  const [expectedSnapshot] = useState(() => shipmentSnapshot(shipment));
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'GRADES' | 'TOTAL'>(shipment.settlement && !shipment.settlement.gradeLines?.length ? 'TOTAL' : 'GRADES');
  const [actual, setActual] = useState(String(shipment.settlement?.actualNetWeightLbs ?? shipment.netWeightLbs));
  const [paid, setPaid] = useState(shipment.settlement ? String(shipment.settlement.amountPaid) : '');
  const [ticket, setTicket] = useState(shipment.settlement?.scaleTicketNumber ?? '');
  const [deductions, setDeductions] = useState(String(shipment.settlement?.deductions ?? 0));
  const [lines, setLines] = useState(() => shipmentGrades(shipment).map(line => {
    const settled = shipment.settlement?.gradeLines?.find(item => item.gradeLineId === line.id);
    const unit = settled?.priceUnit ?? line.priceUnit ?? 'LB';
    return { id: line.id, gradeName: line.gradeName, weight: String(settled?.actualNetWeightLbs ?? line.netWeightLbs), price: String(displayRate(settled?.actualRatePerLb ?? line.soldPricePerLb, unit)), unit, deduction: String(settled?.deductions ?? 0) };
  }));
  const gradeLines: ShipmentSettlementGradeLine[] = lines.map(line => ({ gradeLineId: line.id, gradeName: line.gradeName, actualNetWeightLbs: Number(line.weight), actualRatePerLb: ratePerLb(Number(line.price), line.unit), priceUnit: line.unit, deductions: Number(line.deduction) }));
  const totals = settlementTotals(gradeLines);
  const expectedPayment = mode === 'GRADES' ? totals.amount : shipment.expectedRevenue - Number(deductions);
  const payment = paid === '' ? expectedPayment : Number(paid);
  const variance = payment - shipment.expectedRevenue;
  const updateLine = (id: string, field: 'weight' | 'price' | 'deduction', value: string) => setLines(current => current.map(line => line.id === id ? { ...line, [field]: value } : line));
  const changeUnit = (id: string, unit: ShipmentPriceUnit) => setLines(current => current.map(line => line.id === id ? { ...line, unit, price: line.price === '' ? '' : String(displayRate(ratePerLb(Number(line.price), line.unit), unit)) } : line));

  const save = async () => {
    if (saving) return;
    if (mode === 'GRADES' && lines.some(line => line.weight === '' || !Number.isFinite(Number(line.weight)) || Number(line.weight) < 0 || line.price === '' || !Number.isFinite(Number(line.price)) || Number(line.price) < 0 || !Number.isFinite(Number(line.deduction)) || Number(line.deduction) < 0 || Number(line.deduction) > Number(line.weight) * ratePerLb(Number(line.price), line.unit))) {
      toast.error('Enter valid grade weights, prices, and deductions no greater than the grade value');
      return;
    }
    const actualWeight = mode === 'GRADES' ? totals.weight : Number(actual);
    const totalDeductions = mode === 'GRADES' ? totals.deductions : Number(deductions);
    const amount = Math.round(payment * 100) / 100;
    if (!Number.isFinite(actualWeight) || actualWeight <= 0 || !Number.isFinite(amount) || amount < 0 || !Number.isFinite(totalDeductions) || totalDeductions < 0) {
      toast.error('Enter a positive mill weight and valid payment/deductions');
      return;
    }
    setSaving(true);
    try {
      const saved = await shipmentService.settle(shipment, {
        scaleTicketNumber: ticket.trim() || `MILL-${Date.now().toString().slice(-6)}`,
        actualNetWeightLbs: actualWeight,
        deductions: totalDeductions,
        amountPaid: amount,
        ...(mode === 'GRADES' ? { gradeLines } : {}),
      }, expectedSnapshot);
      toast.success(saved.status === 'DISCREPANCY' ? 'Settlement saved with discrepancy flag' : 'Settlement reconciled');
      onSaved();
      onBack();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Settlement was not confirmed. Your entered values have been kept.');
    } finally {
      setSaving(false);
    }
  };

  return <Dialog open onOpenChange={open => !open && onClose()}>
    <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto rounded-2xl border-slate-700 bg-slate-900 text-white">
      <DialogHeader><DialogTitle>{shipment.loadNumber} · mill settlement</DialogTitle><p className="text-sm text-slate-400">{shipment.millName} · Expected {money(shipment.expectedRevenue)}. US short ton = 2,000 lbs.</p></DialogHeader>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onBack} className="rounded-xl border-slate-700 bg-slate-950"><ArrowLeft className="mr-2 h-4 w-4" />Load details</Button>
        <Select value={mode} onValueChange={value => setMode(value as typeof mode)}><SelectTrigger aria-label="Settlement method" className="w-52 rounded-xl border-slate-700 bg-slate-950"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="GRADES">Grade-by-grade</SelectItem><SelectItem value="TOTAL">Total payment only</SelectItem></SelectContent></Select>
      </div>
      <div><Label htmlFor="mill-ticket">Mill scale ticket number</Label><Input id="mill-ticket" value={ticket} onChange={event => setTicket(event.target.value)} placeholder="Enter mill ticket reference" className={inputStyle} /></div>
      {mode === 'GRADES' ? <section className="space-y-3">
        {lines.map(line => <div key={line.id} className="rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{line.gradeName}</h3><Select value={line.unit} onValueChange={value => changeUnit(line.id, value as ShipmentPriceUnit)}><SelectTrigger aria-label={`Settlement price unit for ${line.gradeName}`} className="h-8 w-40 rounded-lg border-slate-700 bg-slate-900"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LB">Price per pound</SelectItem><SelectItem value="TON">Price per US ton</SelectItem></SelectContent></Select></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><Label htmlFor={`actual-${line.id}`}>Mill weight (lbs)</Label><Input id={`actual-${line.id}`} type="number" min="0" step="any" value={line.weight} onChange={event => updateLine(line.id, 'weight', event.target.value)} className={inputStyle} /></div>
            <div><Label htmlFor={`rate-${line.id}`}>Mill price ($/{line.unit === 'TON' ? 'ton' : 'lb'})</Label><Input id={`rate-${line.id}`} type="number" min="0" step="any" value={line.price} onChange={event => updateLine(line.id, 'price', event.target.value)} className={inputStyle} /></div>
            <div><Label htmlFor={`deduction-${line.id}`}>Deduction ($)</Label><Input id={`deduction-${line.id}`} type="number" min="0" step="0.01" value={line.deduction} onChange={event => updateLine(line.id, 'deduction', event.target.value)} className={inputStyle} /></div>
          </div>
          <p className="mt-3 text-right font-mono text-sm text-emerald-300">Net grade value {money(Math.round((Number(line.weight) * ratePerLb(Number(line.price), line.unit) - Number(line.deduction)) * 100) / 100)}</p>
        </div>)}
      </section> : <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="mill-weight">Mill net weight (lbs)</Label><Input id="mill-weight" type="number" min="0" step="any" value={actual} onChange={event => setActual(event.target.value)} className={inputStyle} /></div>
        <div><Label htmlFor="mill-deductions">Total deductions ($)</Label><Input id="mill-deductions" type="number" min="0" step="0.01" value={deductions} onChange={event => setDeductions(event.target.value)} className={inputStyle} /></div>
      </div>}
      <div className="space-y-3 rounded-2xl bg-emerald-500/10 p-4">
        <div className="flex flex-wrap justify-between gap-2 text-sm"><span>Calculated net payment</span><b className="font-mono text-emerald-300">{money(expectedPayment)}</b></div>
        <div><Label htmlFor="settlement-paid">Actual amount paid ($)</Label><Input id="settlement-paid" type="number" min="0" step="0.01" placeholder={expectedPayment.toFixed(2)} value={paid} onChange={event => setPaid(event.target.value)} className={inputStyle} /><p className="mt-1 text-xs text-slate-300">Leave blank to use the calculated payment, or enter the mill’s actual payment.</p></div>
        <div className="flex flex-wrap justify-between gap-2 text-sm"><span>{mode === 'GRADES' ? totals.weight.toLocaleString() : Number(actual).toLocaleString()} lbs mill net</span><b className={variance < 0 ? 'text-amber-300' : 'text-emerald-300'}>{variance >= 0 ? '+' : ''}{money(variance)} vs. expected</b></div>
      </div>
      <Button onClick={save} disabled={saving || shipment.status === 'VOIDED'} className="h-11 rounded-xl bg-emerald-600 font-bold hover:bg-emerald-500"><CheckCircle2 className="mr-2 h-4 w-4" />{saving ? 'Saving settlement…' : 'Reconcile settlement'}</Button>
    </DialogContent>
  </Dialog>;
}
