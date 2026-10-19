import { useEffect, useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import { scrapBuyingService } from '@/services/scrapBuyingService';
import type { Ticket } from '@/types/scrap';
import type { PaymentEligibility } from '@/types/buyingPayments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Hash } from 'lucide-react';

export function useBuyingPaymentEligibility(ticket?: Ticket | null) {
  return useQuery({ queryKey: ['buying-payment-eligibility', ticket?.id, ticket?.buying?.revision], queryFn: () => scrapBuyingService.eligibility(ticket!), enabled: !!ticket, refetchInterval: 5000, retry: false });
}

export interface BuyingPaymentInput {
  method: 'Cash' | 'Check';
  reference: string;
  permitReference: string;
  documentationReference: string;
}
export const initialBuyingPayment: BuyingPaymentInput = { method: 'Cash', reference: '', permitReference: '', documentationReference: '' };

export function buyingPaymentReady(eligibility: PaymentEligibility | undefined, value: BuyingPaymentInput) {
  return !!eligibility?.allowedMethods.includes(value.method) && (value.method !== 'Check' || !!value.reference.trim()) && (!eligibility.permitRequired || !!value.permitReference.trim()) && (!eligibility.documentationRequired || !!value.documentationReference.trim());
}

export function BuyingPaymentFields({ eligibility, error, loading, disabled, value, onChange }: { eligibility?: PaymentEligibility; error?: string; loading: boolean; disabled?: boolean; value: BuyingPaymentInput; onChange: (value: BuyingPaymentInput) => void }) {
  const id = useId();
  const methods = eligibility?.selectableMethods ?? eligibility?.allowedMethods ?? ['Check'];
  const checkOnly = methods.includes('Check') && !methods.includes('Cash');
  useEffect(() => {
    if (eligibility && value.method === 'Cash' && checkOnly) onChange({ ...value, method: 'Check' });
  }, [eligibility, checkOnly, value, onChange]);

  return <div className="space-y-3 rounded-xl border border-emerald-700 bg-slate-950 p-4">
    <Label className="text-sm font-bold text-emerald-200">Record actual payment</Label>
    <div className="grid grid-cols-2 gap-2">{(['Cash','Check'] as const).map(method => <Button type="button" key={method} aria-pressed={value.method === method} disabled={disabled || (method === 'Cash' && (loading || !methods.includes(method)))} onClick={() => onChange({...value,method})} className={`h-11 rounded-xl ${value.method === method ? 'bg-emerald-700 text-white hover:bg-emerald-600' : 'bg-slate-800 text-slate-100 hover:bg-slate-700'}`}>{method}</Button>)}</div>
    {value.method === 'Check' && <div className="space-y-2 rounded-xl border-2 border-amber-400 bg-amber-950 p-4 shadow-sm">
      <Label htmlFor={`${id}-check`} className="flex items-center gap-2 text-base font-bold text-amber-100"><Hash className="h-5 w-5"/>Record Check Number · Required</Label>
      <Input id={`${id}-check`} type="text" required maxLength={120} autoComplete="off" placeholder="e.g. 9042" value={value.reference} disabled={disabled} onChange={event => onChange({...value,reference:event.target.value})} aria-describedby={`${id}-check-help`} className="h-14 rounded-xl border-amber-400 bg-slate-950 font-mono text-xl font-bold text-white placeholder:text-slate-400"/>
      <p id={`${id}-check-help`} className="text-xs leading-relaxed text-amber-100">Enter the actual number on the issued check. Leading zeroes and alphanumeric references are kept (e.g. 0009042 or A-9042). No number is generated.</p>
    </div>}
    {loading && <p role="status" className="text-xs text-slate-200">Checking server payment eligibility…</p>}
    {error && <p role="alert" className="text-sm text-amber-200">{error} Payment is blocked until eligibility can be checked; entered details are kept.</p>}
    {eligibility?.safeguardReview?.enabled === false && <p role="status" className="rounded-xl border border-amber-600 bg-amber-950 p-3 text-xs leading-relaxed text-amber-100">Administrator override active · payment-rule safeguards OFF (revision {eligibility.safeguardReview.revision}). This payment will record the saved override, not a legal-compliance approval. Check numbers and transaction protections still apply.</p>}
    {eligibility?.reasons.map(reason => <p key={reason.code} className="text-xs leading-relaxed text-amber-100">{reason.method ? `${reason.method} unavailable: ` : ''}{reason.message}</p>)}
    {eligibility?.permitRequired && <div className="space-y-2"><Label htmlFor={`${id}-permit`}>Valid seller permit reference · required</Label><Input id={`${id}-permit`} required maxLength={200} value={value.permitReference} disabled={disabled} onChange={event => onChange({...value,permitReference:event.target.value})} className="rounded-xl border-slate-600 bg-slate-900 text-white"/></div>}
    {eligibility?.documentationRequired && <div className="space-y-2"><Label htmlFor={`${id}-documents`}>Retained seller documentation reference · required</Label><Input id={`${id}-documents`} required maxLength={500} placeholder="Signed ownership statement, ID/photo, permit copy" value={value.documentationReference} disabled={disabled} onChange={event => onChange({...value,documentationReference:event.target.value})} className="rounded-xl border-slate-600 bg-slate-900 text-white"/><p className="text-xs text-slate-200">Retain legally required seller records; entering a reference does not verify a permit or document’s validity.</p></div>}
    <p className="text-xs text-slate-200">This records cash handed over or a check issued to the seller. It does not transfer funds or confirm check clearance. Eligibility is checked again under the payment lock. Selecting a method does not bypass any blocker.</p>
  </div>;
}
