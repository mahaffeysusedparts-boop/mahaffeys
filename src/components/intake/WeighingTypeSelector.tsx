import { ArrowDownUp, CheckCircle2, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WeighingType } from '@/types/scrapBuying';
import type { ScaleConfig } from '@/types/scrap';

const choices = [
  { type: 'PLATFORM' as const, title: 'Small Load / Platform', Icon: PackageCheck, description: 'Weigh material directly. Subtract container tare if needed.' },
  { type: 'VEHICLE_IN_OUT' as const, title: 'Single Load / Truck IN–OUT', Icon: ArrowDownUp, description: 'Weigh the loaded truck IN, unload, then weigh it OUT.' },
];

export function WeighingTypeSelector({ value, scale, locked, onSelect }: {
  value: WeighingType | null;
  scale: ScaleConfig | null;
  locked: boolean;
  onSelect: (type: WeighingType) => void;
}) {
  const supported = scale?.supportedWeighingTypes ?? (scale ? [scale.weighingMode === 'SINGLE_WEIGHT' ? 'PLATFORM' : 'VEHICLE_IN_OUT'] : ['PLATFORM', 'VEHICLE_IN_OUT']);
  return (
    <section aria-label="Weighing type" className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-white">Choose weighing type</h2>
        <span className="text-xs text-slate-300">{scale?.name ?? 'No connected scale selected · manual entry'}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {choices.map(({ type, title, Icon, description }) => {
          const compatible = supported.includes(type);
          const selected = value === type;
          return (
            <Button key={type} type="button" variant="outline" aria-pressed={selected}
              disabled={!compatible || (locked && !selected)} onClick={() => onSelect(type)}
              className={`h-auto min-h-28 flex-col items-start justify-start whitespace-normal rounded-2xl border-2 p-4 text-left disabled:opacity-70 ${selected ? 'border-emerald-500 bg-emerald-950 text-white hover:bg-emerald-900' : 'border-slate-700 bg-slate-950 text-slate-100 hover:border-emerald-600 hover:bg-slate-800'}`}>
              <span className="flex w-full items-center gap-2"><Icon className="h-5 w-5 text-teal-300"/><span className="text-sm font-bold">{title}</span>{selected && <CheckCircle2 className="ml-auto h-5 w-5 text-emerald-300"/>}</span>
              <span className="mt-2 text-xs font-normal leading-relaxed text-slate-200">{description}</span>
              {!compatible && <span className="mt-2 text-xs text-amber-200">Select a compatible scale</span>}
            </Button>
          );
        })}
      </div>
      {locked && <p className="text-xs text-amber-200">Finish or cancel the current weighing before changing types.</p>}
      {value === 'SPLIT_GROUPS' && <p role="alert" className="text-sm text-amber-200">This ticket uses split weighing, which is not available for payment. Select a supported weighing type before continuing.</p>}
    </section>
  );
}
