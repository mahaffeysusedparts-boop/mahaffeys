import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { scrapBuyingService } from '@/services/scrapBuyingService';
import type { Ticket } from '@/types/scrap';
import type { PaymentEligibility } from '@/types/buyingPayments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  useEffect(() => {
    if (value.method === 'Cash' && eligibility?.allowedMethods.includes('Check') && !eligibility.allowedMethods.includes('Cash')) onChange({ ...value, method: 'Check' });
  }, [eligibility, value, onChange]);
  return <div className="space-y-3 rounded-xl border border-emerald-700 bg-slate-950 p-4">
    <Label className="text-sm font-bold text-emerald-200">Record actual payment</Label>
    <div className="grid grid-cols-2 gap-2">{(['Cash','Check'] as const).map(method => <Button type="button" key={method} aria-pressed={value.method===method} disabled={disabled || loading || !eligibility?.allowedMethods.includes(method)} onClick={() => onChange({...value,method})} className={`h-11 rounded-xl ${value.method===method?'bg-emerald-700 text-white hover:bg-emerald-600':'bg-slate-800 text-slate-100 hover:bg-slate-700'}`}>{method}</Button>)}</div>
    {loading && <p role="status" className="text-xs text-slate-200">Checking server payment eligibility…</p>}
    {error && <p role="alert" className="text-sm text-amber-200">{error} Payment is blocked until eligibility can be checked.</p>}
    {eligibility?.reasons.map(reason => <p key={reason.code} className="text-xs leading-relaxed text-amber-100">{reason.method ? `${reason.method} unavailable: ` : ''}{reason.message}</p>)}
    {value.method==='Check' && <div className="space-y-2"><Label htmlFor="issued-check-number" className="font-bold text-emerald-200">Check Number · required</Label><Input id="issued-check-number" required maxLength={120} autoComplete="off" placeholder="Actual number on the issued check" value={value.reference} disabled={disabled} onChange={event=>onChange({...value,reference:event.target.value})} className="h-12 rounded-xl border-emerald-600 bg-slate-900 text-lg font-bold text-white"/></div>}
    {eligibility?.permitRequired && <div className="space-y-2"><Label htmlFor="seller-payment-permit">Valid seller permit reference · required</Label><Input id="seller-payment-permit" required maxLength={200} value={value.permitReference} disabled={disabled} onChange={event=>onChange({...value,permitReference:event.target.value})} className="rounded-xl border-slate-600 bg-slate-900 text-white"/></div>}
    {eligibility?.documentationRequired && <div className="space-y-2"><Label htmlFor="seller-payment-documents">Retained seller documentation reference · required</Label><Input id="seller-payment-documents" required maxLength={500} placeholder="Signed ownership statement, ID/photo, permit copy" value={value.documentationReference} disabled={disabled} onChange={event=>onChange({...value,documentationReference:event.target.value})} className="rounded-xl border-slate-600 bg-slate-900 text-white"/><p className="text-xs text-slate-200">Retain legally required seller records; entering a reference does not verify a permit or document’s validity.</p></div>}
    <p className="text-xs text-slate-200">This records cash handed over or a check issued to the seller. It does not transfer funds or confirm check clearance. Eligibility is checked again under the payment lock.</p>
  </div>;
}
