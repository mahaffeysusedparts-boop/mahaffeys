import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBinCatalog } from '@/hooks/useBinInspection';
import { binInspectionService } from '@/services/binInspectionService';
import { binCatalogSchema } from '@/utils/binDeductionRules';
import type { BinDeductionCatalog, BinDeductionItem } from '@/types/binDeductions';
export function BinDeductionSettings() {
  const query = useBinCatalog();
  const client = useQueryClient();
  const [draft, setDraft] = useState<BinDeductionCatalog>();
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const catalog = draft ?? query.data;
  const update = (index: number, item: BinDeductionItem) => { if (catalog) setDraft({ ...catalog, items: catalog.items.map((old, i) => i === index ? item : old) }); setMessage('Unsaved'); };
  const save = async () => {
    const parsed = binCatalogSchema.safeParse(catalog);
    if (!parsed.success) { setMessage(parsed.error.issues.map(issue => issue.message).join('; ')); return; }
    setSaving(true);
    try { const saved = await binInspectionService.saveCatalog(parsed.data as BinDeductionCatalog); client.setQueryData(['bin-catalog'], saved); setDraft(undefined); setMessage('Saved on server'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Catalog not saved'); }
    finally { setSaving(false); }
  };
  return <section className="space-y-4 rounded-3xl border border-teal-700 bg-slate-900 p-6 text-slate-100"><h2 className="text-xl font-extrabold text-teal-300">Bin deduction items</h2><p className="text-sm text-slate-300">Yard rules, not measured weights or compliance certification. Existing item IDs are retained; disable rather than delete.</p>
    {query.isPending && <p>Loading catalog…</p>}{query.isError && <p role="alert">Could not load catalog. <Button onClick={() => query.refetch()}>Retry</Button></p>}
    {catalog && <><p className="text-sm">Catalog revision {catalog.revision}</p>{draft && query.data && query.data.revision !== draft.revision && <p role="alert" className="text-amber-200">Catalog changed on another device. Reload before saving.</p>}
    <fieldset disabled={saving} className="space-y-4">{catalog.items.map((item,index) => <div key={index} className="space-y-3 rounded-2xl border border-slate-700 bg-slate-950 p-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Item ID<Input aria-label={`Item ${index + 1} ID`} value={item.id} disabled={query.data?.items.some(old => old.id === item.id)} onChange={e => update(index,{ ...item,id:e.target.value })} className="mt-1 rounded-xl" /></label><label className="text-sm">Name<Input aria-label={`Item ${index + 1} name`} value={item.name} onChange={e => update(index,{ ...item,name:e.target.value })} className="mt-1 rounded-xl" /></label></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.enabled} onChange={e => update(index,{ ...item,enabled:e.target.checked })} />Available to bin employees</label>
      <label className="block text-sm">Weight rule<select aria-label={`Item ${index + 1} rule`} className="ml-3 rounded-xl border border-slate-600 bg-slate-900 p-2" value={item.mode} onChange={e => update(index,e.target.value === 'FIXED' ? { id:item.id,name:item.name,enabled:item.enabled,mode:'FIXED',pounds:5 } : { id:item.id,name:item.name,enabled:item.enabled,mode:'RANGED',minPounds:5,maxPounds:50 })}><option value="FIXED">Fixed pounds</option><option value="RANGED">Employee-entered range</option></select></label>
      {item.mode === 'FIXED' ? <label className="block text-sm">Pounds per item<Input type="number" aria-label={`Item ${index + 1} pounds`} value={item.pounds} min={0.000001} step="any" onChange={e => update(index,{ ...item,pounds:Number(e.target.value) })} className="mt-1 rounded-xl" /></label> : <div className="grid grid-cols-2 gap-3"><label className="text-sm">Minimum pounds<Input aria-label={`Item ${index + 1} minimum`} type="number" step="any" value={item.minPounds} onChange={e => update(index,{ ...item,minPounds:Number(e.target.value) })} className="mt-1 rounded-xl" /></label><label className="text-sm">Maximum pounds<Input aria-label={`Item ${index + 1} maximum`} type="number" step="any" value={item.maxPounds} onChange={e => update(index,{ ...item,maxPounds:Number(e.target.value) })} className="mt-1 rounded-xl" /></label></div>}
      <p className="text-sm text-teal-200">Preview · 2 units = {item.mode === 'FIXED' ? `${2 * item.pounds} lb` : `${2 * item.minPounds}–${2 * item.maxPounds} lb`}</p>
    </div>)}</fieldset><div className="flex flex-wrap gap-3"><Button disabled={saving} className="rounded-xl bg-teal-600 hover:bg-teal-500" onClick={save}>Save bin deduction items</Button><Button disabled={saving} variant="outline" className="rounded-xl" onClick={() => { setDraft({ ...catalog, items:[...catalog.items,{ id:`item-${crypto.randomUUID().slice(0,8)}`,name:'New deduction item',enabled:true,mode:'FIXED',pounds:5 }] }); }}>Add item</Button><Button disabled={saving} variant="outline" className="rounded-xl" onClick={() => { setDraft(undefined); setMessage(''); query.refetch(); }}>Reload catalog</Button></div></>}
    {message && <p role="status" className="text-amber-200">{message}</p>}
  </section>;
}
