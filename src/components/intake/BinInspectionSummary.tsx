import type { BinReview } from '@/types/binDeductions';
import { ClipboardCheck, AlertTriangle } from 'lucide-react';
export function BinReviewEvidence({ review }: { review: BinReview }) {
  return <div className="space-y-1" data-testid="bin-review-evidence">
    {review.items.length ? review.items.map(item => <p key={item.itemId}>{item.name}: {item.quantity} × {item.poundsPerUnit} lb = {(item.quantity * item.poundsPerUnit).toLocaleString()} lb</p>) : <p>No deduction items found</p>}
    <p className="font-bold">Item deduction total: {review.totalLbs.toLocaleString()} lb</p>
    <p className="text-xs">{review.employeeName} · {new Date(review.submittedAt).toLocaleString()} · Review v{review.revision} · Catalog v{review.catalogRevision}</p>
  </div>;
}
export function BinInspectionSummary({ review, unconfirmed, acknowledge, onAcknowledge }: { review?: BinReview | null; unconfirmed: boolean; acknowledge: boolean; onAcknowledge: (value: boolean) => void }) {
  const confirmed = !!review && !unconfirmed;
  return <section className="rounded-2xl border border-teal-700 bg-teal-950 p-4 text-teal-50" aria-label="Bin Review">
    <h3 className="mb-2 flex items-center gap-2 font-bold"><ClipboardCheck className="h-5 w-5" />Bin Review</h3>
    {confirmed ? <><p className="mb-2 font-semibold text-teal-200">Saved on server</p><BinReviewEvidence review={review} /></> : <>
      <p role="alert" className="flex gap-2 text-amber-200"><AlertTriangle className="h-5 w-5 shrink-0" />{unconfirmed ? 'Bin review could not be confirmed on server.' : 'Awaiting bin review.'} OUT capture is allowed; no offline draft is synced.</p>
      <label className="mt-3 flex items-start gap-3 text-sm"><input className="mt-1 h-5 w-5 accent-teal-500" type="checkbox" checked={acknowledge} onChange={event => onAcknowledge(event.target.checked)} />I acknowledge no submitted bin review and no bin deduction will be applied if none exists at confirmation.</label>
    </>}
  </section>;
}
