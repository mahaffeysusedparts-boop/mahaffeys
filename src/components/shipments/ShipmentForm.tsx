import { useState } from 'react';
import { Plus, Scale, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { scaleService } from '@/services/scaleService';
import { storageService } from '@/services/storageService';
import type { OutboundShipment, ShipmentGradeLine } from '@/types/scrap';

const money = (value: number) => value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
const inputStyle = 'mt-1 rounded-xl border-slate-700 bg-slate-950 text-white';
const newLine = () => ({ id: crypto.randomUUID(), gradeName: '', weight: '', price: '' });

export function ShipmentForm({ onClose, mills, onSaved }: {
  onClose: () => void;
  mills: { id: string; name: string }[];
  onSaved: () => void;
}) {
  const [fields, setFields] = useState({ millName: '', trailerNumber: '', driverName: '', grossWeightLbs: '', tareWeightLbs: '' });
  const [lines, setLines] = useState([newLine()]);
  const [metals] = useState(() => storageService.getMetals());
  const net = Math.max(0, Number(fields.grossWeightLbs) - Number(fields.tareWeightLbs));
  const gradeWeight = lines.reduce((sum, line) => sum + Number(line.weight), 0);
  const revenue = lines.reduce((sum, line) => sum + Number(line.weight) * Number(line.price), 0);
  const remaining = net - gradeWeight;
  const updateLine = (id: string, field: 'gradeName' | 'weight' | 'price', value: string) => {
    setLines(current => current.map(line => line.id === id ? { ...line, [field]: value } : line));
  };

  const save = () => {
    const gross = Number(fields.grossWeightLbs);
    const tare = Number(fields.tareWeightLbs);
    if (!fields.millName.trim() || fields.grossWeightLbs === '' || fields.tareWeightLbs === '' || !Number.isFinite(gross) || !Number.isFinite(tare) || tare < 0 || net <= 0) {
      toast.error('Add a mill and valid gross/tare weights');
      return;
    }
    if (lines.some(line => !line.gradeName.trim() || line.weight === '' || !Number.isFinite(Number(line.weight)) || Number(line.weight) <= 0 || line.price === '' || !Number.isFinite(Number(line.price)) || Number(line.price) < 0)) {
      toast.error('Enter a grade, positive weight, and sold price for every row');
      return;
    }
    if (Math.abs(remaining) > 0.01) {
      toast.error('Grade weights must match the shipment net weight');
      return;
    }
    if (!Number.isFinite(revenue)) {
      toast.error('Enter valid grade weights and prices');
      return;
    }
    const gradeLines: ShipmentGradeLine[] = lines.map(line => ({
      id: line.id,
      gradeName: line.gradeName.trim(),
      netWeightLbs: Number(line.weight),
      soldPricePerLb: Number(line.price),
    }));
    const millName = fields.millName.trim();
    const shipment: OutboundShipment = {
      id: crypto.randomUUID(),
      loadNumber: `LD-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
      millId: mills.find(mill => mill.name === millName)?.id,
      millName,
      materialCategory: gradeLines.map(line => line.gradeName).join(', '),
      gradeLines,
      trailerNumber: fields.trailerNumber.trim(),
      driverName: fields.driverName.trim(),
      grossWeightLbs: gross,
      tareWeightLbs: tare,
      netWeightLbs: net,
      expectedRatePerLb: revenue / net,
      expectedRevenue: Math.round(revenue * 100) / 100,
      status: 'STAGED',
      createdAt: new Date().toISOString(),
    };
    storageService.saveShipment(shipment);
    toast.success('Load staged with grade sale prices');
    onSaved();
    onClose();
  };

  return <Dialog open onOpenChange={open => !open && onClose()}>
    <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto rounded-2xl border-slate-700 bg-slate-900 text-white">
      <DialogHeader>
        <DialogTitle>Stage outbound load</DialogTitle>
        <p className="text-sm text-slate-400">Add every grade on this shipment and the price you sold it for.</p>
      </DialogHeader>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {([['Mill / processor', 'millName'], ['Trailer / bin', 'trailerNumber'], ['Driver', 'driverName']] as const).map(([label, key]) => <div key={key} className={key === 'millName' ? 'sm:col-span-2' : ''}>
          <Label htmlFor={`shipment-${key}`}>{label}</Label>
          <Input id={`shipment-${key}`} list={key === 'millName' ? 'shipment-mills' : undefined} value={fields[key]} onChange={event => setFields({ ...fields, [key]: event.target.value })} className={inputStyle} />
        </div>)}
        <datalist id="shipment-mills">{mills.map(mill => <option key={mill.id} value={mill.name} />)}</datalist>
        {(['grossWeightLbs', 'tareWeightLbs'] as const).map(key => <div key={key}>
          <Label htmlFor={`shipment-${key}`}>{key === 'grossWeightLbs' ? 'Gross weight (lbs)' : 'Tare weight (lbs)'}</Label>
          <div className="mt-1 flex gap-2">
            <Input id={`shipment-${key}`} type="number" min="0" step="any" value={fields[key]} onChange={event => setFields({ ...fields, [key]: event.target.value })} className="rounded-xl border-slate-700 bg-slate-950" />
            <Button type="button" size="icon" variant="outline" aria-label={`Capture ${key === 'grossWeightLbs' ? 'gross' : 'tare'} weight`} onClick={() => setFields({ ...fields, [key]: String(scaleService.getStatus().weight) })} className="shrink-0 rounded-xl border-slate-700 bg-slate-950 hover:bg-slate-800"><Scale className="h-4 w-4" /></Button>
          </div>
        </div>)}
      </div>
      <section className="space-y-3 rounded-2xl border border-slate-700 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold">Grades & sold prices</h3>
          <Button type="button" variant="outline" onClick={() => setLines(current => [...current, newLine()])} className="rounded-xl border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200"><Plus className="mr-1 h-4 w-4" />Add grade</Button>
        </div>
        <datalist id="shipment-grades">{metals.map(metal => <option key={metal.id} value={metal.name} />)}</datalist>
        {lines.map((line, index) => <div key={line.id} className="grid grid-cols-2 gap-3 rounded-xl bg-slate-950/60 p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor={`grade-${line.id}`}>Grade {index + 1}</Label>
            <Input id={`grade-${line.id}`} list="shipment-grades" placeholder="Select or enter grade" value={line.gradeName} onChange={event => updateLine(line.id, 'gradeName', event.target.value)} className={inputStyle} />
          </div>
          <div>
            <Label htmlFor={`weight-${line.id}`}>Net weight (lbs)</Label>
            <Input id={`weight-${line.id}`} type="number" min="0" step="any" value={line.weight} onChange={event => updateLine(line.id, 'weight', event.target.value)} className={inputStyle} />
          </div>
          <div>
            <Label htmlFor={`price-${line.id}`}>Sold price ($/lb)</Label>
            <Input id={`price-${line.id}`} type="number" min="0" step="any" placeholder="0.000" value={line.price} onChange={event => updateLine(line.id, 'price', event.target.value)} className={inputStyle} />
          </div>
          <Button type="button" variant="ghost" size="icon" disabled={lines.length === 1} aria-label={`Remove grade ${index + 1}`} onClick={() => setLines(current => current.filter(item => item.id !== line.id))} className="rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-300 sm:mt-6"><Trash2 className="h-4 w-4" /></Button>
          <div className="col-span-2 flex flex-wrap items-center justify-end gap-3 text-xs text-slate-300 sm:col-span-4">
            <Button type="button" variant="link" onClick={() => updateLine(line.id, 'weight', String(Math.max(0, net - gradeWeight + Number(line.weight))))} className="h-auto p-0 text-xs text-emerald-400">Use remaining net weight</Button>
            <span>Grade total <b className="font-mono text-emerald-300">{money(Number(line.weight) * Number(line.price))}</b></span>
          </div>
        </div>)}
      </section>
      <div className="space-y-1 rounded-xl bg-emerald-500/10 p-4 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><span>Shipment net <b>{net.toLocaleString()} lbs</b></span><span>Total sale <b className="font-mono text-emerald-300">{money(revenue)}</b></span></div>
        <p className={Math.abs(remaining) > 0.01 ? 'text-amber-300' : 'text-emerald-300'}>{gradeWeight.toLocaleString()} lbs assigned · {Math.abs(remaining) <= 0.01 ? 'All weight assigned' : remaining > 0 ? `${remaining.toLocaleString()} lbs left to assign` : `${Math.abs(remaining).toLocaleString()} lbs over shipment net`}</p>
      </div>
      <Button onClick={save} className="h-11 rounded-xl bg-emerald-600 font-bold hover:bg-emerald-500">Stage shipment</Button>
    </DialogContent>
  </Dialog>;
}
