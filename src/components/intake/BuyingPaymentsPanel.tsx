import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { BuyingPaymentFields, useBuyingPaymentEligibility, initialBuyingPayment, buyingPaymentReady } from './BuyingPaymentFields';
import { canRecordBuyingPayment } from '@/utils/buyingAuthorization';
import { useAuth } from '@/context/AuthContext';
import { scrapBuyingService } from '@/services/scrapBuyingService';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ReceiptModal } from '@/components/receipts/ReceiptModal';
import { LegacyBuyingReviewPanel } from './LegacyBuyingReviewPanel';
import { BuyingPolicySettings } from '@/components/settings/BuyingPolicySettings';
import { ShieldCheck, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import type { Ticket } from '@/types/scrap';

export function BuyingPaymentsPanel({onPaid}: {onPaid?: () => void}) {
  const {user} = useAuth();
  const allowed = canRecordBuyingPayment(user);
  const canReviewLegacy = user?.role === 'admin' || user?.role === 'yard_manager';
  const queue = useQuery({queryKey:['scrap-buying-queue'],queryFn:() => scrapBuyingService.queue(),refetchInterval:5000});
  const [selectedId,setSelectedId] = useState<string|null>(null);
  const [paymentInput,setPaymentInput] = useState(initialBuyingPayment);
  const [paymentTicketId,setPaymentTicketId] = useState<string|null>(null);
  const [receipt,setReceipt] = useState<Ticket|null>(null);
  const selected = queue.data?.tickets.find((ticket) => ticket.id === selectedId);
  const eligibility = useBuyingPaymentEligibility(selected);
  const payment = useMutation({mutationFn:async () => {
    if (!selected || !buyingPaymentReady(eligibility.data,paymentInput)) throw new Error('Enter required payment details first');
    return scrapBuyingService.pay(selected,paymentInput.method,paymentInput.reference,paymentInput.permitReference,paymentInput.documentationReference);
  },onSuccess:(ticket) => { setReceipt(ticket); setSelectedId(null); setPaymentTicketId(null); setPaymentInput(initialBuyingPayment); toast.success('Payment acknowledged once; receipt copies do not pay again'); void queue.refetch(); onPaid?.(); }});
  return <section className="space-y-4 rounded-2xl border border-emerald-800 bg-slate-900 p-4 text-white sm:p-6">
    {canReviewLegacy && <LegacyBuyingReviewPanel/>}
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-xl font-bold"><Banknote className="text-emerald-300"/> Buying payments</h2><Button variant="outline" onClick={() => void queue.refetch()} className="rounded-xl border-slate-600 bg-slate-800 text-white">Refresh queue</Button></div>
    <p className="text-sm text-slate-200">Finalized purchases remain unpaid until actual cash disbursement or check issuance is acknowledged here. Historical tickets are excluded until reconciled; no payment status is inferred from legacy completion.</p>
    {queue.isError && <p role="alert" className="text-amber-200">{queue.error.message}</p>}
    {!queue.data?.policy && <p role="alert" className="rounded-xl border border-amber-600 bg-amber-950 p-3 text-sm text-amber-100">Payments are gated until an administrator records a current compliance-review policy. Yard cash preferences are not a substitute for South Carolina law.</p>}
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-slate-700 text-slate-300"><tr><th className="py-2">Ticket / seller</th><th>Stage</th><th>Amount</th><th>Next action</th></tr></thead><tbody>{(queue.data?.tickets ?? []).filter((ticket) => ['FINALIZED','PAID'].includes(ticket.buying?.stage ?? '')).map((ticket) => <tr key={ticket.id} className="border-b border-slate-800"><td className="py-3"><b>#{ticket.id}</b><p>{ticket.customerName}</p></td><td>{ticket.buying?.stage === 'PAID' ? `Paid · ${ticket.buying.payment?.method}` : 'Ready for payout · unpaid'}{ticket.buying?.payment?.checkReference && <p className="font-mono text-xs text-emerald-200">Check #{ticket.buying.payment.checkReference}</p>}</td><td className="font-mono">${ticket.finalPayout.toFixed(2)}</td><td><Button onClick={() => {if(ticket.buying?.stage === 'PAID') setReceipt(ticket);else{setSelectedId(ticket.id);if(paymentTicketId !== ticket.id){setPaymentInput(initialBuyingPayment);setPaymentTicketId(ticket.id);}payment.reset();}}} disabled={ticket.buying?.stage !== 'PAID' && !allowed} className="rounded-xl bg-emerald-700 text-white hover:bg-emerald-600">{ticket.buying?.stage === 'PAID' ? 'Receipt copy' : 'Record payment'}</Button></td></tr>)}</tbody></table></div>
    {user?.role === 'admin' && <BuyingPolicySettings policy={queue.data?.policy} loading={queue.isPending || queue.isError} onSaved={() => { void queue.refetch(); }}/>}
    <Dialog open={!!selectedId} onOpenChange={open=>{if(!open && !payment.isPending)setSelectedId(null);}}><DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-slate-700 bg-slate-950 text-white"><DialogHeader><DialogTitle className="flex gap-2"><ShieldCheck className="text-emerald-300"/>Actual payment · #{selected?.id}</DialogTitle><DialogDescription className="text-slate-200">{selected?.customerName} ·  ${selected?.finalPayout.toFixed(2)}. Record cash handover or check issuance directly.</DialogDescription></DialogHeader>
      <BuyingPaymentFields eligibility={eligibility.data} error={eligibility.error?.message} loading={eligibility.isLoading} disabled={payment.isPending} value={paymentInput} onChange={setPaymentInput}/>
      <p className="rounded-xl border border-emerald-700 bg-emerald-950 p-3 text-sm text-emerald-100">By recording payment, you confirm cash was actually handed to this seller / the check with this number was actually issued to this seller. Do not disburse again on retry.</p>
      {payment.isError && <p role="alert" className="text-amber-200">{payment.error.message} Refresh the queue if the result is uncertain; never disburse a second time.</p>}
      <Button onClick={()=>payment.mutate()} disabled={!allowed || eligibility.isError || !buyingPaymentReady(eligibility.data,paymentInput) || payment.isPending || selected?.buying?.stage!=='FINALIZED'} className="h-12 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500">{payment.isPending?'Awaiting server acknowledgement…':'Complete & Record Payment'}</Button>
    </DialogContent></Dialog>
    <ReceiptModal ticket={receipt} open={!!receipt} onOpenChange={(open) => !open && setReceipt(null)}/>
  </section>;
}
