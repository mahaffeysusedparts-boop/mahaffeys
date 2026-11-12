import { Car, ClipboardPlus, Scale, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type IntakeEntry = 'HOME' | 'COLLECT' | 'SCALE' | 'VEHICLE';
export function IntakeModeSelector({ onEntry, queueCount, queueState }: {
  onEntry: (entry: IntakeEntry) => void;
  queueCount?: number;
  queueState: 'loading' | 'confirmed' | 'unverified';
}) {
  const cards = [
    { entry: 'COLLECT' as const, title: 'New scrap load', description: 'Collect seller details and evidence, then hand off to the scale.', Icon: ClipboardPlus, accent: 'border-emerald-700 text-emerald-200', label: 'Seller collection' },
    { entry: 'SCALE' as const, title: 'Open scale queue', description: 'Open or continue a saved load. Opens the queue even when it is empty.', Icon: Scale, accent: 'border-sky-700 text-sky-200', label: queueState === 'loading' ? 'Active loads loading…' : queueState === 'unverified' ? 'Active load count unverified' : `${queueCount ?? 0} active loads · confirmed` },
    { entry: 'VEHICLE' as const, title: 'New vehicle', description: 'Flat-rate vehicle intake with its separate Pending Group workflow.', Icon: Car, accent: 'border-amber-700 text-amber-200', label: 'Vehicle intake · no scale' },
  ];
  return <section className="mx-auto max-w-6xl space-y-6 py-4" aria-label="Intake home">
    <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Yard workstations</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">What are you starting?</h1><p className="mt-3 text-slate-300">Choose a workspace. Recoverable drafts are kept separately when you start something new.</p></div>
    <div className="grid gap-4 md:grid-cols-3">{cards.map(({ entry, title, description, Icon, accent, label }) => <Button key={entry} variant="outline" onClick={() => onEntry(entry)} className={`h-auto min-h-56 w-full flex-col items-start justify-between gap-5 whitespace-normal rounded-2xl border-2 bg-slate-900 p-6 text-left hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-sky-300 ${accent}`}>
      <Icon className="h-9 w-9" aria-hidden="true"/><span className="block"><span className="block text-xl font-extrabold text-white">{title}</span><span className="mt-2 block text-sm font-normal leading-relaxed text-slate-200">{description}</span></span><span className="flex w-full items-center justify-between gap-2 text-xs">{label}<ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true"/></span>
    </Button>)}</div>
  </section>;
}

export function IntakeWorkspaceNavigation({ onEntry, current, disabled }: { onEntry: (entry: IntakeEntry) => void; current: IntakeEntry; disabled: boolean }) {
  return <nav aria-label="Intake workspaces" className="flex flex-wrap gap-2 rounded-2xl border border-slate-700 bg-slate-900 p-3">
    {([['HOME', 'Intake home'], ['COLLECT', 'New scrap load'], ['SCALE', 'Open scale queue'], ['VEHICLE', 'New vehicle']] as const).map(([entry, label]) => <Button key={entry} disabled={disabled} onClick={() => onEntry(entry)} aria-current={current === entry ? 'page' : undefined} variant="outline" className={`min-h-11 rounded-xl border-slate-700 ${current === entry ? 'bg-teal-900 text-teal-100' : 'bg-slate-950 text-slate-100'} hover:bg-slate-800 focus-visible:ring-sky-300`}>{label}</Button>)}
    {disabled && <p role="status" className="w-full text-xs text-amber-200">Resolve recovery, unsaved seller corrections, or the current operation before switching. Drafts remain on this desk.</p>}
  </nav>;
}
