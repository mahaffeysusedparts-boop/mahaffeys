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
  const [searchTerm, setSearchTerm] = useState('');
  useEffect(() => {
    if (!isOpen) return;
    setSearchMake(initialMake); setSearchModel(initialModel); setSearchYear(initialYear); setSearchTerm('');
  }, [isOpen, initialMake, initialModel, initialYear]);

  const inventory = useQuery({ queryKey: ['interchange-yard-inventory', isOpen], queryFn: vehicleOptionsService.yardVehicles, enabled: isOpen, staleTime: 0, retry: 1 });
  const yardVehicles = inventory.data ?? [];
  const makes = useQuery({ queryKey: ['vehicle-options', 'makes'], queryFn: vehicleOptionsService.makes, enabled: isOpen, staleTime: 86400000, retry: 1 });
  const makeId = makes.data?.options.find((option) => option.name.toLowerCase() === searchMake.toLowerCase())?.id;
  const models = useQuery({ queryKey: ['vehicle-options', 'models', makeId, searchYear], queryFn: () => vehicleOptionsService.models(makeId!, searchYear), enabled: isOpen && !!makeId, staleTime: 86400000, retry: 1 });
  const catalogue = interchangeService.getInterchangeMappings();
  const makeNames = uniqueNames([...makes.data?.options.map((item) => item.name) ?? [], ...yardVehicles.map((vehicle) => vehicle.make), ...catalogue.flatMap((item) => item.compatibleModels.map((model) => model.make)), searchMake]).sort((a, b) => {
    const rank = (value: string) => { const index = commonMakes.indexOf(value.toLowerCase()); return index < 0 ? commonMakes.length : index; };
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  const modelNames = uniqueNames([...models.data?.options.map((item) => item.name) ?? [], ...yardVehicles.filter((vehicle) => vehicle.make.toLowerCase() === searchMake.toLowerCase() && vehicle.year === searchYear).map((vehicle) => vehicle.model), ...catalogue.flatMap((item) => item.compatibleModels.filter((model) => model.make.toLowerCase() === searchMake.toLowerCase() && searchYear >= model.startYear && searchYear <= model.endYear).map((model) => model.model)), searchModel]).sort((a, b) => a.localeCompare(b));
  const matchingMappings = interchangeService.findInterchangeForVehicle(searchMake, searchModel, searchYear).filter((mapping) => !searchTerm.trim() || `${mapping.partName} ${mapping.partCategory} ${mapping.interchangeCode}`.toLowerCase().includes(searchTerm.trim().toLowerCase()));
  const target = `${searchYear} ${searchMake} ${searchModel}`.trim();
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
        {hasTarget ? <>
          {(!searchTerm.trim() || /wheel|rim/i.test(searchTerm)) && <WheelFitmentPanel key={`${searchMake}-${searchModel}-${searchYear}`} make={searchMake} model={searchModel} year={searchYear} yardVehicles={yardVehicles} inventoryKnown={inventory.isSuccess} />}
          <InterchangeResults mappings={matchingMappings} yardVehicles={yardVehicles} inventoryKnown={inventory.isSuccess} target={target} />
          <section className="space-y-3 rounded-2xl border border-teal-800 bg-teal-950 p-4 sm:p-5"><h3 className="flex items-center gap-2 font-bold"><ExternalLink className="h-5 w-5 text-teal-200" />Research fitment online</h3><p className="text-sm text-teal-100">Search for {target}{searchTerm ? ` · ${searchTerm}` : ''}. These links open external research—not confirmed compatibility results. Compare OEM/interchange numbers and application notes; matching model names are not enough.</p><div className="flex flex-wrap gap-3"><a href={`https://www.google.com/search?q=${query}`} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-600">Search cross-model interchange ↗</a><a href={`https://www.google.com/search?q=${encodeURIComponent(`site:rockauto.com ${target} ${searchTerm.trim() || 'parts'} OEM part number`)}`} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-teal-600 bg-teal-900 px-4 py-3 text-sm font-semibold text-white">Research catalog part numbers ↗</a><a href="https://www.car-part.com/" target="_blank" rel="noopener noreferrer" className="rounded-xl border border-teal-600 bg-teal-900 px-4 py-3 text-sm font-semibold text-white">Open recycler interchange search ↗</a></div><p className="text-xs text-teal-100">A comprehensive in-app cross-model list still needs a licensed or verified fitment data source. No compatibility is inferred or invented from NHTSA listings.</p></section>
        </> : <p className="rounded-xl border border-slate-700 p-5 text-sm text-slate-200">Choose a make and model to view compatibility and online research options.</p>}
      </div>
    </DialogContent>
  </Dialog>;
};
