import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export interface IntakeIssue { target: string; message: string; beforeCompletion?: boolean }
export function goToIntakeField(target: string) {
  const element = document.getElementById(target);
  if (!element) { toast.info('This control is unavailable in the current intake stage. Return to the relevant editor first.'); return; }
  const input = element.matches('input,textarea,button,select') ? element
    : element.querySelector<HTMLElement>('[aria-invalid="true"]:not(:disabled)')
      ?? element.querySelector<HTMLElement>('input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')
      ?? element.querySelector<HTMLElement>('button:not(:disabled)');
  let ancestor: HTMLElement | null = input ?? element;
  while (ancestor) {
    if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
    ancestor = ancestor.parentElement;
  }
  (input ?? element).scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  if (!input || input.matches(':disabled,[aria-disabled="true"]')) {
    element.tabIndex = -1;
    element.focus({ preventScroll: true });
    toast.info('Editing this requirement is paused. Resolve recovery, ownership or the current save before continuing.');
    return;
  }
  input.focus({ preventScroll: true });
}
export function IntakeFieldGuidance({ issues, title = 'Missing requirements', description }: { issues: IntakeIssue[]; title?: string; description?: string }) {
  if (!issues.length) return null;
  return <section aria-label="Missing intake requirements" className="space-y-3 rounded-2xl border border-amber-700 bg-amber-950 p-4 text-amber-100">
    <h3 className="flex items-center gap-2 text-base font-bold"><AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true"/>{title}</h3>
    {description && <p className="text-sm leading-relaxed">{description}</p>}
    <ul className="space-y-3">{issues.map(issue => <li key={`${issue.target}:${issue.message}`} className="flex flex-col gap-2 rounded-xl border border-amber-800 p-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm leading-relaxed">{issue.message}{issue.beforeCompletion ? ' — required before payment; you can still save and weigh this load.' : ''}</span>
      <Button type="button" variant="outline" onClick={() => goToIntakeField(issue.target)} className="min-h-11 shrink-0 self-start rounded-xl border-amber-600 bg-amber-900 px-3 text-amber-100 hover:bg-amber-800 hover:text-white">Take me there<ArrowRight className="ml-1 h-4 w-4" aria-hidden="true"/></Button>
    </li>)}</ul>
  </section>;
}
export function IntakeFieldError({ message }: { message?: string }) {
  return message ? <p role="status" className="mt-1 text-xs font-medium text-amber-200">{message}</p> : null;
}
