import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { interchangeService } from '@/services/interchangeService';
import { vehicleOptionsService } from '@/services/vehicleOptionsService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Car, ExternalLink, Layers3, Search } from 'lucide-react';
import { InterchangeVehiclePicker } from './InterchangeVehiclePicker';
import { InterchangeResults } from './InterchangeResults';
import { WheelFitmentPanel } from './WheelFitmentPanel';

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
  const [searchTerm, setSearchTerm] = useState('Alternator');
  const [engine, setEngine] = useState('any');
  useEffect(() => {
    if (!isOpen) return;
    setSearchMake(initialMake); setSearchModel(initialModel); setSearchYear(initialYear); setSearchTerm('Alternator');
  }, [isOpen, initialMake, initialModel, initialYear]);
  useEffect(() => { setEngine('any'); }, [searchMake, searchModel, searchYear]);

  const publicCatalog = useQuery({ queryKey: ['public-parts-catalog'], queryFn: ({ signal }) => interchangeService.publicCatalog(signal), enabled: isOpen, staleTime: 300000, retry: 1 });
  const inventory = useQuery({ queryKey: ['interchange-yard-inventory', isOpen], queryFn: vehicleOptionsService.yardVehicles, enabled: isOpen, staleTime: 0, retry: 1 });
  const yardVehicles = inventory.data ?? [];
  const makes = useQuery({ queryKey: ['vehicle-options', 'makes'], queryFn: vehicleOptionsService.makes, enabled: isOpen, staleTime: 86400000, retry: 1 });
  const makeId = makes.data?.options.find((option) => option.name.toLowerCase() === searchMake.toLowerCase())?.id;
  const models = useQuery({ queryKey: ['vehicle-options', 'models', makeId, searchYear], queryFn: () => vehicleOptionsService.models(makeId!, searchYear), enabled: isOpen && !!makeId, staleTime: 86400000, retry: 1 });
  const catalogue = publicCatalog.data?.mappings ?? interchangeService.getInterchangeMappings();
  const makeNames = uniqueNames([...makes.data?.options.map((item) => item.name) ?? [], ...yardVehicles.map((vehicle) => vehicle.make), ...catalogue.flatMap((item) => item.compatibleModels.map((model) => model.make)), searchMake]).sort((a, b) => {
    const rank = (value: string) => { const index = commonMakes.indexOf(value.toLowerCase()); return index < 0 ? commonMakes.length : index; };
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  const modelNames = uniqueNames([...models.data?.options.map((item) => item.name) ?? [], ...yardVehicles.filter((vehicle) => vehicle.make.toLowerCase() === searchMake.toLowerCase() && vehicle.year === searchYear).map((vehicle) => vehicle.model), ...catalogue.flatMap((item) => item.compatibleModels.filter((model) => model.make.toLowerCase() === searchMake.toLowerCase() && searchYear >= model.startYear && searchYear <= model.endYear).map((model) => model.model)), searchModel]).sort((a, b) => a.localeCompare(b));
  const vehicleMappings = interchangeService.findInterchangeForVehicle(searchMake, searchModel, searchYear, catalogue);
  const engineOptions = [...new Set(vehicleMappings.flatMap((mapping) => mapping.compatibleModels.filter((row) => row.make.toLowerCase() === searchMake.toLowerCase() && row.model.toLowerCase().replace(/[\s-]+/g, '') === searchModel.toLowerCase().replace(/[\s-]+/g, '') && row.startYear <= searchYear && row.endYear >= searchYear && row.engineLiters != null).map((row) => row.engineLiters!)))].sort((a, b) => a - b);
  const matchingMappings = interchangeService.findInterchangeForVehicle(searchMake, searchModel, searchYear, catalogue, engine === 'any' ? undefined : Number(engine)).filter((mapping) => !searchTerm.trim() || `${mapping.partName} ${mapping.partCategory} ${mapping.interchangeCode} ${mapping.references?.join(' ') ?? ''}`.toLowerCase().includes(searchTerm.trim().toLowerCase()));
  const target = `${searchYear} ${searchMake} ${searchModel}${engine === 'any' ? '' : ` ${engine}L`}`.trim();
  const query = encodeURIComponent(`${target} ${searchTerm.trim() || 'parts'} interchange compatible years models OEM part number`);
  const years = [...new Set([initialYear, ...Array.from({ length: new Date().getFullYear() + 2 - 1960 }, (_, index) => new Date().getFullYear() + 1 - index)])].sort((a, b) => b - a);
  const hasTarget = !!searchMake && !!searchModel;

  return <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[92dvh] max-w-5xl overflow-y-auto rounded-2xl border-teal-900 bg-slate-950 p-4 font-sans text-white sm:p-6">
      <DialogHeader className="border-b border-slate-700 pb-4">
        <div className="flex items-center gap-3"><span className="rounded-xl border border-emerald-700 bg-emerald-950 p-3 text-emerald-300"><Layers3 className="h-6 w-6" /></span><div><DialogTitle className="text-xl font-extrabold sm:text-2xl">Find compatible parts</DialogTitle><DialogDescription className="mt-1 text-sm text-slate-200">Choose a vehicle, then a component. See known compatible models anywhere—not just cars on our lot.</DialogDescription></div></div>
      </DialogHeader>
      <div className="space-y-6">
        <section className="space-y-4 rounded-2xl border border-emerald-900 bg-slate-900 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-bold"><Car className="h-5 w-5 text-teal-300" />1. Choose your vehicle</h2>
          <div className="grid gap-3 sm:grid-cols-[130px_1fr_1fr]">
            <div className="space-y-2"><label htmlFor="interchange-year" className="text-xs font-semibold text-slate-200">Year</label><Select value={String(searchYear)} onValueChange={(value) => { setSearchYear(Number(value)); setSearchModel(''); }}><SelectTrigger id="interchange-year" className="h-12 rounded-xl border-slate-600 bg-slate-950 text-white"><SelectValue /></SelectTrigger><SelectContent className="max-h-64 rounded-xl border-slate-600 bg-slate-900 text-white">{years.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent></Select></div>
            <InterchangeVehiclePicker label="Make" value={searchMake} options={makeNames} loading={makes.isFetching} onChange={(make) => { setSearchMake(make); setSearchModel(''); }} />
            <InterchangeVehiclePicker label="Model" value={searchModel} options={modelNames} disabled={!searchMake} loading={models.isFetching} onChange={setSearchModel} />
          </div>
          <p className="text-xs leading-relaxed text-slate-200">Vehicle dropdowns: NHTSA vPIC online data plus vehicles already recorded here. {searchYear <= 1995 ? 'NHTSA does not offer year-filtered model lists for this year; check the model year yourself.' : 'Models are filtered by the selected year when NHTSA supports the make.'} Vehicle names alone do not establish parts fitment.</p>
          {(makes.isError || models.isError) && <div role="alert" className="rounded-xl border border-amber-700 bg-amber-950 p-3 text-sm text-amber-100">Online options could not load. Existing yard selections remain available; there may be more models online. <Button onClick={() => { if (makes.isError) void makes.refetch(); if (models.isError) void models.refetch(); }} className="ml-2 h-8 rounded-lg bg-emerald-700 text-xs text-white">Retry online options</Button></div>}
          {inventory.isError && <div role="alert" className="rounded-xl border border-amber-700 bg-amber-950 p-3 text-sm text-amber-100">Yard stock could not load. Availability is unknown, not out of stock. <Button onClick={() => void inventory.refetch()} className="ml-2 h-8 rounded-lg bg-emerald-700 text-xs text-white">Retry yard stock</Button></div>}
          <div className="space-y-2"><label htmlFor="interchange-component" className="text-sm font-semibold">2. Which part do you need?</label><div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-300" /><Input id="interchange-component" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Part name or interchange number…" className="h-12 rounded-xl border-slate-600 bg-slate-950 pl-10 text-white" /></div><div className="flex flex-wrap gap-2">{['All parts', 'Wheels', 'Engine', 'Transmission', 'Alternator', 'Starter', 'Door'].map((part) => <Button key={part} aria-pressed={searchTerm === (part === 'All parts' ? '' : part)} onClick={() => setSearchTerm(part === 'All parts' ? '' : part)} className={`h-8 rounded-full px-3 text-xs ${searchTerm === (part === 'All parts' ? '' : part) ? 'bg-teal-700 text-white' : 'bg-slate-800 text-slate-100'}`}>{part}</Button>)}</div></div>
        </section>
        <section className="space-y-3 rounded-2xl border border-teal-800 bg-teal-950 p-4">
          <h3 className="font-bold">Free online alternator listings</h3>
          <p className="text-sm text-teal-100">{publicCatalog.isPending ? 'Reading public application tables. The first load may take up to a minute…' : `${catalogue.length} replacement-part listings loaded. Unverified listings are included, not hidden.`} Coverage is selected truck catalogs, not every vehicle or every free website.</p>
          {(publicCatalog.isError || publicCatalog.data?.sources.some((source) => source.state !== 'loaded')) && <Button onClick={() => void publicCatalog.refetch()} className="rounded-xl bg-teal-700 text-white">Retry catalog lookup</Button>}
          {publicCatalog.isError && <p role="alert" className="text-sm text-amber-100">Catalog unavailable. No matches must not be treated as a confirmed lack of compatible parts.</p>}
          {publicCatalog.data && <details className="text-xs text-teal-100"><summary className="cursor-pointer font-semibold">Source coverage and refresh status</summary><ul className="mt-3 space-y-2">{publicCatalog.data.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{source.name}</a> · {source.state} · {source.applications} application rows{source.fetchedAt ? ` · ${new Date(source.fetchedAt).toLocaleDateString()}` : ''}</li>)}</ul><p className="mt-3">Only application rows readable in the public page are imported. Source pages may have additional interactive or paginated data. Listings can contradict their own specifications; compare both, and verify physically before pulling.</p></details>}
          <div className="space-y-2"><label htmlFor="interchange-engine" className="text-sm font-semibold">Customer's engine</label><Select value={engine} onValueChange={setEngine}><SelectTrigger id="interchange-engine" className="h-11 rounded-xl border-teal-700 bg-slate-950 text-white"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl border-teal-700 bg-slate-900 text-white"><SelectItem value="any">Unknown / show all engine candidates</SelectItem>{engineOptions.map((value) => <SelectItem key={value} value={String(value)}>{value}L — source-listed</SelectItem>)}</SelectContent></Select><p className="text-xs text-teal-100">Engine size narrows the candidate listings; trim, fuel, connector and alternator specifications still need checking. Yard vehicles with a recorded different engine are excluded.</p></div>
        </section>
        {hasTarget ? <>
          {(!searchTerm.trim() || /wheel|rim/i.test(searchTerm)) && <WheelFitmentPanel key={`${searchMake}-${searchModel}-${searchYear}`} make={searchMake} model={searchModel} year={searchYear} yardVehicles={yardVehicles} inventoryKnown={inventory.isSuccess} />}
          <InterchangeResults key={`${target}-${searchTerm}`} mappings={matchingMappings} yardVehicles={yardVehicles} inventoryKnown={inventory.isSuccess} target={target} loading={publicCatalog.isPending} catalogIncomplete={publicCatalog.isError || publicCatalog.data?.sources.some((source) => source.state !== 'loaded')} />
          <section className="space-y-3 rounded-2xl border border-teal-800 bg-teal-950 p-4 sm:p-5"><h3 className="flex items-center gap-2 font-bold"><ExternalLink className="h-5 w-5 text-teal-200" />Research additional fitment online</h3><p className="text-sm text-teal-100">Search for {target}{searchTerm ? ` · ${searchTerm}` : ''}. These links open additional external research, not imported or confirmed compatibility. Compare OEM numbers and restrictions.</p><div className="flex flex-wrap gap-3"><a href={`https://www.google.com/search?q=${query}`} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-600">Search cross-model interchange ↗</a><a href={`https://www.google.com/search?q=${encodeURIComponent(`site:dbelectrical.com ${target} ${searchTerm.trim() || 'alternator'} applications`)}`} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-teal-600 bg-teal-900 px-4 py-3 text-sm font-semibold text-white">Find more public application tables ↗</a><a href="https://as-pl.com/en/brand" target="_blank" rel="noopener noreferrer" className="rounded-xl border border-teal-600 bg-teal-900 px-4 py-3 text-sm font-semibold text-white">AS-PL vehicle / OE lookup ↗</a><a href="https://www.car-part.com/" target="_blank" rel="noopener noreferrer" className="rounded-xl border border-teal-600 bg-teal-900 px-4 py-3 text-sm font-semibold text-white">Recycler interchange search ↗</a></div><p className="text-xs text-teal-100">No equivalents are invented from vehicle names, a shared engine or a chain of cross-reference numbers.</p></section>
        </> : <p className="rounded-xl border border-slate-700 p-5 text-sm text-slate-200">Choose a make and model to view compatibility and online research options.</p>}
      </div>
    </DialogContent>
  </Dialog>;
};
