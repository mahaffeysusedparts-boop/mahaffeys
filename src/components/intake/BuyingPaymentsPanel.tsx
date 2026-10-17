import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { scrapBuyingService } from '@/services/scrapBuyingService';
import { storageService } from '@/services/storageService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ReceiptModal } from '@/components/receipts/ReceiptModal';
import { LegacyBuyingReviewPanel } from './LegacyBuyingReviewPanel';
import { ShieldCheck, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import type { BuyingPolicy } from '@/types/buyingPayments';
import type { Ticket } from '@/types/scrap';

export function BuyingPaymentsPanel({onPaid}: {onPaid?: () => void}) {
  const {user} = useAuth();
  const allowed = user?.role === 'admin' || user?.role === 'yard_manager';
  const queue = useQuery({queryKey:['scrap-buying-queue'],queryFn:() => scrapBuyingService.queue(),refetchInterval:5000});
  const [selectedId,setSelectedId] = useState<string|null>(null);
  const [method,setMethod] = useState<'Cash'|'Check'>('Check');
  const [reference,setReference] = useState('');
  const [permit,setPermit] = useState('');
  const [confirmed,setConfirmed] = useState(false);
  const [receipt,setReceipt] = useState<Ticket|null>(null);
  const [policyJson,setPolicyJson] = useState('');
  const [policyConfirmed,setPolicyConfirmed] = useState(false);
  const selected = queue.data?.tickets.find((ticket) => ticket.id === selectedId);
  const payment = useMutation({mutationFn:async () => {
    if (!selected || !confirmed) throw new Error('Confirm actual disbursement and compliance review first');
    return scrapBuyingService.pay(selected,method,reference,permit);
  },onSuccess:(ticket) => { setReceipt(ticket); setSelectedId(null); toast.success('Payment acknowledged once; receipt copies do not pay again'); void queue.refetch(); onPaid?.(); }});
  const policyMutation = useMutation({mutationFn:async () => {
    if (!policyConfirmed) throw new Error('Compliance review confirmation is required');
    return scrapBuyingService.policy(JSON.parse(policyJson) as BuyingPolicy);
  },onSuccess:() => {toast.success('Reviewed policy version stored');setPolicyConfirmed(false);void queue.refetch();}});
  const loadPolicy = () => {
    const current = queue.data?.policy;
    const {version: _version,...policy} = current ?? {sourceUrl:'https://www.scstatehouse.gov/code/t16c017.php',effectiveFrom:'',effectiveThrough:'',reviewer:'',reviewReference:'',grades:storageService.getMetals().map((metal) => ({gradeId:metal.id,classification:'UNREVIEWED',approved:false,requirePermit:true,cashAtOrAboveCents:null,sellerDayCashLimitCents:null}))};
    setPolicyJson(JSON.stringify(policy,null,2));setPolicyConfirmed(false);
  };
  return <section className="space-y-4 rounded-2xl border border-emerald-800 bg-slate-900 p-4 text-white sm:p-6">
    {allowed && <LegacyBuyingReviewPanel/>}
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-xl font-bold"><Banknote className="text-emerald-300"/> Buying payments</h2><Button variant="outline" onClick={() => void queue.refetch()} className="rounded-xl border-slate-600 bg-slate-800 text-white">Refresh queue</Button></div>
    <p className="text-sm text-slate-200">Finalized purchases remain unpaid until actual cash disbursement or check issuance is acknowledged here. Historical tickets are excluded until reconciled; no payment status is inferred from legacy completion.</p>
    {queue.isError && <p role="alert" className="text-amber-200">{queue.error.message}</p>}
    {!queue.data?.policy && <p role="alert" className="rounded-xl border border-amber-600 bg-amber-950 p-3 text-sm text-amber-100">Payments are gated until an administrator records a current compliance-review policy. Yard cash preferences are not a substitute for South Carolina law.</p>}
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-slate-700 text-slate-300"><tr><th className="py-2">Ticket / seller</th><th>Stage</th><th>Amount</th><th>Next action</th></tr></thead><tbody>{(queue.data?.tickets ?? []).filter((ticket) => ['FINALIZED','PAID'].includes(ticket.buying?.stage ?? '')).map((ticket) => <tr key={ticket.id} className="border-b border-slate-800"><td className="py-3"><b>#{ticket.id}</b><p>{ticket.customerName}</p></td><td>{ticket.buying?.stage === 'PAID' ? `Paid · ${ticket.buying.payment?.method}` : 'Ready for payout · unpaid'}</td><td className="font-mono">${ticket.finalPayout.toFixed(2)}</td><td><Button onClick={() => {if(ticket.buying?.stage === 'PAID') setReceipt(ticket);else{setSelectedId(ticket.id);setReference('');setPermit('');setConfirmed(false);payment.reset();}}} disabled={ticket.buying?.stage !== 'PAID' && !allowed} className="rounded-xl bg-emerald-700 text-white hover:bg-emerald-600">{ticket.buying?.stage === 'PAID' ? 'Receipt copy' : 'Record payment'}</Button></td></tr>)}</tbody></table></div>
    {user?.role === 'admin' && <details className="rounded-xl border border-slate-700 p-3"><summary className="cursor-pointer font-semibold text-emerald-200">Versioned compliance policy · administrator setup</summary><p className="my-3 text-xs leading-relaxed text-amber-100">Configure only after the yard compliance reviewer/local authority or counsel has verified effective law, material classifications, permits/exemptions, payment/day limits, required records and retention. Unknown grades stay unapproved. No business override bypasses these checks. This limited policy model does not implement legal exemptions; where a permit is required it always requires a reviewed permit reference. Monetary fields are integer cents; null means no configured threshold, not a legal exemption. Existing stricter yard preferences remain separate.</p><Button onClick={loadPolicy} variant="outline" className="mb-3 rounded-xl border-slate-600 bg-slate-800 text-white">Load current policy / unapproved template</Button><Textarea aria-label="Compliance policy JSON" value={policyJson} onChange={(event) => {setPolicyJson(event.target.value);setPolicyConfirmed(false);}} rows={14} className="rounded-xl border-slate-600 bg-slate-950 font-mono text-xs text-white"/><label className="my-3 flex gap-2 text-xs"><input type="checkbox" checked={policyConfirmed} onChange={(event) => setPolicyConfirmed(event.target.checked)}/>I have the named reviewer’s confirmation and recorded source, effective dates, and review reference; this is not automatic legal certification.</label>{policyMutation.isError && <p role="alert" className="mb-2 text-sm text-amber-200">{policyMutation.error.message}</p>}<Button onClick={() => policyMutation.mutate()} disabled={!policyConfirmed || policyMutation.isPending} className="rounded-xl bg-emerald-700 text-white hover:bg-emerald-600">{policyMutation.isPending ? 'Saving version…' : 'Store reviewed policy version'}</Button></details>}
    <Dialog open={!!selectedId} onOpenChange={(open) => {if(!open && !payment.isPending)setSelectedId(null);}}><DialogContent className="rounded-2xl border-slate-700 bg-slate-950 text-white"><DialogHeader><DialogTitle className="flex gap-2"><ShieldCheck className="text-emerald-300"/>Actual payment · #{selected?.id}</DialogTitle><DialogDescription className="text-slate-200">{selected?.customerName} · ${selected?.finalPayout.toFixed(2)}. This records a real cash handover or issued check, not a print request.</DialogDescription></DialogHeader><div className="grid grid-cols-2 gap-2">{(['Cash','Check'] as const).map((value) => <Button key={value} onClick={() => setMethod(value)} disabled={payment.isPending} className={`rounded-xl ${method===value?'bg-emerald-700 text-white':'bg-slate-800 text-slate-100'}`}>{value}</Button>)}</div>{method==='Check' && <Input aria-label="Actual check reference" placeholder="Actual issued check reference" value={reference} onChange={(event) => setReference(event.target.value)} className="rounded-xl border-slate-600 bg-slate-900 text-white"/>}<Input aria-label="Required seller permit reference" placeholder="Seller permit reference, when required" value={permit} onChange={(event) => setPermit(event.target.value)} className="rounded-xl border-slate-600 bg-slate-900 text-white"/><p className="text-xs text-slate-200">Policy version: {queue.data?.policy?.version ?? 'Not configured'} · same-day checks use America/New_York. <Link to="/customers" className="text-emerald-300 underline">Seller registry</Link></p><label className="flex gap-2 rounded-xl border border-amber-700 bg-amber-950 p-3 text-xs text-amber-100"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)}/>I verified current ID/permit and applicable legal restrictions with the approved policy. Cash was actually handed over / this referenced check was actually issued.</label>{payment.isError && <p role="alert" className="text-amber-200">{payment.error.message} Refresh the queue if the result is uncertain; never disburse a second time.</p>}<Button onClick={() => payment.mutate()} disabled={!confirmed || !queue.data?.policy || payment.isPending || selected?.buying?.stage !== 'FINALIZED' || (method==='Check' && !reference.trim())} className="h-12 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500">{payment.isPending?'Awaiting server acknowledgement…':'Record actual payment once'}</Button></DialogContent></Dialog>
    <ReceiptModal ticket={receipt} open={!!receipt} onOpenChange={(open) => !open && setReceipt(null)}/>
  </section>;
}
