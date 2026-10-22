import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Minus, Plus, Package, Droplets } from 'lucide-react';
import type { BinCycle, BinDeductionCatalog, BinSelection } from '@/types/binDeductions';
import { binInspectionService } from '@/services/binInspectionService';
import { resolveBinSelections } from '@/utils/binDeductionRules';
import { itemDeductionTotal } from '@/utils/weighingContract';
import { BinReviewEvidence } from '@/components/intake/BinInspectionSummary';
export function BinReviewEditor({ cycle, catalog, readOnly }: { cycle: BinCycle; catalog: BinDeductionCatalog; readOnly: boolean }) {
  const queryClient = useQueryClient();
  const [expectedRevision, setExpectedRevision] = useState(cycle.review?.revision ?? 0);
  const [selections, setSelections] = useState<BinSelection[]>(() => cycle.review?.items.map(item => ({ itemId: item.itemId, quantity: item.quantity, ...(catalog.items.find(rule => rule.id === item.itemId)?.mode === 'RANGED' ? { poundsPerUnit: item.poundsPerUnit } : {}) })) ?? []);
  const [status, setStatus] = useState(cycle.review ? 'Saved on server' : 'Unsaved');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const locked = readOnly || !cycle.open;
  useEffect(() => {
    const offline = () => { if (dirty && !sending) setStatus('Offline — not submitted'); };
    const online = () => { if (dirty && !sending) setStatus('Unsaved'); };
    window.addEventListener('offline', offline); window.addEventListener('online', online);
    return () => { window.removeEventListener('offline', offline); window.removeEventListener('online', online); };
  }, [dirty, sending]);
  const update = (itemId: string, quantity: number, poundsPerUnit?: number) => {
    setSelections(old => [...old.filter(item => item.itemId !== itemId), ...(quantity !== 0 ? [{ itemId, quantity, ...(poundsPerUnit === undefined ? {} : { poundsPerUnit }) }] : [])]);
    setDirty(true); setStatus(navigator.onLine ? 'Unsaved' : 'Offline — not submitted'); setError('');
  };
  let total: number | null = null;
  try { total = itemDeductionTotal(resolveBinSelections(catalog, selections)); } catch { /* Display invalid policy input without pretending it is a saved total. */ }
  const submit = async (empty = false) => {
    if (!navigator.onLine) { setStatus('Offline — not submitted'); return; }
    setSending(true); setStatus('Sending'); setError('');
    try {
      const review = await binInspectionService.submit(cycle.cycleId, expectedRevision, catalog.revision, empty ? [] : selections);
      setExpectedRevision(review.revision); setDirty(false); if (empty) setSelections([]);
      setStatus('Saved on server');
      await queryClient.invalidateQueries({ queryKey: ['bin-inspections'] });
    } catch (error) { setStatus(navigator.onLine ? 'Failed / Retry' : 'Offline — not submitted'); setError(error instanceof Error ? error.message : 'Server did not confirm submission'); }
    finally { setSending(false); }
  };
  const reload = () => {
    setExpectedRevision(cycle.review?.revision ?? 0);
    setSelections(cycle.review?.items.map(item => ({ itemId: item.itemId, quantity: item.quantity, ...(catalog.items.find(rule => rule.id === item.itemId)?.mode === 'RANGED' ? { poundsPerUnit: item.poundsPerUnit } : {}) })) ?? []);
    setDirty(false); setError(''); setStatus(cycle.review ? 'Saved on server' : 'Unsaved');
  };
  return <section className="space-y-5 rounded-3xl border border-teal-200 bg-white p-5 shadow-sm sm:p-7">
    <header><p className="text-sm font-bold uppercase tracking-wider text-teal-700">Ticket {cycle.ticketId} · Load {cycle.number}</p><h2 className="text-2xl font-extrabold text-slate-900">{cycle.sellerName}</h2><p className="text-slate-600">Plate {cycle.plate || 'not recorded'} · IN {cycle.inLbs.toLocaleString()} lb</p></header>
    {(locked || (cycle.review?.revision ?? 0) > expectedRevision) && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-amber-900">{locked ? 'Read-only: this review cannot be edited.' : 'A newer review is saved on server. Reload before correcting.'}</p>}
    {!locked && <fieldset disabled={sending} className="grid gap-3 sm:grid-cols-2">{catalog.items.filter(item => item.enabled).map(item => {
      const selection = selections.find(selection => selection.itemId === item.id);
      const quantity = selection?.quantity ?? 0;
      const pounds = item.mode === 'RANGED' ? selection?.poundsPerUnit ?? item.minPounds : undefined;
      return <div key={item.id} className="space-y-3 rounded-2xl border border-teal-200 bg-teal-50 p-4"><div className="flex gap-3"><span className="rounded-xl bg-teal-700 p-3 text-white">{item.mode === 'RANGED' ? <Droplets /> : <Package />}</span><div><h3 className="font-bold text-slate-900">{item.name}</h3><p className="text-sm text-teal-800">{item.mode === 'FIXED' ? `${item.pounds} lb per item` : `${item.minPounds}–${item.maxPounds} lb per unit`}</p></div></div>
        <div className="flex items-center gap-2"><Button aria-label={`Decrease ${item.name}`} className="h-12 rounded-xl bg-teal-700 text-white hover:bg-teal-800" onClick={() => update(item.id, Math.max(0, quantity - 1), pounds)}><Minus /></Button><Input aria-label={`${item.name} quantity`} type="number" min={0} max={10000} step={1} value={quantity} onChange={event => update(item.id, Number(event.target.value), pounds)} className="h-12 rounded-xl bg-white text-center text-lg font-bold" /><Button aria-label={`Increase ${item.name}`} className="h-12 rounded-xl bg-teal-700 text-white hover:bg-teal-800" onClick={() => update(item.id, quantity + 1, pounds)}><Plus /></Button></div>
        {item.mode === 'RANGED' && <label className="block text-sm font-semibold text-teal-900">Pounds per unit<Input aria-label={`${item.name} pounds per unit`} type="number" min={item.minPounds} max={item.maxPounds} step="any" value={pounds} onChange={event => update(item.id, quantity, Number(event.target.value))} className="mt-1 h-12 rounded-xl bg-white" /></label>}
      </div>;
    })}</fieldset>}
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-teal-800 p-4 text-white"><p className="font-bold">Draft deduction total: {total === null ? 'Invalid selections' : `${total.toLocaleString()} lb`}</p><p role="status">{dirty && status === 'Saved on server' ? 'Unsaved' : status}</p></div>
    {cycle.review && <div className="rounded-2xl border border-teal-200 p-4 text-sm text-slate-700"><p className="mb-2 font-bold">Latest server review</p><BinReviewEvidence review={cycle.review} /></div>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {!locked && <div className="flex flex-wrap gap-3"><Button className="h-12 rounded-xl bg-teal-700 px-6 text-white hover:bg-teal-800" disabled={sending || total === null} onClick={() => submit()}>Submit bin review</Button><Button variant="outline" className="h-12 rounded-xl border-teal-300 bg-white text-teal-800 hover:bg-teal-50 hover:text-teal-900" disabled={sending} onClick={() => submit(true)}>No deduction items found</Button><Button variant="ghost" className="h-12 rounded-xl text-teal-800 hover:bg-teal-50 hover:text-teal-900" disabled={sending} onClick={reload}>Reload saved review</Button></div>}
  </section>;
}
