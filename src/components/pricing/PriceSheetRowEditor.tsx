import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { normalizePartsPrice } from '@/utils/partsPriceCalculations';
import { Trash2 } from 'lucide-react';
import type { ReviewedPriceRow } from '@/types/priceSheets';

export function PriceSheetRowEditor({row,index,onChange,onRemove}: {row:ReviewedPriceRow;index:number;onChange:(row:ReviewedPriceRow)=>void;onRemove:()=>void}) {
  let error = '';
  try {normalizePartsPrice(row.priceKind,row.price);} catch (cause) {error = cause instanceof Error?cause.message:'Price needs review';}
  const update = (field: keyof ReviewedPriceRow,value:string) => onChange({...row,[field]:value,reviewed:false});
  return <article className={`space-y-3 rounded-2xl border p-4 ${row.reviewed?'border-emerald-700 bg-emerald-950/40':'border-amber-700 bg-slate-900'}`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-white">Row {index+1} · {row.page?`source page ${row.page}`:'manually transcribed'}</h3><Button onClick={onRemove} variant="outline" className="h-8 rounded-xl border-rose-700 bg-rose-950 text-rose-100"><Trash2 className="mr-1 h-3 w-3"/>Remove</Button></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div><Label htmlFor={`${row.id}-category`} className="text-slate-200">Category</Label><Input id={`${row.id}-category`} value={row.category} onChange={(event)=>update('category',event.target.value)} className="mt-1 rounded-xl border-slate-600 bg-slate-950 text-white"/></div>
      <div><Label htmlFor={`${row.id}-name`} className="text-slate-200">Part name</Label><Input id={`${row.id}-name`} value={row.name} onChange={(event)=>update('name',event.target.value)} className="mt-1 rounded-xl border-slate-600 bg-slate-950 text-white"/></div>
      <div><Label className="text-slate-200">Price type</Label><Select value={row.priceKind} onValueChange={(value)=>onChange({...row,priceKind:value as ReviewedPriceRow['priceKind'],reviewed:false})}><SelectTrigger aria-label={`Row ${index+1} price type`} className="mt-1 rounded-xl border-slate-600 bg-slate-950 text-white"><SelectValue/></SelectTrigger><SelectContent className="border-slate-600 bg-slate-900 text-white"><SelectItem value="fixed">Fixed amount</SelectItem><SelectItem value="range">Price range</SelectItem><SelectItem value="description">Descriptive price</SelectItem></SelectContent></Select></div>
      <div><Label htmlFor={`${row.id}-price`} className="text-slate-200">Price / description</Label><Input id={`${row.id}-price`} value={row.price} placeholder={row.priceKind==='range'?'10.00–20.00':row.priceKind==='fixed'?'12.50':'Call yard for price'} onChange={(event)=>update('price',event.target.value)} className="mt-1 rounded-xl border-slate-600 bg-slate-950 text-white"/></div>
      {(['unit','core','warranty','conditions'] as const).map((field)=><div key={field}><Label htmlFor={`${row.id}-${field}`} className="capitalize text-slate-200">{field}</Label><Input id={`${row.id}-${field}`} value={row[field]} onChange={(event)=>update(field,event.target.value)} className="mt-1 rounded-xl border-slate-600 bg-slate-950 text-white"/></div>)}
    </div>
    {row.sourceText && <details className="rounded-xl border border-slate-700 p-2 text-xs text-slate-200"><summary className="cursor-pointer font-semibold">Original extracted text · private</summary><p className="mt-2 whitespace-pre-wrap break-words">{row.sourceText}</p></details>}
    {error && <p role="alert" className="text-xs text-amber-200">{error}</p>}
    <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-100"><input type="checkbox" checked={row.reviewed} disabled={!!error||!row.name.trim()||!row.category.trim()} onChange={(event)=>onChange({...row,reviewed:event.target.checked})} className="mt-0.5 accent-emerald-500"/>I verified this row’s category, name, price, unit, core, warranty and conditions against the original.</label>
  </article>;
}
