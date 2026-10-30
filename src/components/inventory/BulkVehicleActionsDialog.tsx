import { useState } from 'react';
import { ArrowRight, Layers3, AlertTriangle, Car } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { PullYardVehicle } from '@/types/scrap';
import { VEHICLE_SECTIONS } from '@/types/vehicleActivity';
import { sendVehicleCommand, vehicleTarget, type VehiclePatch } from '@/services/vehicleRecordService';
import { storageService } from '@/services/storageService';
import { isCrushLocked } from '@/utils/holdUtils';
import { toast } from 'sonner';

export function BulkVehicleActionsDialog({ vehicles: initialVehicles, onClose, onSaved }: { vehicles: PullYardVehicle[]; onClose: () => void; onSaved: () => void }) {
  const [vehicles] = useState(initialVehicles);
  const [section, setSection] = useState('KEEP');
  const [status, setStatus] = useState('KEEP');
  const [row, setRow] = useState('');
  const [clearRow, setClearRow] = useState(false);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const settings = storageService.getSettings();
  const patch: VehiclePatch = { ...(section !== 'KEEP' ? { section: section as PullYardVehicle['section'] } : {}), ...(status !== 'KEEP' ? { status: status as PullYardVehicle['status'] } : {}), ...(clearRow ? { rowNumber: null } : row ? { rowNumber: Number(row) } : {}) };
  const after = (vehicle: PullYardVehicle): PullYardVehicle => ({ ...vehicle, ...patch, rowNumber: patch.rowNumber === null ? undefined : patch.rowNumber ?? vehicle.rowNumber });
  const changed = vehicles.filter(vehicle => { const next = after(vehicle); return next.section !== vehicle.section || next.status !== vehicle.status || next.rowNumber !== vehicle.rowNumber; });
  const blocked = changed.filter(vehicle => after(vehicle).status === 'CRUSHED' && vehicle.status !== 'CRUSHED' && isCrushLocked({ holdUntil: vehicle.holdUntil, startDateFallback: vehicle.dateSetInYard }, new Date(), { enabled: settings.crushHoldEnabled !== false, crushHoldDays: settings.crushHoldDays ?? 30 }, vehicle.holdOverride));
  const invalidRow = !!row && (!Number.isInteger(Number(row)) || Number(row) < 1 || Number(row) > 9999);
  const save = async () => {
    setBusy(true); setError('');
    try {
      await sendVehicleCommand({ action: 'BULK', targets: changed.map(vehicleTarget), patch });
      toast.success(`${changed.length} vehicle${changed.length === 1 ? '' : 's'} updated`, { description: 'All changes were committed together and recorded in vehicle history.' });
      onSaved(); onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Bulk update failed. No changes were applied.'); }
    finally { setBusy(false); }
  };
  const location = (vehicle: PullYardVehicle) => `${vehicle.section} · ${vehicle.rowNumber ? `Row ${vehicle.rowNumber}` : 'No row assigned'}`;
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto rounded-3xl border-slate-700 bg-slate-900 text-white">
    <DialogHeader><DialogTitle className="flex items-center gap-2 text-xl"><Layers3 className="text-sky-400" />{preview ? 'Review every change' : 'Update selected vehicles'}</DialogTitle><DialogDescription className="text-slate-300">{vehicles.length} selected. {preview ? 'Nothing changes until you confirm. Map marker coordinates stay unchanged.' : 'Move yard section or row, update status, or do both. You will see a before-and-after preview.'}</DialogDescription></DialogHeader>
    {!preview ? <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="bulk-section">Yard section</Label><select id="bulk-section" value={section} onChange={event => setSection(event.target.value)} className="w-full rounded-xl border border-slate-600 bg-slate-800 p-3 text-sm"><option value="KEEP">Keep each current section</option>{VEHICLE_SECTIONS.map(value => <option key={value}>{value}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="bulk-status">Vehicle status</Label><select id="bulk-status" value={status} onChange={event => setStatus(event.target.value)} className="w-full rounded-xl border border-slate-600 bg-slate-800 p-3 text-sm"><option value="KEEP">Keep each current status</option><option value="PENDING">Pending</option><option value="AVAILABLE">Available</option><option value="CRUSHED">Crushed</option></select></div>
      <div className="space-y-2"><Label htmlFor="bulk-row">Row number</Label><Input id="bulk-row" type="number" min={1} max={9999} value={row} disabled={clearRow} onChange={event => setRow(event.target.value)} placeholder="Leave blank to keep each current row" className="rounded-xl border-slate-600 bg-slate-800" />{invalidRow && <p className="text-xs text-rose-200">Enter a whole row number from 1 to 9999.</p>}</div>
      <div className="flex items-center gap-2 sm:pt-8"><Checkbox id="bulk-clear-row" checked={clearRow} onCheckedChange={value => { setClearRow(value === true); if (value === true) setRow(''); }} className="border-slate-400 data-[state=checked]:bg-sky-600" /><Label htmlFor="bulk-clear-row" className="text-sm text-slate-200">Clear row assignments</Label></div>
      <p className="rounded-xl bg-sky-950 p-4 text-sm text-sky-200 sm:col-span-2">{changed.length} vehicle{changed.length === 1 ? '' : 's'} will change. {vehicles.length - changed.length} will stay unchanged. Vehicles hidden by inventory filters are included if selected.</p>
    </div> : <div className="space-y-3">
      <p className="text-sm font-bold text-sky-200">{changed.length} changing · {vehicles.length - changed.length} unchanged</p>
      {vehicles.map(vehicle => { const next = after(vehicle); const changes = changed.some(row => row.id === vehicle.id); return <div key={vehicle.id} className={`rounded-2xl border p-4 ${changes ? 'border-sky-700 bg-sky-950/50' : 'border-slate-700 bg-slate-800'}`}>
        <div className="mb-3 flex items-center gap-3">{vehicle.photoUrl ? <img src={vehicle.photoUrl} alt="" className="size-10 rounded-lg object-cover" /> : <Car className="size-8 text-sky-300" />}<div><h3 className="text-sm font-bold">{vehicle.year} {vehicle.make} {vehicle.model}</h3><p className="font-mono text-[10px] text-slate-300">{vehicle.vin}</p></div>{!changes && <span className="ml-auto text-xs text-slate-300">No changes</span>}</div>
        <div className="grid items-center gap-2 text-xs sm:grid-cols-[1fr_auto_1fr]"><div><p className="mb-1 font-bold uppercase text-slate-300">Before</p><p>{location(vehicle)}</p><p className="mt-1 font-bold text-amber-200">{vehicle.status}</p></div><ArrowRight className="size-4 text-sky-300" /><div><p className="mb-1 font-bold uppercase text-sky-200">After</p><p>{location(next)}</p><p className="mt-1 font-bold text-sky-200">{next.status}</p></div></div>
      </div>; })}
    </div>}
    {blocked.length > 0 && <div role="alert" className="flex gap-2 rounded-xl border border-amber-600 bg-amber-950 p-3 text-sm text-amber-200"><AlertTriangle className="size-5 shrink-0" /><p>{blocked.length} selected vehicle(s) are under a title hold. Remove them from this selection or use the individual administrator override first. No partial updates will be applied.</p></div>}
    {error && <p role="alert" className="rounded-xl bg-rose-950 p-3 text-sm text-rose-200">{error} Close this dialog and refresh the selection before trying again.</p>}
    <DialogFooter><Button disabled={busy} variant="outline" onClick={onClose} className="rounded-xl border-slate-600 bg-slate-800 text-white hover:bg-slate-700 hover:text-white">Cancel</Button>{preview && <Button disabled={busy} onClick={() => { setPreview(false); setError(''); }} className="rounded-xl bg-slate-700 text-white hover:bg-slate-600">Back to changes</Button>}<Button disabled={busy || !changed.length || invalidRow || !!blocked.length || changed.length > 500 || !!error} onClick={() => preview ? void save() : setPreview(true)} className="rounded-xl bg-sky-600 font-bold text-white hover:bg-sky-700">{busy ? 'Applying all changes…' : preview ? `Confirm ${changed.length} updates` : 'Preview changes'}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
