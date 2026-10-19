import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { interchangeService, matchesInterchangeModel, matchesPartIdentifier, matchesComponentQuery } from '@/services/interchangeService';
import { vehicleOptionsService } from '@/services/vehicleOptionsService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Car, ExternalLink, Layers3, Search } from 'lucide-react';
import { InterchangeVehiclePicker } from './InterchangeVehiclePicker';
import { InterchangeResults } from './InterchangeResults';
import { WheelFitmentPanel } from './WheelFitmentPanel';
import { EngineCompatibilityPanel } from './EngineCompatibilityPanel';

interface PartsInterchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMake?: string;
  initialModel?: string;
  initialYear?: number;
}

const uniqueNames = (values: string[]) => [...new Map(values.filter(Boolean).map((name) => [name.trim().toLowerCase(), name.trim()])).values()];
const commonMakes = ['ford', 'chevrolet', 'gmc', 'dodge', 'ram', 'jeep', 'toyota', 'honda', 'nissan', 'hyundai', 'kia', 'subaru', 'buick', 'cadillac', 'lincoln'];

export const PartsInterchangeModal: React.FC<PartsInterchangeModalProps> = ({ isOpen, onClose, initialMake = 'Ford', initialModel = 'F-150', initialYear = 2008 }) => {
  const [searchMake, setSearchMake] = useState(initialMake);
  const [searchModel, setSearchModel] = useState(initialModel);
  const [searchYear, setSearchYear] = useState(initialYear);
  const [searchTerm, setSearchTerm] = useState('');
  const [engine, setEngine] = useState('any');
  const [identifier, setIdentifier] = useState('');
  useEffect(() => {
    if (!isOpen) return;
    setSearchMake(initialMake); setSearchModel(initialModel); setSearchYear(initialYear); setSearchTerm(''); setIdentifier('');
  }, [isOpen, initialMake, initialModel, initialYear]);
  useEffect(() => { setEngine('any'); setIdentifier(''); }, [searchMake, searchModel, searchYear]);

  const publicCatalog = useQuery({ queryKey: ['public-parts-catalog'], queryFn: ({ signal }) => interchangeService.publicCatalog(signal), enabled: isOpen, staleTime: 300000, retry: 1 });
  const components = useQuery({ queryKey: ['public-component-catalog'], queryFn: ({ signal }) => interchangeService.componentCatalog(signal), enabled: isOpen, staleTime: 300000, retry: 1 });
  const additionalComponents = useQuery({ queryKey: ['public-additional-component-catalog'], queryFn: ({ signal }) => interchangeService.additionalComponentCatalog(signal), enabled: isOpen, staleTime: 300000, retry: 1 });
  const inventory = useQuery({ queryKey: ['interchange-yard-inventory', isOpen], queryFn: vehicleOptionsService.yardVehicles, enabled: isOpen, staleTime: 0, retry: 1 });
  const yardVehicles = inventory.data ?? [];
  const makes = useQuery({ queryKey: ['vehicle-options', 'makes'], queryFn: vehicleOptionsService.makes, enabled: isOpen, staleTime: 86400000, retry: 1 });
  const makeId = makes.data?.options.find((option) => option.name.toLowerCase() === searchMake.toLowerCase())?.id;
  const models = useQuery({ queryKey: ['vehicle-options', 'models', makeId, searchYear], queryFn: () => vehicleOptionsService.models(makeId!, searchYear), enabled: isOpen && !!makeId, staleTime: 86400000, retry: 1 });
  const catalogue = [...publicCatalog.data?.mappings ?? [], ...components.data?.mappings ?? [], ...additionalComponents.data?.mappings ?? []];
  const catalogSources = [...publicCatalog.data?.sources ?? [], ...components.data?.sources ?? [], ...additionalComponents.data?.sources ?? []];
  const catalogLoading = publicCatalog.isPending || components.isPending || additionalComponents.isPending;
  const catalogError = publicCatalog.isError || components.isError || additionalComponents.isError;
  const catalogIncomplete = catalogError || catalogSources.some((source) => source.state !== 'loaded');
  const makeNames = uniqueNames([...makes.data?.options.map((item) => item.name) ?? [], ...yardVehicles.map((vehicle) => vehicle.make), ...catalogue.flatMap((item) => item.compatibleModels.map((model) => model.make)), searchMake]).sort((a, b) => {
    const rank = (value: string) => { const index = commonMakes.indexOf(value.toLowerCase()); return index < 0 ? commonMakes.length : index; };
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  const modelNames = uniqueNames([...models.data?.options.map((item) => item.name) ?? [], ...yardVehicles.filter((vehicle) => vehicle.make.toLowerCase() === searchMake.toLowerCase() && vehicle.year === searchYear).map((vehicle) => vehicle.model), ...catalogue.flatMap((item) => item.compatibleModels.filter((model) => model.make.toLowerCase() === searchMake.toLowerCase() && searchYear >= model.startYear && searchYear <= model.endYear).map((model) => model.model)), searchModel]).sort((a, b) => a.localeCompare(b));
  const vehicleMappings = interchangeService.findInterchangeForVehicle(searchMake, searchModel, searchYear, catalogue);
  const targetYardVehicles = yardVehicles.filter((vehicle) => matchesInterchangeModel(searchMake, searchModel, searchYear, { make: vehicle.make, model: vehicle.model, startYear: vehicle.year, endYear: vehicle.year }));
  const engineOptions = [...new Set([...vehicleMappings.flatMap((mapping) => mapping.compatibleModels.filter((row) => matchesInterchangeModel(searchMake, searchModel, searchYear, row) && row.engineLiters != null).map((row) => row.engineLiters!)), ...targetYardVehicles.flatMap((vehicle) => vehicle.engineSizeLiters == null ? [] : [vehicle.engineSizeLiters])])].sort((a, b) => a - b);
  const matchingMappings = interchangeService.findInterchangeForVehicle(searchMake, searchModel, searchYear, catalogue, engine === 'any' ? undefined : Number(engine)).filter((mapping) => matchesComponentQuery(mapping, searchTerm) && matchesPartIdentifier(mapping, identifier));
  const target = `${searchYear} ${searchMake} ${searchModel}${engine === 'any' ? '' : ` ${engine}L`}${identifier.trim() ? ` · ${identifier.trim()}` : ''}`.trim();
  const query = encodeURIComponent(`${target} ${searchTerm.trim() || 'parts'} interchange compatible years models OEM part number`);
  const years = [...new Set([initialYear, ...yardVehicles.map((vehicle) => vehicle.year), ...Array.from({ length: new Date().getFullYear() + 2 - 1950 }, (_, index) => new Date().getFullYear() + 1 - index)])].sort((a, b) => b - a);
  const hasTarget = !!searchMake && !!searchModel;
  const showEngines = !searchTerm.trim() || /^engine$/i.test(searchTerm.trim());

  return <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[92dvh] max-w-5xl overflow-y-auto rounded-2xl border-teal-900 bg-slate-950 p-4 font-sans text-white sm:p-6">
      <DialogHeader className="border-b border-slate-700 pb-4">
        <div className="flex items-center gap-3"><span className="rounded-xl border border-emerald-700 bg-emerald-950 p-3 text-emerald-300"><Layers3 className="h-6 w-6" /></span><div><DialogTitle className="text-xl font-extrabold sm:text-2xl">All-parts compatibility lookup</DialogTitle><DialogDescription className="mt-1 text-sm text-slate-200">Engines, driveline, electrical, wheels and research for any part. Compare source-listed applications and possible yard donors—not guaranteed fitment.</DialogDescription></div></div>
      </DialogHeader>
      <div className="space-y-6">
        <section className="space-y-4 rounded-2xl border border-emerald-900 bg-slate-900 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-bold"><Car className="h-5 w-5 text-teal-300" />1. Choose your vehicle</h2>
          <div className="space-y-2"><label htmlFor="interchange-yard-vehicle" className="text-xs font-semibold text-slate-200">Start with a vehicle already on your yard</label><Select value="choose" onValueChange={(id) => { const vehicle = yardVehicles.find((item) => item.id === id); if (vehicle) { setSearchMake(vehicle.make); setSearchModel(vehicle.model); setSearchYear(vehicle.year); } }}><SelectTrigger id="interchange-yard-vehicle" className="h-12 rounded-xl border-slate-600 bg-slate-950 text-white"><SelectValue /></SelectTrigger><SelectContent className="max-h-64 rounded-xl border-slate-600 bg-slate-900 text-white"><SelectItem value="choose">Choose a yard vehicle, or use year / make / model below</SelectItem>{yardVehicles.map((vehicle) => <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.engineSizeLiters ? `${vehicle.engineSizeLiters}L` : 'Engine unknown'} · {vehicle.section}{vehicle.rowNumber ? ` / row ${vehicle.rowNumber}` : ''}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-3 sm:grid-cols-[130px_1fr_1fr]">
            <div className="space-y-2"><label htmlFor="interchange-year" className="text-xs font-semibold text-slate-200">Year</label><Select value={String(searchYear)} onValueChange={(value) => { setSearchYear(Number(value)); setSearchModel(''); }}><SelectTrigger id="interchange-year" className="h-12 rounded-xl border-slate-600 bg-slate-950 text-white"><SelectValue /></SelectTrigger><SelectContent className="max-h-64 rounded-xl border-slate-600 bg-slate-900 text-white">{years.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent></Select></div>
            <InterchangeVehiclePicker label="Make" value={searchMake} options={makeNames} loading={makes.isFetching} onChange={(make) => { setSearchMake(make); setSearchModel(''); }} />
            <InterchangeVehiclePicker label="Model" value={searchModel} options={modelNames} disabled={!searchMake} loading={models.isFetching} onChange={setSearchModel} />
          </div>
          <p className="text-xs leading-relaxed text-slate-200">Vehicle dropdowns: NHTSA vPIC online data plus vehicles already recorded here. {searchYear <= 1995 ? 'NHTSA does not offer year-filtered model lists for this year; check the model year yourself.' : 'Models are filtered by the selected year when NHTSA supports the make.'} Vehicle names alone do not establish parts fitment.</p>
          {(makes.isError || models.isError) && <div role="alert" className="rounded-xl border border-amber-700 bg-amber-950 p-3 text-sm text-amber-100">Online options could not load. Existing yard selections remain available; there may be more models online. <Button onClick={() => { if (makes.isError) void makes.refetch(); if (models.isError) void models.refetch(); }} className="ml-2 h-8 rounded-lg bg-emerald-700 text-xs text-white">Retry online options</Button></div>}
          {inventory.isError && <div role="alert" className="rounded-xl border border-amber-700 bg-amber-950 p-3 text-sm text-amber-100">Yard stock could not load. Availability is unknown, not out of stock. <Button onClick={() => void inventory.refetch()} className="ml-2 h-8 rounded-lg bg-emerald-700 text-xs text-white">Retry yard stock</Button></div>}
          <div className="space-y-2"><label htmlFor="interchange-component" className="text-sm font-semibold">2. Which part do you need?</label><div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-300" /><Input id="interchange-component" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Any part: engine, radiator, bumper, headlight, door handle…" className="h-12 rounded-xl border-slate-600 bg-slate-950 pl-10 text-white" /></div><div className="flex flex-wrap gap-2">{['All parts', 'Engine', 'Transmission', 'Alternator', 'Starter', 'Wheels', 'Body', 'Lights', 'Brakes', 'Cooling', 'Interior', 'Door', 'Headlight', 'Radiator'].map((part) => <Button key={part} aria-pressed={searchTerm === (part === 'All parts' ? '' : part)} onClick={() => setSearchTerm(part === 'All parts' ? '' : part)} className={`h-8 rounded-full px-3 text-xs ${searchTerm === (part === 'All parts' ? '' : part) ? 'bg-teal-700 text-white' : 'bg-slate-800 text-slate-100'}`}>{part}</Button>)}</div><p className="text-xs text-slate-200">Source catalogs now include selected body components, headlights, brake pad/rotor kits, radiators and interior handles/bezels alongside engines and electrical parts. Complete doors, sheet-metal panels, seats, airbags and every other component are not comprehensively covered. Wheels use a separate dataset.</p></div>
        </section>
        <section className="space-y-3 rounded-2xl border border-teal-800 bg-teal-950 p-4">
          <h3 className="font-bold">Source-backed component catalogs · coverage is still growing</h3>
          <p className="text-sm text-teal-100">{catalogLoading ? `Reading public application tables; ${catalogue.length} listings loaded so far. Catalogs load independently; the first lookup may take up to two minutes…` : `${catalogue.length} replacement-part listings loaded. Unverified listings are included, not hidden.`} Vehicle selection covers 1950 to today, but imported fitment is selected applications—not all parts for every make and year.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{['Engine', 'Transmission', 'Starter', 'Alternator', 'Body', 'Lights', 'Brakes', 'Cooling', 'Interior'].map((part) => <button type="button" key={part} onClick={() => setSearchTerm(part)} aria-pressed={searchTerm === part} className={`rounded-xl border p-3 text-left transition-colors ${searchTerm === part ? 'border-teal-300 bg-teal-700' : 'border-teal-700 bg-teal-900 hover:bg-teal-800'}`}><p className="text-xs text-teal-100">{part === 'Body' ? 'Body parts' : part}</p><p className="text-lg font-bold text-white">{catalogue.filter((item) => item.partName === part || item.partCategory === part).length}<span className="ml-1 text-xs font-normal">listings</span></p></button>)}</div>
          {catalogIncomplete && <Button onClick={() => { void publicCatalog.refetch(); void components.refetch(); void additionalComponents.refetch(); }} className="rounded-xl bg-teal-700 text-white hover:bg-teal-600">Retry catalog lookup</Button>}
          {catalogError && <p role="alert" className="text-sm text-amber-100">One or more catalogs could not load. Loaded records from other sources remain visible. No matches does not establish that nothing fits.</p>}
          {!!catalogSources.length && <details className="text-xs text-teal-100"><summary className="cursor-pointer font-semibold">Source coverage and refresh status</summary><ul className="mt-3 space-y-2">{catalogSources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{source.name}</a> · {source.state} · {source.applications} application rows{source.fetchedAt ? ` · ${new Date(source.fetchedAt).toLocaleDateString()}` : ''}</li>)}</ul><p className="mt-3">Only explicit readable application rows are imported. Public pages are not open-licensed bulk catalogs and may have additional interactive or paginated data. Compare source restrictions and specifications; contradictions are not resolved automatically.</p></details>}
          <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><label htmlFor="interchange-engine" className="text-sm font-semibold">Customer's engine displacement</label><Select value={engine} onValueChange={setEngine}><SelectTrigger id="interchange-engine" className="h-11 rounded-xl border-teal-700 bg-slate-950 text-white"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl border-teal-700 bg-slate-900 text-white"><SelectItem value="any">Unknown / show all candidates</SelectItem>{engineOptions.map((value) => <SelectItem key={value} value={String(value)}>{value}L — source or yard record</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><label htmlFor="interchange-identifier" className="text-sm font-semibold">Engine code, casting or OE / part number</label><Input id="interchange-identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} maxLength={100} placeholder="Optional: LM7, K24Z7, 3L3E-EA, OE number…" className="h-11 rounded-xl border-teal-700 bg-slate-950 text-white" /></div></div>
          <p className="text-xs text-teal-100">Identifiers narrow source text; they do not certify fitment. Known different donor displacement, cylinders, fuel or recognized source engine code are excluded. Missing data stays unverified; VIN, generation, controls and mechanical configuration still need checking.</p>
          {!!targetYardVehicles.length && <p className="text-xs text-teal-100">Recorded yard engine identification: {uniqueNames(targetYardVehicles.map((vehicle) => vehicle.engineModel || 'Not recorded')).join(' · ')}</p>}
        </section>
        {hasTarget ? <>
          {showEngines && <EngineCompatibilityPanel key={`${searchMake}-${searchModel}-${searchYear}`} make={searchMake} model={searchModel} year={searchYear} target={target} />}
          {(!searchTerm.trim() || /wheel|rim/i.test(searchTerm)) && <WheelFitmentPanel key={`${searchMake}-${searchModel}-${searchYear}`} make={searchMake} model={searchModel} year={searchYear} yardVehicles={yardVehicles} inventoryKnown={inventory.isSuccess} />}
          <InterchangeResults key={`${target}-${searchTerm}`} mappings={matchingMappings} yardVehicles={yardVehicles} inventoryKnown={inventory.isSuccess} target={target} loading={catalogLoading} catalogIncomplete={catalogIncomplete} />
          <section className="space-y-3 rounded-2xl border border-teal-800 bg-teal-950 p-4 sm:p-5"><h3 className="flex items-center gap-2 font-bold"><ExternalLink className="h-5 w-5 text-teal-200" />Research any part online</h3><p className="text-sm text-teal-100">Search for {target}{searchTerm ? ` · ${searchTerm}` : ''}. These are external research, not imported or confirmed compatibility. Compare OE numbers, engine/transmission identifiers and every restriction.</p><div className="flex flex-wrap gap-3"><a href={`https://www.google.com/search?q=${query}`} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-600">Search cross-model interchange ↗</a><a href={`https://www.google.com/search?q=${encodeURIComponent(`site:powertrainproducts.net ${target} ${searchTerm.trim() || 'engine transmission'} vehicle fitment`)}`} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-teal-600 bg-teal-900 px-4 py-3 text-sm font-semibold text-white">Engine / transmission applications ↗</a><a href={`https://www.google.com/search?q=${encodeURIComponent(`${target} ${searchTerm.trim() || 'parts'} manufacturer application catalog OEM cross reference`)}`} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-teal-600 bg-teal-900 px-4 py-3 text-sm font-semibold text-white">Find part-specific catalogs ↗</a><a href="https://www.car-part.com/" target="_blank" rel="noopener noreferrer" className="rounded-xl border border-teal-600 bg-teal-900 px-4 py-3 text-sm font-semibold text-white">Recycler interchange search ↗</a></div><p className="text-xs text-teal-100">No equivalents are invented from vehicle names, shared displacement or a chain of cross-reference numbers. Recycler results do not establish stock on this yard.</p></section>
        </> : <p className="rounded-xl border border-slate-700 p-5 text-sm text-slate-200">Choose a make and model to view compatibility and online research options.</p>}
      </div>
    </DialogContent>
  </Dialog>;
};
