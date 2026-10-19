import { useState } from 'react';
import { Car, Layers3, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { matchesInterchangeModel, type InterchangeMapping, type InterchangeYardVehicle } from '@/services/interchangeService';

export function InterchangeResults({ mappings, yardVehicles, inventoryKnown, target }: { mappings: InterchangeMapping[]; yardVehicles: InterchangeYardVehicle[]; inventoryKnown: boolean; target: string }) {
  const [onYardOnly, setOnYardOnly] = useState(false);
  const count = mappings.reduce((sum, item) => sum + item.compatibleModels.length, 0);
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 font-bold text-white"><Layers3 className="h-5 w-5 text-emerald-300" />Known compatible models ({count})</h3>
      <div className="flex gap-2" aria-label="Compatibility stock filter">
        <Button aria-pressed={!onYardOnly || !inventoryKnown} onClick={() => setOnYardOnly(false)} className={`h-9 rounded-xl text-xs ${!onYardOnly || !inventoryKnown ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-100'}`}>All models</Button>
        <Button disabled={!inventoryKnown} aria-pressed={onYardOnly && inventoryKnown} onClick={() => setOnYardOnly(true)} className={`h-9 rounded-xl text-xs ${onYardOnly && inventoryKnown ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-100'}`}>On yard only</Button>
      </div>
    </div>
    <p className="text-sm text-slate-200">Compatibility is part-specific. All models are shown by default, even when no matching vehicle is on the yard. A listed vehicle does not guarantee its part is still available.</p>
    {!mappings.length && <Card className="rounded-2xl border-amber-800 bg-amber-950 text-amber-100"><CardContent className="space-y-2 p-5"><Wrench className="h-6 w-6 text-amber-200" /><p className="font-bold">No verified interchange records for {target} and this component.</p><p className="text-sm">This does not mean no other models fit. Free source coverage currently includes wheel specifications and shared-hub candidates, shown separately—not confirmed component interchange. NHTSA supplies vehicle names only. Engines, transmissions and body parts still require verified part-specific records. Use the online research options below and verify the part number, engine, trim and production date before pulling a part.</p></CardContent></Card>}
    {mappings.map((item) => {
      const models = item.compatibleModels.map((model) => ({ model, donors: inventoryKnown ? yardVehicles.filter((vehicle) => vehicle.status !== 'CRUSHED' && matchesInterchangeModel(vehicle.make, vehicle.model, vehicle.year, model)) : [] })).filter((row) => !onYardOnly || !inventoryKnown || row.donors.length);
      return <Card key={item.id} className="rounded-2xl border-slate-700 bg-slate-900 text-white"><CardContent className="space-y-4 p-4 sm:p-5">
        <div><Badge className="rounded-full border-teal-700 bg-teal-950 text-teal-100">{item.partCategory}</Badge><h4 className="mt-2 text-lg font-bold">{item.partName}</h4><p className="mt-1 text-sm text-slate-200">{item.description}</p><p className="mt-1 font-mono text-xs text-emerald-200">Interchange reference: {item.interchangeCode}</p></div>
        {!models.length && <p className="rounded-xl border border-slate-700 p-3 text-sm text-slate-200">No matching donor vehicles currently on the yard. Choose All models to see compatible models elsewhere.</p>}
        <div className="grid gap-3 sm:grid-cols-2">{models.map(({ model, donors }, index) => <article key={`${model.make}-${model.model}-${model.startYear}-${index}`} className="rounded-xl border border-slate-700 bg-slate-950 p-4">
          <div className="flex items-start justify-between gap-2"><Car className="h-5 w-5 shrink-0 text-teal-300" /><Badge className={`rounded-full text-[10px] ${donors.length ? 'border-emerald-700 bg-emerald-950 text-emerald-100' : 'border-slate-600 bg-slate-800 text-slate-100'}`}>{!inventoryKnown ? 'Stock unknown' : donors.length ? `${donors.length} on yard` : 'Not on yard'}</Badge></div>
          <h5 className="mt-3 font-bold">{model.make} {model.model}</h5><p className="mt-1 font-mono text-sm text-emerald-200">{model.startYear}–{model.endYear}</p>
          {model.notes && <p className="mt-2 text-xs leading-relaxed text-amber-100">Fitment notes: {model.notes}</p>}
          {donors.map((vehicle) => <p key={vehicle.id} className="mt-3 border-t border-slate-700 pt-2 text-xs text-slate-200">{vehicle.year} · {vehicle.color || 'Color not recorded'} · {vehicle.section}{vehicle.rowNumber ? ` / row ${vehicle.rowNumber}` : ''} · {vehicle.status === 'AVAILABLE' ? 'On yard — verify part availability' : 'Pending processing'}</p>)}
        </article>)}</div>
      </CardContent></Card>;
    })}
  </section>;
}
