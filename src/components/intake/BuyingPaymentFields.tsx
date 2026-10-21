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
  const methods = eligibility?.selectableMethods ?? eligibility?.allowedMethods ?? [];
  const automaticMethod = methods.length === 1 ? methods[0] : undefined;
  useEffect(() => {
    if (automaticMethod && value.method !== automaticMethod) onChange({ ...value, method: automaticMethod });
  }, [automaticMethod, value, onChange]);

  return <div className="space-y-3 rounded-xl border border-emerald-700 bg-slate-950 p-4">
    <Label className="text-sm font-bold text-emerald-200">Record actual payment</Label>
    <p className="text-xs text-slate-100">Automatic method: ferrous / mixed cash through $25; non-ferrous cash through $100. Above the threshold, issue a check.</p>
    <div className="grid grid-cols-2 gap-2">{(['Cash','Check'] as const).map(method => <Button type="button" key={method} aria-pressed={value.method === method} disabled={disabled || loading || !methods.includes(method)} onClick={() => onChange({...value,method})} className={`h-11 rounded-xl ${value.method === method ? 'bg-emerald-700 text-white hover:bg-emerald-600' : 'bg-slate-800 text-slate-100 hover:bg-slate-700'}`}>{method}</Button>)}</div>
    {value.method === 'Check' && <div className="space-y-2 rounded-xl border-2 border-amber-400 bg-amber-950 p-4 shadow-sm">
      <Label htmlFor={`${id}-check`} className="flex items-center gap-2 text-base font-bold text-amber-100"><Hash className="h-5 w-5"/>Record Check Number · Required</Label>
      <Input id={`${id}-check`} type="text" required maxLength={120} autoComplete="off" placeholder="e.g. 9042" value={value.reference} disabled={disabled} onChange={event => onChange({...value,reference:event.target.value})} aria-describedby={`${id}-check-help`} className="h-14 rounded-xl border-amber-400 bg-slate-950 font-mono text-xl font-bold text-white placeholder:text-slate-400"/>
      <p id={`${id}-check-help`} className="text-xs leading-relaxed text-amber-100">Enter the actual number on the issued check. Leading zeroes and alphanumeric references are kept (e.g. 0009042 or A-9042). No number is generated.</p>
    </div>}
    {loading && <p role="status" className="text-xs text-slate-200">Checking server payment method…</p>}
    {error && <p role="alert" className="text-sm text-amber-200">{error} Refresh the payment method before completing; entered details are kept.</p>}
    {eligibility?.reasons.map(reason => <p key={reason.code} className="text-xs leading-relaxed text-amber-100">{reason.message}</p>)}
    <p className="text-xs text-slate-200">Complete &amp; Record Payment confirms cash handed over or a check issued to the seller and creates a PAID receipt. It does not transfer funds or confirm check clearance.</p>
  </div>;
}
