import { CheckCircle2, Circle, AlertTriangle, HelpCircle, ArrowRight, MinusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { scrapIntakeProgress, type ScrapProgressInput, type StepState } from '@/utils/scrapIntakeProgress';
import { goToIntakeField } from './IntakeFieldGuidance';

const styles: Record<StepState, string> = {
  complete: 'border-emerald-700 bg-emerald-950 text-emerald-100',
  current: 'border-sky-500 bg-sky-950 text-sky-100',
  'needs attention': 'border-amber-700 bg-amber-950 text-amber-100',
  pending: 'border-slate-700 bg-slate-900 text-slate-200',
  'not applicable': 'border-slate-700 bg-slate-900 text-slate-300',
  unverified: 'border-teal-700 bg-teal-950 text-teal-100',
};
export function IntakeProgressStrip({ input }: { input: ScrapProgressInput }) {
  const progress = scrapIntakeProgress(input);
  const target = (value: string) => input.collection && value.startsWith('scale-') ? 'collection-handoff' : value;
  return <section aria-label="Scrap next steps" className="min-w-0 space-y-3 rounded-2xl border border-teal-800 bg-slate-950 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-extrabold text-teal-100">What’s next?</h2><p className="text-xs text-slate-300">{progress.source}</p></div>
    <p className="text-sm leading-relaxed text-sky-100">{progress.nextAction}</p>
    <Button type="button" variant="outline" onClick={() => goToIntakeField(target(progress.nextTarget))} className="min-h-11 whitespace-normal rounded-xl border-sky-700 bg-sky-950 text-sky-100 hover:bg-sky-900">Go to next section <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true"/></Button>
    <details className="rounded-xl border border-slate-700 p-3" open={undefined}>
      <summary className="min-h-8 cursor-pointer text-sm font-semibold text-slate-100 focus-visible:outline focus-visible:outline-sky-300">Workflow steps &amp; states</summary>
      <ol className="mt-3 flex flex-wrap gap-2">{progress.steps.map(step => {
        const Icon = step.state === 'complete' ? CheckCircle2 : step.state === 'needs attention' ? AlertTriangle : step.state === 'unverified' ? HelpCircle : step.state === 'not applicable' ? MinusCircle : Circle;
        return <li key={step.label} className="max-w-full"><button type="button" onClick={() => goToIntakeField(target(step.target))} aria-label={`${step.label}: ${step.state}`} aria-current={step.state === 'current' ? 'step' : undefined} className={`flex min-h-11 max-w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 ${styles[step.state]}`}><Icon className="h-4 w-4 shrink-0" aria-hidden="true"/><span><span className="block font-bold">{step.label}</span><span className="capitalize">{step.state}</span></span></button></li>;
      })}</ol>
    </details>
    {progress.blockers.length > 0 && <details className="rounded-xl border border-amber-800 bg-amber-950 p-3"><summary className="min-h-8 cursor-pointer text-sm font-semibold text-amber-100 focus-visible:outline focus-visible:outline-sky-300">Completion blockers / verification ({progress.blockers.length})</summary><p className="mt-2 text-xs text-amber-100">Evidence gaps do not prevent weighing or an allowed queue handoff. Server checks still apply.</p><ul className="mt-2 space-y-1">{progress.blockers.map((issue, index) => <li key={`${issue.label}-${index}`}><button type="button" onClick={() => goToIntakeField(target(issue.target))} className="min-h-11 text-left text-xs text-amber-100 underline underline-offset-4 focus-visible:outline focus-visible:outline-sky-300">{issue.label}</button></li>)}</ul></details>}
  </section>;
}
