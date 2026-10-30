import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowRight } from 'lucide-react';

export interface IntakeIssue { target: string; message: string; beforeCompletion?: boolean }
export function goToIntakeField(target: string) {
  const element = document.getElementById(target);
  if (!element) return;
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const input = element.matches('input,textarea,button,select') ? element
    : element.querySelector<HTMLElement>('[aria-invalid="true"]:not(:disabled)')
      ?? element.querySelector<HTMLElement>('input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')
      ?? element.querySelector<HTMLElement>('button:not(:disabled)');
  (input as HTMLElement | null)?.focus({ preventScroll: true });
}
export function IntakeFieldGuidance({ issues }: { issues: IntakeIssue[] }) {
  if (!issues.length) return null;
  return <section aria-label="Missing intake requirements" className="space-y-2 rounded-2xl border border-amber-700 bg-amber-950 p-4 text-amber-100"><h3 className="flex items-center gap-2 text-sm font-bold"><AlertTriangle className="h-4 w-4"/>Missing requirements</h3>{issues.map(issue => <div key={`${issue.target}:${issue.message}`} className="flex items-center justify-between gap-3 text-xs"><span>{issue.message}{issue.beforeCompletion ? ' — required before completion; draft can still be saved.' : ''}</span><Button type="button" variant="ghost" onClick={() => goToIntakeField(issue.target)} className="h-auto shrink-0 rounded-lg px-2 py-2 text-amber-100 hover:bg-amber-900 hover:text-white">Take me there<ArrowRight className="ml-1 h-3 w-3"/></Button></div>)}</section>;
}
export function IntakeFieldError({ message }: { message?: string }) {
  return message ? <p role="status" className="mt-1 text-xs font-medium text-amber-200">{message}</p> : null;
}
