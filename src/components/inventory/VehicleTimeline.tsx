import { useState } from 'react';
import { Camera, Car, MapPin, RefreshCw, Wrench, History } from 'lucide-react';
import type { VehicleRecordResponse } from '@/services/vehicleRecordService';
import type { VehicleHistoryEvent } from '@/types/vehicleActivity';

const icons = { INTAKE: Car, LOCATION: MapPin, STATUS: RefreshCw, PHOTO: Camera, PART: Wrench, PROCESSING: Wrench, DETAILS: History };
export function VehicleTimeline({ record }: { record: VehicleRecordResponse }) {
  const [filter, setFilter] = useState('ALL');
  const { vehicle, intake } = record;
  const events: VehicleHistoryEvent[] = [...(vehicle.history ?? [])];
  if (intake || !events.some(event => event.kind === 'INTAKE')) events.push({ id: 'intake-source', kind: 'INTAKE', at: intake?.at ?? vehicle.dateSetInYard, actor: intake?.actor || 'Not recorded', description: intake ? `Intake recorded · Ticket ${intake.id}` : 'Intake date from the existing vehicle record. Earlier changes were not recorded.' });
  const recordedPhotos = new Set(events.map(event => event.photoUrl).filter(Boolean));
  for (const [index, photoUrl] of (intake?.photos ?? []).entries()) {
    if (!recordedPhotos.has(photoUrl)) events.push({ id: `intake-photo-${index}`, kind: 'PHOTO', at: intake!.at, actor: intake!.actor || 'Not recorded', description: 'Vehicle photo captured at intake.', photoUrl });
  }
  if (vehicle.dismantlingLog.updatedAt && !events.some(event => event.kind === 'PROCESSING')) events.push({ id: 'legacy-processing', kind: 'PROCESSING', at: vehicle.dismantlingLog.updatedAt, actor: 'Not recorded', description: `Existing dismantling log: ${vehicle.dismantlingLog.catalyticConvertersRemoved} catalytic converter(s) and ${vehicle.dismantlingLog.wheelsRemoved} wheel(s) removed. ${vehicle.dismantlingLog.notes ?? ''}` });
  const visible = events.filter(event => filter === 'ALL' || event.kind === filter).reverse().sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const undatedPhoto = vehicle.photoUrl && !events.some(event => event.photoUrl === vehicle.photoUrl);

  return <section className="rounded-3xl border border-slate-700 bg-slate-900 p-5 sm:p-6">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-xl font-black text-white"><History className="size-5 text-sky-400" /> Vehicle history</h2><p className="mt-1 text-xs text-slate-300">One record of intake, moves, status, photos, and parts.</p></div>
      <select aria-label="Filter vehicle history" value={filter} onChange={event => setFilter(event.target.value)} className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"><option value="ALL">All activity</option>{Object.keys(icons).map(kind => <option key={kind} value={kind}>{kind.charAt(0) + kind.slice(1).toLowerCase()}</option>)}</select>
    </div>
    {undatedPhoto && (filter === 'ALL' || filter === 'PHOTO') && <div className="mb-5 rounded-2xl border border-slate-700 bg-slate-800 p-3"><p className="mb-2 text-xs text-slate-300">Existing vehicle photo · date and photographer not recorded</p><img src={vehicle.photoUrl} alt="Existing vehicle record photo" className="max-h-48 rounded-xl object-cover" /></div>}
    <ol className="space-y-5">
      {visible.map(event => { const Icon = icons[event.kind]; return <li key={event.id} className="relative flex gap-3 sm:gap-4">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-sky-500/30 bg-sky-500/15 text-sky-300"><Icon className="size-4" /></div>
        <div className="min-w-0 flex-1 border-b border-slate-700 pb-5"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="text-[10px] font-black uppercase tracking-wider text-sky-300">{event.kind}</span><time dateTime={event.at} className="text-xs text-slate-300">{new Date(event.at).toLocaleString()}</time></div><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-100">{event.description}</p><p className="mt-1 text-xs text-slate-300">By {event.actor}</p>{event.photoUrl && <a href={/^(https?:\/\/|\/api\/uploads\/)/i.test(event.photoUrl) ? event.photoUrl : undefined} target="_blank" rel="noreferrer"><img src={event.photoUrl} alt={event.description} loading="lazy" className="mt-3 max-h-56 rounded-xl object-cover" /></a>}</div>
      </li>; })}
      {!visible.length && <li className="rounded-xl bg-slate-800 p-4 text-sm text-slate-300">No recorded activity in this category.</li>}
    </ol>
  </section>;
}
