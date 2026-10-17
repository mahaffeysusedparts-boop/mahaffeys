import { ArrowDownUp, CheckCircle2, Layers, LockKeyhole, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WeighingType } from '@/types/scrapBuying';
import type { ScaleConfig } from '@/types/scrap';

const choices = [
  { type: 'PLATFORM' as const, title: 'Small Load / Platform', Icon: PackageCheck, description: 'Weigh each material batch directly, with optional container tare. Add repeated weights and different grades to this ticket.' },
  { type: 'VEHICLE_IN_OUT' as const, title: 'Single Load / Truck IN–OUT', Icon: ArrowDownUp, description: 'Pair loaded IN and empty OUT for each load. “Single Load” means whole-vehicle weighing, not a one-load limit.' },
  { type: 'SPLIT_GROUPS' as const, title: 'Split Weight / Axle Groups', Icon: Layers, description: 'Sum separate, non-overlapping vehicle groups in loaded and tare passes. Never a percentage split among material grades.' },
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
      <div className="grid gap-3 md:grid-cols-3">
        {choices.map(({ type, title, Icon, description }) => {
          const split = type === 'SPLIT_GROUPS';
          const compatible = supported.includes(type);
          const selected = value === type;
          return (
            <Button key={type} type="button" variant="outline" aria-pressed={selected}
              disabled={split || !compatible || (locked && !selected)} onClick={() => onSelect(type)}
              className={`h-auto min-h-44 flex-col items-start justify-start whitespace-normal rounded-2xl border-2 p-4 text-left disabled:opacity-70 ${selected ? 'border-emerald-500 bg-emerald-950 text-white hover:bg-emerald-900' : 'border-slate-700 bg-slate-950 text-slate-100 hover:border-emerald-600 hover:bg-slate-800'}`}>
              <div className="mb-3 flex w-full items-center justify-between"><Icon className={`h-6 w-6 ${selected ? 'text-emerald-300' : 'text-teal-300'}`} />{selected && <CheckCircle2 className="h-5 w-5 text-emerald-300" />}{split && <LockKeyhole className="h-4 w-4 text-amber-300" />}</div>
              <span className="text-sm font-bold">{title}</span>
              <span className="mt-2 text-xs font-normal leading-relaxed text-slate-300">{description}</span>
              <span className={`mt-3 text-xs font-semibold ${split || !compatible ? 'text-amber-300' : 'text-emerald-300'}`}>{split ? 'Commercial completion disabled · staged release' : compatible ? scale ? 'Compatible with configured scale' : 'Manual entry available' : 'Select a compatible scale'}</span>
            </Button>
          );
        })}
      </div>
      <p className="text-xs leading-relaxed text-amber-200">{locked ? 'Finish or explicitly cancel the current weighing before changing modes.' : 'Select a mode before capture. Saving one weight never completes the seller’s ticket.'} Split weighing requires a documented approved setup and the canonical capture workflow before commercial use; configuration is not regulatory certification.</p>
    </section>
  );
}
