import { useState } from 'react';
import { Loader2, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import type { PullYardVehicle } from '@/types/scrap';
import { sendVehicleCommand, vehicleTarget } from '@/services/vehicleRecordService';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function VehicleDismantlingDialog({ vehicle: initialVehicle, onClose, onSaved }: {
  vehicle: PullYardVehicle;
  onClose: () => void;
  onSaved: (vehicle: PullYardVehicle) => void;
}) {
  const [vehicle] = useState(initialVehicle);
  const [cats, setCats] = useState(String(vehicle.dismantlingLog.catalyticConvertersRemoved));
  const [wheels, setWheels] = useState(String(vehicle.dismantlingLog.wheelsRemoved));
  const [gas, setGas] = useState(vehicle.dismantlingLog.gasDrained);
  const [oil, setOil] = useState(vehicle.dismantlingLog.oilDrained);
  const [notes, setNotes] = useState(vehicle.dismantlingLog.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const validCats = cats.trim() !== '' && Number.isSafeInteger(Number(cats)) && Number(cats) >= 0;
  const validWheels = wheels.trim() !== '' && Number.isSafeInteger(Number(wheels)) && Number(wheels) >= 0 && Number(wheels) <= 8;

  const save = async (makeAvailable: boolean) => {
    if (busy || !validCats || !validWheels) return;
    setBusy(true);
    setError('');
    try {
      const result = await sendVehicleCommand({
        action: 'PROCESS', target: vehicleTarget(vehicle), makeAvailable,
        log: { catalyticConvertersRemoved: Number(cats), wheelsRemoved: Number(wheels), gasDrained: gas, oilDrained: oil, ...(notes.trim() ? { notes: notes.trim() } : {}) },
      });
      onSaved(result.vehicles.find(record => record.id === vehicle.id)!);
      toast.success(makeAvailable ? 'Dismantling log saved and vehicle made available' : 'Dismantling log saved', { description: 'The server confirmed the update and recorded your name and timestamp in vehicle history.' });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No server confirmation received. Your entries have been kept here.');
    } finally { setBusy(false); }
  };

  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl border-slate-700 bg-slate-900 text-white">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl"><Wrench className="size-5 text-emerald-400" /> Dismantling & fluid log</DialogTitle>
        <DialogDescription className="text-slate-300">{vehicle.year} {vehicle.make} {vehicle.model} · VIN {vehicle.vin}</DialogDescription>
      </DialogHeader>
      <div className="rounded-2xl border border-sky-800 bg-sky-950 p-3 text-xs leading-relaxed text-sky-200">Record cumulative removed quantities. Saving updates the history, but does not verify availability of a whole component or wheel set. Use the component checks for that.</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="dismantling-cats">Catalytic converters removed</Label><Input id="dismantling-cats" type="number" min={0} step={1} disabled={busy} value={cats} onChange={event => setCats(event.target.value)} aria-invalid={!validCats} className="rounded-xl border-slate-600 bg-slate-800" />{!validCats && <p className="text-xs text-rose-200">Enter a nonnegative whole number.</p>}</div>
        <div className="space-y-2"><Label htmlFor="dismantling-wheels">Wheels removed</Label><Input id="dismantling-wheels" type="number" min={0} max={8} step={1} disabled={busy} value={wheels} onChange={event => setWheels(event.target.value)} aria-invalid={!validWheels} className="rounded-xl border-slate-600 bg-slate-800" />{!validWheels && <p className="text-xs text-rose-200">Enter a whole number from 0 to 8.</p>}</div>
        <div className="flex items-center gap-2"><Checkbox id="dismantling-gas" disabled={busy} checked={gas} onCheckedChange={checked => setGas(checked === true)} className="border-slate-400 data-[state=checked]:bg-emerald-600" /><Label htmlFor="dismantling-gas">Gas drained</Label></div>
        <div className="flex items-center gap-2"><Checkbox id="dismantling-oil" disabled={busy} checked={oil} onCheckedChange={checked => setOil(checked === true)} className="border-slate-400 data-[state=checked]:bg-emerald-600" /><Label htmlFor="dismantling-oil">Oil drained</Label></div>
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="dismantling-notes">Processor notes</Label><Textarea id="dismantling-notes" disabled={busy} maxLength={4000} value={notes} onChange={event => setNotes(event.target.value)} className="rounded-xl border-slate-600 bg-slate-800" /></div>
      </div>
      {error && <div role="alert" className="rounded-xl border border-rose-800 bg-rose-950 p-3 text-sm text-rose-200"><p>{error}</p><p className="mt-2 text-xs">Your entries are still here. If the vehicle changed, close this dialog, refresh the vehicle, and review a fresh log before saving.</p></div>}
      <DialogFooter className="flex-wrap gap-2">
        <Button disabled={busy} variant="outline" onClick={onClose} className="rounded-xl border-slate-600 bg-slate-800 text-white hover:bg-slate-700 hover:text-white">Cancel</Button>
        <Button disabled={busy || !validCats || !validWheels} onClick={() => void save(false)} className="rounded-xl bg-sky-600 font-bold text-white hover:bg-sky-700">{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Save log</Button>
        {vehicle.status === 'PENDING' && <Button disabled={busy || !validCats || !validWheels} onClick={() => void save(true)} className="rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700">Save & make available</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
