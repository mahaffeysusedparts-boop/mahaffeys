import React from 'react';
import { Ticket } from '@/types/scrap';
import { storageService } from '@/services/storageService';
import { moneyToWords } from '@/utils/moneyToWords';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NetworkPrintButton } from '@/components/settings/NetworkPrintButton';
import { Printer, Landmark, AlertTriangle } from 'lucide-react';

interface CheckPrintModalProps {
  ticket: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CheckPrintModal: React.FC<CheckPrintModalProps> = ({ ticket, open, onOpenChange }) => {
  const settings = storageService.getSettings();
  const bank = settings.bankInfo;
  const checkNumber = ticket?.buying?.payment?.checkReference ?? ticket?.checkNumber ?? '';

  if (!ticket || !open) return null;
  if (!checkNumber || (ticket.buying && (ticket.buying.stage !== 'PAID' || ticket.buying.payment?.method !== 'Check'))) return (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="rounded-2xl border-amber-500 bg-slate-950 text-white"><DialogHeader><DialogTitle>Check not issued</DialogTitle><DialogDescription className="text-amber-100">No issued check with a recorded number is available. Record the actual check number during payment; historical records are not changed by printing. Printing never pays a ticket.</DialogDescription></DialogHeader></DialogContent></Dialog>
  );

  const amountWords = (() => {
    try {
      return moneyToWords(ticket.finalPayout);
    } catch (err) {
      return err instanceof Error ? err.message : 'Amount out of range';
    }
  })();
  const amountInvalid = ticket.finalPayout < 0 || ticket.finalPayout > 999_999_999.99;

  const payee = ticket.customerName || 'BEARER';
  const dateStr = new Date(ticket.buying?.payment?.paidAt ?? ticket.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const operator = ticket.operatorName || settings.operatorName;

  const handlePrint = () => {
    setTimeout(() => window.print(), 150);
  };

  const renderStub = (label: string, value: string) => (
    <div className="px-2 py-1.5 text-center border-r border-dashed border-slate-400 last:border-r-0">
      <p className="text-[7px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="text-[10px] font-mono font-bold text-slate-900 truncate">{value}</p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-[760px] bg-slate-950 text-slate-100 border-slate-800 max-h-[90vh] overflow-y-auto printable-receipt-container">
        <DialogHeader className="border-b border-slate-800 pb-3 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Landmark className="w-5 h-5 text-emerald-400" /> Voucher Check — Ticket #{ticket.id}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 mt-0.5">
                Copy of the recorded issued check — printing does not issue a new check or record another payment.
              </DialogDescription>
            </div>
            <Button
              onClick={handlePrint}
              disabled={amountInvalid}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              Print issued check copy
            </Button>
            {!amountInvalid && <NetworkPrintButton kind="standard" rootSelector=".check-sheet" documentName={`check-${checkNumber}`} />}
          </div>
          {!bank && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-[11px] text-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <span>
                No bank details configured — the routing/account strip will print blank. Add them in
                Settings → Check &amp; Payout Printing.
              </span>
            </div>
          )}
          {amountInvalid && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-[11px] text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{amountWords} — correct the ticket payout before printing.</span>
            </div>
          )}
        </DialogHeader>

        {/* ── PRINTABLE CHECK ─────────────────────────────────────────── */}
        <div className="check-sheet bg-white text-black mx-auto w-full rounded-lg border border-slate-300 shadow-inner overflow-hidden print:rounded-none print:border-slate-900 print:shadow-none">
          {ticket.buying && <p className="border-b-2 border-slate-900 p-3 text-center text-lg font-black">DUPLICATE COPY · NOT A NEGOTIABLE CHECK<br/><span className="text-xs">Recorded payment {ticket.buying.payment?.id} · printing does not issue or pay again</span></p>}
          {/* Perforated voucher stubs */}
          <div className="grid grid-cols-3 border-b-2 border-dashed border-slate-500">
            {renderStub('Payer', settings.yardName)}
            {renderStub('Ticket #', ticket.id)}
            {renderStub('Amount', `$${ticket.finalPayout.toFixed(2)}`)}
          </div>

          {/* Check body */}
          <div className="p-5 sm:p-6 space-y-4">
            {/* Header row */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">
                  {settings.yardName}
                </h2>
                <p className="text-[9px] text-slate-600 leading-snug">
                  {settings.address}
                  {settings.address && settings.cityStateZip ? ', ' : ''}
                  {settings.cityStateZip}
                  {settings.phone ? ` · ${settings.phone}` : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Check No.</p>
                <p className="font-mono font-black text-lg text-slate-900">{checkNumber}</p>
              </div>
            </div>

            {/* Date + payee + amount */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-end gap-3 text-[11px]">
                <span className="font-bold text-slate-700 shrink-0">DATE</span>
                <span className="flex-1 border-b border-slate-500 pb-0.5 font-mono font-semibold text-slate-900">{dateStr}</span>
              </div>

              <div className="flex items-end gap-3 text-[11px]">
                <span className="font-bold text-slate-700 shrink-0">PAY TO THE ORDER OF</span>
                <span className="flex-1 border-b border-slate-500 pb-0.5 font-bold text-slate-900 truncate">{payee}</span>
                <span className="shrink-0 border border-slate-500 px-2 py-0.5 font-mono font-black text-[12px] text-slate-900">
                  ${ticket.finalPayout.toFixed(2)}
                </span>
              </div>

              <div className="flex items-end gap-2 text-[11px]">
                <span className="font-mono text-slate-700 shrink-0">$</span>
                <span className="flex-1 border-b border-slate-500 pb-0.5 font-semibold text-slate-900 uppercase">
                  {amountInvalid ? '— AMOUNT OUT OF RANGE —' : amountWords}
                </span>
              </div>
            </div>

            {/* Memo + signature */}
            <div className="flex items-end justify-between gap-6 pt-6">
              <div className="text-[10px]">
                <span className="font-bold text-slate-700">MEMO </span>
                <span className="font-mono text-slate-900">
                  Ticket #{ticket.id}
                  {ticket.ticketType === 'CAR_SALVAGE' && ticket.carRecord
                    ? ` · ${ticket.carRecord.vehicleWeightLbs.toLocaleString()} lb vehicle`
                    : ticket.scrapLines?.length
                      ? ` · ${ticket.scrapLines.reduce((acc, l) => acc + l.billableWeight, 0).toLocaleString()} lb scrap`
                      : ''}
                </span>
              </div>
              <div className="text-center min-w-[220px]">
                <div className="border-b border-slate-500 h-8" />
                <p className="text-[8px] font-bold uppercase tracking-widest text-slate-600 mt-0.5">
                  Authorized Signature — {settings.yardName}
                </p>
              </div>
            </div>

            {/* MICR-style strip */}
            <div className="mt-2 border-t border-dashed border-slate-400 pt-2 font-mono text-[10px] tracking-[0.25em] text-slate-800 text-center select-none">
              {bank ? (
                <>⑆ {bank.routingNumber || '········'} ⑆ &nbsp; {bank.accountNumber || '···········'} &nbsp; ⑈ {checkNumber} ⑈</>
              ) : (
                <>⑆ ········ ⑆ &nbsp; ············ &nbsp; ⑈ {checkNumber} ⑈</>
              )}
            </div>
          </div>
        </div>

        <p className="text-[10px] text-slate-500 text-center print:hidden">
          Paper: US Letter portrait · Perforated voucher stubs above the check body ·
          Check #{checkNumber} · recorded issued check copy
        </p>
      </DialogContent>
    </Dialog>
  );
};
