import type { Ticket } from '@/types/scrap';
import type { assessScrapEvidence } from '@/utils/scrapIntakeProgress';
import { intakeAge, queueStage, queueWeighingType } from '@/utils/intakeQueuePresentation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ban, Scale, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';

export function ScaleQueueCard({ ticket, assessment, now, current, handler, actionLabel, disabled, voidDisabled, onContinue, onVoid }: {
  ticket: Ticket; assessment: ReturnType<typeof assessScrapEvidence>; now: number; current: boolean;
  handler: string; actionLabel: string; disabled: boolean; voidDisabled: boolean; onContinue: () => void; onVoid: () => void;
}) {
  const lines = ticket.scrapLines ?? [];
  const materials = [...new Set(lines.map(line => line.metalName))].slice(0, 3);
  return <article aria-label={`Intake ${ticket.id}`} className={`min-w-0 space-y-3 rounded-2xl border p-4 ${current ? 'border-sky-500 bg-sky-950/30 ring-1 ring-sky-700' : 'border-slate-700 bg-slate-950'}`}>
    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words text-base font-extrabold text-white">{ticket.customerName || 'Unnamed load'}</h3><p className={`mt-1 break-words font-mono text-lg font-bold ${ticket.vehicleLicensePlate ? 'text-sky-100' : 'text-amber-200'}`}>{ticket.vehicleLicensePlate || 'Plate not recorded'}</p><p className="mt-1 break-all font-mono text-xs text-slate-300">#{ticket.id}</p></div>{current && <Badge className="shrink-0 rounded-lg border border-sky-500 bg-sky-900 text-sky-100">CURRENT</Badge>}</div>
    <div className="space-y-2"><Badge className="max-w-full whitespace-normal rounded-lg border border-teal-700 bg-teal-950 text-teal-100">{queueStage(ticket)}</Badge><p className="text-xs text-sky-200">{queueWeighingType(ticket)}</p><p className="flex items-center gap-2 text-sm font-bold text-slate-100"><Clock className="h-4 w-4 shrink-0" aria-hidden="true"/>Since intake: {intakeAge(ticket.createdAt, now)}</p>{ticket.scaleGrossInWeight != null && ticket.scaleTareOutWeight == null && <p className="text-xs text-sky-100">Since IN: {intakeAge(ticket.scaleGrossInAt, now)}</p>}</div>
    <div className={`rounded-xl border p-3 text-xs ${assessment.verified ? 'border-emerald-800 bg-emerald-950 text-emerald-100' : 'border-amber-800 bg-amber-950 text-amber-100'}`}>
      <p className="flex items-start gap-2 font-semibold">{assessment.verified ? <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true"/> : <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true"/>}{assessment.summary}</p>
      {assessment.issues.length > 0 && <details className="mt-2"><summary className="cursor-pointer py-1 focus-visible:outline focus-visible:outline-sky-300">Evidence details</summary><ul className="mt-1 list-inside list-disc space-y-1">{assessment.issues.map(issue => <li key={issue.key}>{issue.label} · {issue.required ? 'required before completion' : 'optional'}{issue.unknown ? ' · unverified' : ''}</li>)}</ul></details>}
      {assessment.verified && <p className="mt-1">Evidence only — weighing, review and payment checks remain separate.</p>}
    </div>
    <p className="text-xs font-semibold leading-relaxed text-sky-200">{handler}</p>
    <div className="flex gap-2"><Button disabled={disabled} onClick={onContinue} className="min-h-11 flex-1 whitespace-normal rounded-xl bg-emerald-700 text-xs font-bold text-white hover:bg-emerald-600"><Scale className="mr-2 h-4 w-4 shrink-0" aria-hidden="true"/>{actionLabel}</Button><Button disabled={voidDisabled || disabled} onClick={onVoid} variant="outline" aria-label={`Void intake ${ticket.id}`} title={voidDisabled ? 'Review and claim ownership before voiding' : 'Void this intake'} className="min-h-11 min-w-11 rounded-xl border-slate-700 bg-slate-900 text-slate-200 hover:bg-red-950 hover:text-red-100"><Ban className="h-4 w-4" aria-hidden="true"/></Button></div>
    <div className="space-y-1 border-t border-slate-700 pt-2 text-xs text-slate-300"><p>Created by {ticket.operatorName || 'Operator'}</p>{ticket.customerPhone && <p>Phone: {ticket.customerPhone}</p>}<p>{lines.length} confirmed loads · {lines.reduce((sum, line) => sum + line.billableWeight, 0).toLocaleString()} lb</p>{materials.length > 0 && <p className="break-words">{materials.join(' · ')}</p>}{ticket.notes && <details><summary className="cursor-pointer py-1 focus-visible:outline focus-visible:outline-sky-300">Saved load context</summary><p className="mt-1 break-words">{ticket.notes}</p></details>}</div>
  </article>;
}
