import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Camera, Car, MapPin, Printer, RefreshCw, Edit3, Loader2, Wrench } from 'lucide-react';
import type { PullYardVehicle } from '@/types/scrap';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VehicleTimeline } from '@/components/inventory/VehicleTimeline';
import { VehiclePartsPanel } from '@/components/inventory/VehiclePartsPanel';
import { BulkVehicleActionsDialog } from '@/components/inventory/BulkVehicleActionsDialog';
import { VehicleWindowTag } from '@/components/inventory/VehicleWindowTag';
import { VehicleDismantlingDialog } from '@/components/inventory/VehicleDismantlingDialog';
import { fetchVehicleRecord, sendVehicleCommand, vehicleTarget, type VehicleCommand, type VehicleRecordResponse } from '@/services/vehicleRecordService';
import { storageService } from '@/services/storageService';
import { uploadMedia } from '@/services/mediaService';
import { toast } from 'sonner';

export default function VehicleRecordPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const record = useQuery({ queryKey: ['vehicle-record', id], queryFn: () => fetchVehicleRecord(id), refetchInterval: 10000 });
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const settings = storageService.getSettings();
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['vehicle-record'] }); void queryClient.invalidateQueries({ queryKey: ['yard-vehicles'] }); };
  const applyVehicle = (updated: PullYardVehicle) => {
    queryClient.setQueryData<VehicleRecordResponse>(['vehicle-record', updated.id], current => current ? { ...current, vehicle: updated } : current);
    refresh();
  };
  const command = async (value: VehicleCommand) => {
    setBusy(true);
    try {
      const result = await sendVehicleCommand(value);
      applyVehicle(result.vehicles.find(vehicle => vehicle.id === id)!);
      toast.success('Vehicle record updated');
    } catch (reason) { await record.refetch(); throw reason; }
    finally { setBusy(false); }
  };
  const addPhoto = async (file: File) => {
    if (!record.data) return;
    const target = vehicleTarget(record.data.vehicle);
    setBusy(true);
    try { const photoUrl = await uploadMedia(file); await command({ action: 'PHOTO', target, photoUrl }); }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : 'Unable to add the vehicle photo'); }
    finally { setBusy(false); }
  };
  const vehicle = record.data?.vehicle;
  return <div className="min-h-screen bg-slate-950 text-slate-100"><Navbar /><main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
    <div className="flex items-center justify-between gap-3"><Button asChild variant="outline" className="rounded-xl border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white"><Link to="/pull-a-part"><ArrowLeft className="mr-2 size-4" /> Yard workstation</Link></Button><Button disabled={busy || record.isFetching} onClick={() => void record.refetch()} className="rounded-xl bg-sky-700 text-white hover:bg-sky-600"><RefreshCw className={`mr-2 size-4 ${record.isFetching ? 'animate-spin' : ''}`} /> Refresh</Button></div>
    {!vehicle ? <div className="grid min-h-72 place-items-center rounded-3xl border border-slate-700 bg-slate-900 p-8 text-center">{record.isPending ? <div><Loader2 className="mx-auto mb-3 animate-spin text-sky-400" /><p>Opening vehicle record…</p></div> : <div role="alert"><Car className="mx-auto mb-3 size-12 text-sky-400" /><h1 className="text-xl font-black">Unable to open vehicle</h1><p className="mt-2 text-sm text-rose-200">{record.error?.message}</p></div>}</div> : <>
      {record.isError && <p role="alert" className="rounded-xl bg-rose-950 p-3 text-sm text-rose-200">Could not refresh: {record.error.message}. Review a fresh record before making further changes.</p>}
      <header className="overflow-hidden rounded-3xl border border-sky-700 bg-slate-900 shadow-lg">
        <div className="grid md:grid-cols-[280px_1fr]">
          {vehicle.photoUrl ? <img src={vehicle.photoUrl} alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} className="h-56 w-full object-cover md:h-full" /> : <div className="grid min-h-44 place-items-center bg-sky-950"><Car className="size-20 text-sky-300" /></div>}
          <div className="space-y-4 p-5 sm:p-7"><div className="flex flex-wrap items-center gap-2"><Badge className="rounded-full border-sky-500/40 bg-sky-950 text-sky-200">Staff vehicle record</Badge><Badge className={`rounded-full ${vehicle.status === 'AVAILABLE' ? 'bg-emerald-950 text-emerald-200' : vehicle.status === 'CRUSHED' ? 'bg-rose-950 text-rose-200' : 'bg-amber-950 text-amber-200'}`}>{vehicle.status}</Badge></div>
            <div><h1 className="text-3xl font-black tracking-tight sm:text-4xl">{vehicle.year} {vehicle.make} {vehicle.model}</h1><p className="mt-2 break-all font-mono text-xs text-slate-300">VIN {vehicle.vin}</p><p className="mt-1 text-xs text-slate-300">{[vehicle.color, vehicle.trim, vehicle.originSource].filter(Boolean).join(' · ')}</p></div>
            <div className="rounded-2xl border border-sky-800 bg-sky-950 p-4"><p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-sky-200">Current yard location</p><p className="flex items-center gap-2 font-bold text-white"><MapPin className="size-4 shrink-0 text-sky-300" />{vehicle.section}{vehicle.rowNumber ? ` · Row ${vehicle.rowNumber}` : ' · No row assigned'}</p><p className="mt-2 text-xs text-sky-200">{record.data!.mapItems.length ? record.data!.mapItems.map(item => `${item.label} · Map (${item.x}, ${item.y})`).join(' / ') : 'No linked yard-map marker yet.'}</p></div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || record.isError} onClick={() => setEditOpen(true)} className="rounded-xl bg-sky-600 text-xs font-bold text-white hover:bg-sky-700"><MapPin className="mr-1.5 size-4" /> Move / update status</Button>
              <Button disabled={busy || record.isError} onClick={() => setLogOpen(true)} className="rounded-xl bg-emerald-700 text-xs font-bold text-white hover:bg-emerald-600"><Wrench className="mr-1.5 size-4" /> Dismantling log</Button>
              <Button asChild className="rounded-xl bg-slate-700 text-xs font-bold text-white hover:bg-slate-600"><Link onClick={event => { if (busy) event.preventDefault(); }} aria-disabled={busy} to={`/pull-a-part?vehicle=${encodeURIComponent(id)}&action=edit`}><Edit3 className="mr-1.5 size-4" /> Edit details</Link></Button>
              <Button disabled={busy || record.isError} onClick={() => photoInput.current?.click()} className="rounded-xl bg-slate-700 text-xs text-white hover:bg-slate-600"><Camera className="mr-1.5 size-4" />{busy ? 'Saving…' : 'Add photo'}</Button>
              <Button onClick={() => setTagOpen(true)} className="rounded-xl bg-amber-600 text-xs font-bold text-white hover:bg-amber-700"><Printer className="mr-1.5 size-4" /> Window tag</Button>
              <Button asChild variant="outline" className="rounded-xl border-slate-600 bg-slate-800 text-xs text-white hover:bg-slate-700 hover:text-white"><Link to={`/yard-map?vehicle=${encodeURIComponent(id)}`}>Open yard map</Link></Button>
            </div>
          </div>
        </div>
      </header>
      {vehicle.notes && <div className="rounded-2xl border border-amber-800 bg-amber-950 p-4"><h2 className="text-xs font-bold uppercase text-amber-200">Vehicle notes</h2><p className="mt-1 whitespace-pre-wrap break-words text-sm text-amber-100">{vehicle.notes}</p></div>}
      <div className="grid items-start gap-5 xl:grid-cols-[1.1fr_1fr]"><VehiclePartsPanel vehicle={vehicle} busy={busy || record.isError} onCommand={command} /><VehicleTimeline record={record.data!} /></div>
      {editOpen && <BulkVehicleActionsDialog vehicles={[vehicle]} onClose={() => setEditOpen(false)} onSaved={refresh} />}
      {logOpen && <VehicleDismantlingDialog vehicle={vehicle} onClose={() => setLogOpen(false)} onSaved={applyVehicle} />}
      <Dialog open={tagOpen} onOpenChange={setTagOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl border-slate-700 bg-slate-900 text-white"><DialogHeader><DialogTitle>Vehicle window tag</DialogTitle><DialogDescription className="text-slate-300">Scan to open vehicle details. Staff can continue to this record and its actions.</DialogDescription></DialogHeader><VehicleWindowTag vehicle={vehicle} yardName={settings.yardName} publicUrl={window.location.origin} /></DialogContent></Dialog>
    </>}
    <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" capture="environment" className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void addPhoto(file); }} />
  </main></div>;
}
