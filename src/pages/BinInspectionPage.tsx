import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useBinCatalog, useBinInspection } from '@/hooks/useBinInspection';
import { binInspectionService } from '@/services/binInspectionService';
import { BinReviewEditor } from '@/components/bin-inspection/BinReviewEditor';
export default function BinInspectionPage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string>();
  const queue = useQuery({ queryKey: ['bin-inspections'], queryFn: () => binInspectionService.queue(), refetchInterval: 1000, refetchOnWindowFocus: 'always', refetchOnReconnect: 'always', retry: false });
  const catalog = useBinCatalog();
  const detail = useBinInspection(selected);
  const cycle = detail.data?.cycles[0] ?? queue.data?.cycles.find(cycle => cycle.cycleId === selected);
  return <div className="min-h-screen bg-teal-50 text-slate-900"><Navbar /><main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
    <header className="flex items-center gap-4 rounded-3xl bg-teal-800 p-6 text-white"><ClipboardCheck className="h-12 w-12 shrink-0" /><div><h1 className="text-3xl font-extrabold">Bin Inspection</h1><p className="mt-1 text-teal-100">Select the correct truck cycle. Only submitted server reviews reach the scale desk.</p></div></header>
    {(queue.isError || catalog.isError || detail.isError) && <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">Server data could not be confirmed. Offline drafts are not submitted. <Button variant="outline" onClick={() => { queue.refetch(); catalog.refetch(); if (selected) detail.refetch(); }}>Retry server connection</Button></p>}
    <div className="grid items-start gap-5 lg:grid-cols-[300px_1fr]"><aside className="space-y-3"><h2 className="font-bold text-teal-900">Active truck loads</h2>{queue.isPending && <p>Loading server queue…</p>}{queue.data?.cycles.length === 0 && <p className="rounded-2xl bg-white p-5">No active truck cycles with a saved IN weight.</p>}{queue.data?.cycles.map(cycle => <button key={cycle.cycleId} onClick={() => setSelected(cycle.cycleId)} className={`w-full rounded-2xl border p-4 text-left shadow-sm ${selected === cycle.cycleId ? 'border-teal-700 bg-teal-100' : 'border-teal-200 bg-white'}`}><p className="font-bold">Ticket {cycle.ticketId} · Load {cycle.number}</p><p>{cycle.sellerName}</p><p className="text-sm text-slate-600">Plate {cycle.plate || 'not recorded'} · IN {cycle.inLbs.toLocaleString()} lb</p><p className="mt-2 text-sm font-semibold text-teal-800">{cycle.review ? 'Submitted review' : 'Awaiting review'}</p></button>)}</aside>
    {cycle && catalog.data ? <BinReviewEditor key={cycle.cycleId} cycle={cycle} catalog={catalog.data} readOnly={user?.role === 'scale_operator'} /> : <section className="rounded-3xl border border-teal-200 bg-white p-8"><ClipboardCheck className="mb-4 h-12 w-12 text-teal-700" /><h2 className="text-xl font-bold">Choose a load to inspect</h2><p className="mt-2 text-slate-600">Verify ticket, seller, plate and load number before recording deductions.</p></section>}
    </div><p className="text-xs text-slate-600">These are yard deduction rules, not measured item weights or legal-compliance certification.</p>
  </main></div>;
}
