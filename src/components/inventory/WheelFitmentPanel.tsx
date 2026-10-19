import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircleDot, Loader2 } from 'lucide-react';
import { apiRequest } from '@/services/apiClient';
import { matchesInterchangeModel, type InterchangeYardVehicle } from '@/services/interchangeService';
import type { WheelFitmentRecord, WheelFitmentResponse } from '@/types/wheelFitment';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InterchangeVehiclePicker } from './InterchangeVehiclePicker';

const optionLabel = (row: WheelFitmentRecord) => `${row.model} · ${row.startYear}–${row.endYear} · ${row.boltPattern} / ${row.centerBore ?? '?'} mm${row.chassis ? ` · ${row.chassis}` : ''} · ${row.id.slice(0, 8)}`;

export function WheelFitmentPanel({ make, model, year, yardVehicles, inventoryKnown }: { make: string; model: string; year: number; yardVehicles: InterchangeYardVehicle[]; inventoryKnown: boolean }) {
  const [recordId, setRecordId] = useState('');
  const [search, setSearch] = useState('');
  const [yardOnly, setYardOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(24);
  const params = new URLSearchParams({ make, year: String(year) });
  const options = useQuery({
    queryKey: ['wheel-catalog-options', make, year],
    queryFn: ({ signal }) => apiRequest<WheelFitmentResponse>(`/api/public/wheel-fitment?${params}`, { signal }),
    staleTime: 3600000, retry: 1,
  });
  const results = useQuery({
    queryKey: ['wheel-hub-candidates', make, year, recordId],
    queryFn: ({ signal }) => apiRequest<WheelFitmentResponse>(`/api/public/wheel-fitment?${params}&recordId=${recordId}`, { signal }),
    enabled: !!recordId, staleTime: 3600000, retry: 1,
  });
  const catalogOptions = options.data?.options ?? [];
  const metadata = results.data ?? options.data;
  const selected = results.data?.selected;
  const rows = (results.data?.candidates ?? []).map((row) => ({
    row,
    donors: inventoryKnown ? yardVehicles.filter((vehicle) => vehicle.status !== 'CRUSHED' && matchesInterchangeModel(vehicle.make, vehicle.model, vehicle.year, row)) : [],
  })).filter(({ row, donors }) => (!yardOnly || !inventoryKnown || donors.length > 0) && `${row.make} ${row.model} ${row.startYear} ${row.endYear}`.toLowerCase().includes(search.trim().toLowerCase()));

  return <section className="space-y-4 rounded-2xl border border-cyan-800 bg-cyan-950 p-4 text-white sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-lg font-extrabold"><CircleDot className="h-6 w-6 text-cyan-200" />Free wheel-specification catalog</h3><Badge className="rounded-full border-cyan-600 bg-cyan-900 text-cyan-100">Wheels only · source-published specifications</Badge></div>
    <p className="text-sm leading-relaxed text-cyan-100">For {year} {make} {model}, confirm the exact catalog vehicle, trim and market below. Never select a different variant just to fill a missing record. This source does not cover engines, transmissions or body parts.</p>
    {options.isPending ? <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading the free catalog…</p> : options.isError ? <div role="alert" className="space-y-2 text-sm"><p>{options.error.message}</p><Button className="rounded-xl bg-cyan-700 text-white" onClick={() => void options.refetch()}>Retry catalog</Button></div> : <>
      <InterchangeVehiclePicker label="Confirm exact wheel-catalog variant" value={catalogOptions.find((row) => row.id === recordId) ? optionLabel(catalogOptions.find((row) => row.id === recordId)!) : ''} options={catalogOptions.map(optionLabel)} disabled={!catalogOptions.length} loading={options.isFetching} onChange={(label) => { setRecordId(catalogOptions.find((row) => optionLabel(row) === label)!.id); setVisibleCount(24); }} />
      {!catalogOptions.length && <p className="text-sm text-cyan-100">No wheel records for this make and year. That means missing source coverage, not that no wheel fits.</p>}
      {!!catalogOptions.length && !recordId && <p className="text-xs text-cyan-100">Select the exact source entry to compare hub dimensions. No match is inferred from a shared model name.</p>}
    </>}
    {!!recordId && results.isPending && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Finding source-published hub matches…</p>}
    {!!recordId && results.isError && <div role="alert" className="space-y-2 text-sm"><p>{results.error.message}</p><Button className="rounded-xl bg-cyan-700 text-white" onClick={() => { setRecordId(''); void options.refetch(); }}>Reload variants</Button></div>}
    {selected && <>
      <div className="space-y-2 rounded-xl border border-cyan-700 bg-cyan-900 p-4"><p className="font-bold">Comparing: {selected.make} {selected.model} · {year}</p><p className="font-mono text-sm">{selected.boltPattern} · front bore {selected.centerBore ?? 'unknown'} mm · rear bore {selected.rearCenterBore ?? 'unknown'} mm</p><p className="text-sm">Factory wheel: {selected.factoryWheel || 'Not supplied by source'}</p><a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-semibold text-cyan-100 underline underline-offset-4">Review this vehicle’s source specifications ↗</a></div>
      <div role="note" className="rounded-xl border border-amber-700 bg-amber-950 p-4 text-sm leading-relaxed text-amber-100"><strong>Candidate comparison—not confirmed wheel interchange.</strong> These vehicles share published lug count, bolt pattern and front/rear hub bores. Wheel diameter, width, offset, brake clearance, load rating, fastener thread and seat, tire size and modifications must still be checked. No adapters or machining are assumed.</div>
      {(selected.centerBore === null || selected.rearCenterBore === null) ? <p className="text-sm">A required hub dimension is missing; no candidates are generated.</p> : <>
        <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-bold">Shared-hub vehicle records ({results.data?.candidates.length ?? 0})</h4><div className="flex gap-2"><Button className={`h-9 rounded-xl text-xs ${!yardOnly || !inventoryKnown ? 'bg-cyan-700' : 'bg-slate-800'} text-white`} aria-pressed={!yardOnly || !inventoryKnown} onClick={() => { setYardOnly(false); setVisibleCount(24); }}>All records</Button><Button disabled={!inventoryKnown} className={`h-9 rounded-xl text-xs ${yardOnly && inventoryKnown ? 'bg-cyan-700' : 'bg-slate-800'} text-white`} aria-pressed={yardOnly && inventoryKnown} onClick={() => { setYardOnly(true); setVisibleCount(24); }}>With yard records</Button></div></div>
        <Input aria-label="Filter wheel candidates by make, model or year" value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(24); }} placeholder="Filter candidates by make, model or year…" className="rounded-xl border-cyan-700 bg-slate-950 text-white placeholder:text-slate-300" />
        <p className="text-xs text-cyan-100">All source years and models are included, regardless of inventory. Yard labels require an exact vehicle model/variant record and do not confirm a usable wheel is available.</p>
        {!rows.length && <p className="text-sm">No records match this comparison or filter. This is not proof that no other wheel fits.</p>}
        <div className="grid gap-3 sm:grid-cols-2">{rows.slice(0, visibleCount).map(({ row, donors }) => <article key={row.id} className="space-y-2 rounded-xl border border-cyan-800 bg-slate-950 p-4"><Badge className={`rounded-full ${donors.length ? 'border-emerald-700 bg-emerald-950 text-emerald-100' : 'border-slate-600 bg-slate-800 text-slate-100'}`}>{!inventoryKnown ? 'Yard stock unknown' : donors.length ? `${donors.length} exact yard record${donors.length === 1 ? '' : 's'}` : 'No exact yard record'}</Badge><h5 className="font-bold">{row.make} {row.model}</h5><p className="font-mono text-sm text-cyan-200">{row.startYear}–{row.endYear} · {row.boltPattern}</p>{row.chassis && <p className="text-xs text-slate-200">Chassis: {row.chassis}</p>}<p className="text-xs leading-relaxed text-slate-200">Factory wheel: {row.factoryWheel || 'Not supplied by source'}</p>{donors.map((vehicle) => <p key={vehicle.id} className="text-xs text-emerald-100">{vehicle.year} · {vehicle.section}{vehicle.rowNumber ? ` / row ${vehicle.rowNumber}` : ''} · {vehicle.status === 'AVAILABLE' ? 'Verify wheel availability' : 'Pending processing'}</p>)}<a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-xs font-semibold text-cyan-200 underline underline-offset-4">Review source and restrictions ↗</a></article>)}</div>
        {rows.length > visibleCount && <Button className="w-full rounded-xl bg-cyan-700 text-white" onClick={() => setVisibleCount((count) => count + 24)}>Show next {Math.min(24, rows.length - visibleCount)} records ({Math.min(visibleCount, rows.length)} of {rows.length} shown)</Button>}
      </>}
    </>}
    {metadata && <footer className="space-y-1 border-t border-cyan-800 pt-3 text-xs leading-relaxed text-cyan-100"><p>Wheel fitment data: <a href="https://ankusiwheels.com/wheel-fitment-dataset/" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">ANKUSI Wheel Fitment Dataset</a> (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline">CC BY 4.0</a>). Adapted by normalizing fields and comparing hub dimensions; not independently certified by this app.</p><p>Version {metadata.version} · {metadata.recordCount.toLocaleString()} imported records · fetched {new Date(metadata.fetchedAt).toLocaleDateString()}{metadata.rejectedRecords ? ` · ${metadata.rejectedRecords} invalid/unsupported records excluded` : ''}. Stored in the app database; checked for updates daily when used.</p>{metadata.stale && <p role="status" className="font-semibold text-amber-200">Source refresh failed. Showing the dated, last-known-good catalog; specifications may have changed.</p>}</footer>}
  </section>;
}
