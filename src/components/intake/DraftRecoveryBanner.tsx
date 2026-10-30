import { Button } from '@/components/ui/button';
import { History, Save } from 'lucide-react';
import type { useIntakeDraft } from '@/hooks/useIntakeDraft';

export function DraftRecoveryBanner({ draft }: { draft: ReturnType<typeof useIntakeDraft> }) {
  if (draft.loading) return <p role="status" className="rounded-xl bg-sky-950 p-3 text-sm text-sky-100">Checking this workstation for an unfinished draft…</p>;
  if (draft.recovery) return <section role="status" className="flex flex-col gap-3 rounded-2xl border border-amber-600 bg-amber-950 p-4 text-amber-100 sm:flex-row sm:items-center sm:justify-between">
    <div><p className="flex items-center gap-2 font-bold"><History className="h-5 w-5"/>Unfinished intake found</p><p className="mt-1 text-xs">Saved {new Date(draft.recovery.savedAt).toLocaleString()} on this workstation. Resume it or discard it before entering a new intake.</p></div>
    <div className="flex shrink-0 gap-2"><Button onClick={draft.resume} className="rounded-xl bg-amber-700 text-white hover:bg-amber-600">Resume draft</Button><Button onClick={() => void draft.discard()} variant="outline" className="rounded-xl border-amber-600 bg-amber-950 text-amber-100 hover:bg-amber-900">Discard draft</Button></div>
  </section>;
  return <div role="status" className={`flex items-center gap-2 rounded-xl border p-3 text-xs ${draft.error ? 'border-rose-600 bg-rose-950 text-rose-100' : 'border-sky-800 bg-sky-950 text-sky-100'}`}><Save className="h-4 w-4 shrink-0"/>{draft.error || (draft.savedAt ? `Draft autosaved at ${new Date(draft.savedAt).toLocaleTimeString()}. Recoverable on this workstation; not a submitted ticket.` : 'Drafts autosave on this workstation as you enter intake details.')}</div>;
}
