import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { paymentSafeguardsService, usePaymentSafeguards } from '@/services/paymentSafeguardsService';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';

export function PaymentSafeguardsSettings() {
  const { isAdmin } = useAuth();
  const safeguards = usePaymentSafeguards();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const current = safeguards.data;
  const save = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error('Load current safeguards first');
      return paymentSafeguardsService.save(!current.enabled,current.revision,reason.trim() || 'Administrator re-enabled payment-rule safeguards');
    },
    onSuccess: saved => {
      queryClient.setQueryData(['payment-safeguards'],saved);
      void queryClient.invalidateQueries({queryKey:['buying-payment-eligibility']});
      setReason('');
      toast.success(saved.enabled ? 'Payment-rule safeguards enabled again' : 'Payment-rule enforcement disabled by administrator');
    },
    onError: () => { void safeguards.refetch(); },
  });
  const toggle = () => {
    if (!current || save.isPending) return;
    if (current.enabled && !window.confirm('Disable payment-rule enforcement yard-wide? Policy, material, permit, documentation and cash-limit checks will not block new payments. Legal obligations still apply. This administrator override will be recorded.')) return;
    save.mutate();
  };
  return <section className={`space-y-4 rounded-2xl border p-4 sm:p-5 ${current?.enabled === false ? 'border-amber-600 bg-amber-950' : 'border-emerald-700 bg-emerald-950'}`}>
    <div className="flex items-start gap-3">
      {current?.enabled === false ? <ShieldOff className="mt-1 h-6 w-6 shrink-0 text-amber-200"/> : <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-emerald-200"/>}
      <div><h3 className="text-lg font-bold text-white">Payment safeguards</h3><p className="mt-1 text-sm font-semibold text-slate-100">{current ? current.enabled ? 'ON · Payment-rule checks enforced' : 'OFF · Administrator override active' : 'Loading server-saved status…'}</p></div>
    </div>
    <p className="text-sm leading-relaxed text-slate-100">This master control turns the application’s policy, material/identity, permit, documentation and cash-limit enforcement off or back on for all scrap-payment operators. When off, buying-policy setup will not block payment. Re-enabling restores those checks for subsequent payment attempts.</p>
    <p className="rounded-xl border border-amber-600 bg-slate-950 p-3 text-xs leading-relaxed text-amber-100">Disabling software checks does not waive legal obligations or certify a purchase as lawful. Required check numbers, authorization, valid confirmed weighing, positive payout amounts, actual-payment acknowledgement, duplicate prevention, recorded drawer funds and historical-payment protections always remain active. Intake photo/ID/plate/review preferences are separate.</p>
    {safeguards.isError && <p role="alert" className="text-sm text-amber-100">Status could not refresh. <button type="button" onClick={() => void safeguards.refetch()} className="underline">Retry</button> before changing it.</p>}
    {isAdmin && current ? <>
      <Label htmlFor="payment-safeguards-reason" className="text-slate-100">{current.enabled ? 'Reason for disabling enforcement · required' : 'Reason for re-enabling · optional'}</Label>
      <Textarea id="payment-safeguards-reason" value={reason} onChange={event => setReason(event.target.value)} maxLength={500} disabled={save.isPending} placeholder={current.enabled ? 'Record why you are disabling these application checks…' : 'Optional note; re-enabling is recorded automatically'} className="rounded-xl border-slate-500 bg-slate-950 text-white"/>
      {save.isError && <p role="alert" className="text-sm text-amber-100">{save.error.message} Current status has been reloaded; review it before retrying.</p>}
      <Button type="button" onClick={toggle} disabled={save.isPending || safeguards.isError || (current.enabled && !reason.trim())} className={`h-auto min-h-12 whitespace-normal rounded-xl px-4 py-3 font-bold ${current.enabled ? 'bg-amber-300 text-amber-950 hover:bg-amber-200' : 'bg-emerald-700 text-white hover:bg-emerald-600'}`}>{save.isPending ? 'Saving server-wide state…' : current.enabled ? 'Disable payment-rule safeguards' : 'Enable payment-rule safeguards again'}</Button>
    </> : <p className="text-xs text-slate-100">Only an administrator can change this master control.</p>}
    {current?.updatedAt && <p className="text-xs leading-relaxed text-slate-200">Revision {current.revision} · {current.updatedBy} · {new Date(current.updatedAt).toLocaleString()}<br/>Reason: {current.reason}</p>}
  </section>;
}
