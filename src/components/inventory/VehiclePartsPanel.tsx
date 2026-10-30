import { useState } from 'react';
import { CheckCircle2, CircleHelp, Wrench, XCircle, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import type { PullYardVehicle } from '@/types/scrap';
import type { PartAvailabilityStatus } from '@/types/vehicleActivity';
import { vehicleTarget, type VehicleCommand, type VehicleTarget } from '@/services/vehicleRecordService';
import { vehicleParts } from '@/utils/vehicleRecords';

export const PART_STATUS_LABELS = { NOT_CHECKED: 'Not checked', AVAILABLE: 'Confirmed available', REMOVED: 'Removed' };
const styles = { NOT_CHECKED: 'border-amber-500/40 bg-amber-950 text-amber-200', AVAILABLE: 'border-emerald-500/40 bg-emerald-950 text-emerald-200', REMOVED: 'border-rose-500/40 bg-rose-950 text-rose-200' };
const icons = { NOT_CHECKED: CircleHelp, AVAILABLE: CheckCircle2, REMOVED: XCircle };
export function PartStatusBadge({ status }: { status: PartAvailabilityStatus }) { const Icon = icons[status]; return <Badge className={`gap-1 rounded-full px-2.5 py-1 text-[10px] ${styles[status]}`}><Icon className="size-3" />{PART_STATUS_LABELS[status]}</Badge>; }

export function VehiclePartsPanel({ vehicle, busy = false, onCommand }: { vehicle: PullYardVehicle; busy?: boolean; onCommand?: (command: VehicleCommand) => Promise<void> }) {
  const parts = vehicleParts(vehicle);
  const [pending, setPending] = useState<{ name: string; status: PartAvailabilityStatus; target: VehicleTarget } | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const start = (name: string, status: PartAvailabilityStatus) => { setPending({ name, status, target: vehicleTarget(vehicle) }); setNotes(''); setError(''); };
  const confirm = async () => {
    if (!pending || !onCommand) return;
    try { await onCommand({ action: 'PART', target: pending.target, name: pending.name.trim(), status: pending.status, ...(notes.trim() ? { notes: notes.trim() } : {}) }); setPending(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save this check.'); }
  };
  return <section className="rounded-3xl border border-slate-700 bg-slate-900 p-5 sm:p-6">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-black text-white"><Wrench className="size-5 text-emerald-400" /> Parts availability</h2><p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-300">Listed parts are not verified until checked. Removed parts remain in this record.</p></div>{onCommand && <Button disabled={busy} onClick={() => start('', vehicle.status === 'CRUSHED' ? 'REMOVED' : 'AVAILABLE')} className="rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"><Plus className="mr-1 size-4" /> Check a component</Button>}</div>
    <div className="mb-4 flex flex-wrap gap-2">{(['NOT_CHECKED','AVAILABLE','REMOVED'] as const).map(status => <span key={status} className={`rounded-xl border px-3 py-2 text-xs ${styles[status]}`}>{parts.filter(part => part.status === status).length} {PART_STATUS_LABELS[status]}</span>)}</div>
    {vehicle.status === 'CRUSHED' && <p className="mb-4 rounded-xl bg-rose-950 p-3 text-sm text-rose-200">This vehicle is crushed and unavailable for harvesting, regardless of earlier part checks.</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      {parts.map(part => <div key={part.name.toLowerCase()} className="rounded-2xl border border-slate-700 bg-slate-800 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold text-white">{part.name}</h3><PartStatusBadge status={part.status} /></div><p className="mt-2 text-xs leading-relaxed text-slate-300">{part.checkedAt ? `${part.status === 'NOT_CHECKED' ? 'Marked unchecked' : 'Recorded'} by ${part.checkedBy || 'Not recorded'} · ${new Date(part.checkedAt).toLocaleString()}` : 'No check recorded'}</p>{part.notes && <p className="mt-2 break-words text-xs text-slate-200">{part.notes}</p>}{onCommand && <div className="mt-3 flex flex-wrap gap-2">{(['AVAILABLE','REMOVED','NOT_CHECKED'] as const).filter(status => status !== part.status).map(status => <Button key={status} disabled={busy || (status === 'AVAILABLE' && vehicle.status === 'CRUSHED')} onClick={() => start(part.name, status)} variant="outline" size="sm" className="h-7 rounded-lg border-slate-600 bg-slate-900 px-2 text-[10px] text-slate-100 hover:bg-slate-700 hover:text-white">{status === 'AVAILABLE' ? 'Confirm available' : status === 'REMOVED' ? 'Mark removed' : 'Reset check'}</Button>)}</div>}</div>)}
      {!parts.length && <p className="text-sm text-slate-300">No components listed. Add a component when checking the vehicle.</p>}
    </div>
    <Dialog open={!!pending} onOpenChange={open => { if (!busy && !open) setPending(null); }}><DialogContent className="rounded-3xl border-slate-700 bg-slate-900 text-white"><DialogHeader><DialogTitle>Record a component check</DialogTitle><DialogDescription className="text-slate-300">Your signed-in name and the server timestamp will be saved with this check and added to the vehicle history.</DialogDescription></DialogHeader>
      {pending && <div className="space-y-4"><div className="space-y-2"><Label htmlFor="checked-part">Component</Label><Input id="checked-part" value={pending.name} disabled={busy} maxLength={200} onChange={event => setPending({ ...pending, name: event.target.value })} className="rounded-xl border-slate-600 bg-slate-800" /></div><div className="space-y-2"><Label htmlFor="part-check-status">New availability</Label><select id="part-check-status" disabled={busy} value={pending.status} onChange={event => setPending({ ...pending, status: event.target.value as PartAvailabilityStatus })} className="w-full rounded-xl border border-slate-600 bg-slate-800 p-3 text-sm">{(['NOT_CHECKED','AVAILABLE','REMOVED'] as const).map(status => <option key={status} value={status} disabled={status === 'AVAILABLE' && vehicle.status === 'CRUSHED'}>{PART_STATUS_LABELS[status]}</option>)}</select></div><div className="space-y-2"><Label htmlFor="part-check-notes">Check notes (optional)</Label><Textarea id="part-check-notes" disabled={busy} value={notes} maxLength={1000} onChange={event => setNotes(event.target.value)} placeholder="Condition, quantity, or removal details" className="rounded-xl border-slate-600 bg-slate-800" /></div>{error && <p role="alert" className="text-sm text-rose-200">{error}</p>}</div>}
      <DialogFooter><Button disabled={busy} variant="outline" onClick={() => setPending(null)} className="rounded-xl border-slate-600 bg-slate-800 text-white hover:bg-slate-700 hover:text-white">Cancel</Button><Button disabled={busy || !pending?.name.trim()} onClick={() => void confirm()} className="rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700">{busy ? 'Saving…' : 'Confirm check'}</Button></DialogFooter>
    </DialogContent></Dialog>
  </section>;
}
