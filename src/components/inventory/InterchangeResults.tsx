import { useState } from 'react';
import { Car, ExternalLink, Layers3, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { matchesDonorApplication, type InterchangeMapping, type InterchangeYardVehicle } from '@/services/interchangeService';

function ApplicationCard({ item, yardVehicles, inventoryKnown, onYardOnly }: { item: InterchangeMapping; yardVehicles: InterchangeYardVehicle[]; inventoryKnown: boolean; onYardOnly: boolean }) {
  const [visible, setVisible] = useState(20);
  const models = item.compatibleModels.map((model) => ({ model, donors: inventoryKnown ? yardVehicles.filter((vehicle) => matchesDonorApplication(vehicle, model)) : [] }))
    .filter((row) => !onYardOnly || !inventoryKnown || row.donors.length)
    .sort((a, b) => b.donors.length - a.donors.length || a.model.make.localeCompare(b.model.make) || a.model.model.localeCompare(b.model.model) || a.model.startYear - b.model.startYear);
  return <Card className="rounded-2xl border-slate-700 bg-slate-900 text-white"><CardContent className="space-y-4 p-4 sm:p-5">
    <div className="space-y-2"><div className="flex flex-wrap gap-2"><Badge className="rounded-full border-teal-700 bg-teal-950 text-teal-100">{item.partCategory}</Badge>{item.source && <Badge className="rounded-full border-amber-700 bg-amber-950 text-amber-100">Unverified catalog candidate</Badge>}</div><h4 className="text-lg font-bold">{item.partName} · {item.interchangeCode}</h4><p className="text-sm text-slate-200">{item.description}</p>
      {item.specifications && <dl className="flex flex-wrap gap-x-5 gap-y-2 text-xs">{Object.entries(item.specifications).map(([key, value]) => <div key={key}><dt className="text-slate-300">{key}</dt><dd className="font-semibold text-teal-100">{value}</dd></div>)}</dl>}
      {item.source && <p className="text-xs text-slate-200"><a href={item.source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-teal-200 underline underline-offset-4">{item.source.name}<ExternalLink className="h-3 w-3" /></a> · Retrieved {new Date(item.source.fetchedAt).toLocaleDateString()}{item.source.stale ? ' · Refresh failed; older listing retained' : ''}</p>}
      {item.references?.length ? <details className="rounded-xl border border-slate-700 p-3 text-xs"><summary className="cursor-pointer font-semibold text-teal-200">Source-listed OE / replacement references ({item.references.length})</summary><p className="mt-2 leading-relaxed text-slate-200">{item.references.join(' · ')}</p></details> : null}
    </div>
    {!models.length && <p className="rounded-xl border border-slate-700 p-3 text-sm text-slate-200">No recorded donor candidates for this listing. Choose All applications to see vehicles elsewhere.</p>}
    <div className="grid gap-3 sm:grid-cols-2">{models.slice(0, visible).map(({ model, donors }, index) => <article key={`${model.make}-${model.model}-${model.startYear}-${index}`} className="rounded-xl border border-slate-700 bg-slate-950 p-4">
      <div className="flex items-start justify-between gap-2"><Car className="h-5 w-5 shrink-0 text-teal-300" /><Badge className={`rounded-full text-[10px] ${donors.length ? 'border-emerald-700 bg-emerald-950 text-emerald-100' : 'border-slate-600 bg-slate-800 text-slate-100'}`}>{!inventoryKnown ? 'Stock unknown' : donors.length ? `${donors.length} donor candidate${donors.length === 1 ? '' : 's'}` : 'No recorded yard donor'}</Badge></div>
      <h5 className="mt-3 font-bold">{model.make} {model.model}</h5><p className="mt-1 font-mono text-sm text-emerald-200">{model.startYear === model.endYear ? model.startYear : `${model.startYear}–${model.endYear}`}</p>
      {model.engine && <p className="mt-2 text-xs font-semibold text-teal-100">Source engine: {model.engine}</p>}
      {model.notes && <p className="mt-2 text-xs leading-relaxed text-amber-100">Restrictions: {model.notes}</p>}
      {donors.map((vehicle) => <p key={vehicle.id} className="mt-3 border-t border-slate-700 pt-2 text-xs leading-relaxed text-slate-200">{vehicle.year} · {vehicle.engineSizeLiters != null ? `${vehicle.engineSizeLiters}L` : 'Engine unknown — check before pulling'} · {vehicle.color || 'Color not recorded'} · {vehicle.section}{vehicle.rowNumber ? ` / row ${vehicle.rowNumber}` : ''} · {vehicle.status === 'AVAILABLE' ? 'On yard — part presence and condition unknown' : 'Pending processing — not ready to pull'}</p>)}
    </article>)}</div>
    {models.length > visible && <Button onClick={() => setVisible((count) => count + 40)} className="rounded-xl bg-teal-700 text-white hover:bg-teal-600">Show more applications ({models.length - visible} remaining)</Button>}
  </CardContent></Card>;
}

export function InterchangeResults({ mappings, yardVehicles, inventoryKnown, target, loading = false, catalogIncomplete = false }: { mappings: InterchangeMapping[]; yardVehicles: InterchangeYardVehicle[]; inventoryKnown: boolean; target: string; loading?: boolean; catalogIncomplete?: boolean }) {
  const [onYardOnly, setOnYardOnly] = useState(false);
  const count = mappings.reduce((sum, item) => sum + item.compatibleModels.length, 0);
  const donors = inventoryKnown ? yardVehicles.filter((vehicle) => mappings.some((item) => item.compatibleModels.some((application) => matchesDonorApplication(vehicle, application)))) : [];
  const ready = donors.filter((vehicle) => vehicle.status === 'AVAILABLE').length;
  return <section className="space-y-4">
    <div className="rounded-2xl border border-teal-800 bg-teal-950 p-5"><h3 className="flex items-center gap-2 font-bold text-white"><Wrench className="h-5 w-5 text-teal-200" />1. Do we have a possible donor?</h3><p className="mt-2 font-semibold text-teal-100">{loading ? 'Loading public alternator listings…' : !inventoryKnown ? 'Yard availability is unknown.' : !mappings.length ? 'No catalog match yet — cannot determine interchange donors.' : donors.length ? `${ready} on-yard candidate${ready === 1 ? '' : 's'} · ${donors.length - ready} pending processing` : 'No matching donor vehicle recorded on your yard.'}</p><p className="mt-2 text-xs leading-relaxed text-teal-100">These are vehicles to inspect, not confirmed parts in stock. Check the original part number, connector, mounting, pulley, output, regulator and production-date restrictions. A shared aftermarket replacement is not proof that two original alternators swap directly.</p></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-bold text-white"><Layers3 className="h-5 w-5 text-emerald-300" />2. Other source-listed applications ({count})</h3><div className="flex gap-2" aria-label="Application stock filter"><Button aria-pressed={!onYardOnly || !inventoryKnown} onClick={() => setOnYardOnly(false)} className={`h-9 rounded-xl text-xs ${!onYardOnly || !inventoryKnown ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-100'}`}>All applications</Button><Button disabled={!inventoryKnown} aria-pressed={onYardOnly && inventoryKnown} onClick={() => setOnYardOnly(true)} className={`h-9 rounded-xl text-xs ${onYardOnly && inventoryKnown ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-100'}`}>On yard only</Button></div></div>
    <p className="text-sm text-slate-200">Other makes, models, years and engines listed for the same replacement part stay visible even when there is no yard donor. All online listings here are unverified. Compare every restriction with the customer's vehicle and the donor.</p>
    {!loading && !mappings.length && <Card className="rounded-2xl border-amber-800 bg-amber-950 text-amber-100"><CardContent className="space-y-2 p-5"><p className="font-bold">No loaded application record matches {target} and this part/engine selection.</p><p className="text-sm">This is a coverage gap, not proof that nothing fits. The connected alternator listings cover selected truck applications, not every vehicle. Other components still need part-specific data; wheels are shown separately. Try the online research links below.</p></CardContent></Card>}
    {catalogIncomplete && <p role="status" className="rounded-xl border border-amber-700 bg-amber-950 p-3 text-sm text-amber-100">Some listings could not refresh. Results may be incomplete; older records are dated on each card.</p>}
    {mappings.map((item) => <ApplicationCard key={`${item.id}-${onYardOnly}`} item={item} yardVehicles={yardVehicles} inventoryKnown={inventoryKnown} onYardOnly={onYardOnly} />)}
  </section>;
}
