import React, { useMemo, useState } from 'react';
import { Ticket, YardSettings } from '@/types/scrap';
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
import { Printer, Landmark, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface CheckPrintModalProps {
  ticket: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Next sequential check number: seeds from settings, then continues past every number already stamped on a ticket. */
function getNextCheckNumber(settings: YardSettings, tickets: Ticket[]): number {
  const start = settings.bankInfo?.checkStartNumber ?? 1000;
  let max = start - 1;
  for (const t of tickets) {
    const n = t.checkNumber ? parseInt(t.checkNumber, 10) : NaN;
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

/**
 * Voucher-check printing for CHECK-payout tickets. One letter page: three
 * perforated stubs on top, then the check body with a MICR-style strip.
 * The check number is stamped onto the ticket (audit trail) the first time
 * the check is printed; reprints reuse the stamped number.
 */
export const CheckPrintModal: React.FC<CheckPrintModalProps> = ({ ticket, open, onOpenChange }) => {
  const settings = storageService.getSettings();
  const tickets = storageService.getTickets();
  const [printedNumber, setPrintedNumber] = useState<string | null>(null);

  const bank = settings.bankInfo;
  const checkNumber = useMemo(() => {
    if (!ticket) return '';
    if (ticket.checkNumber) return ticket.checkNumber;
    return String(getNextCheckNumber(settings, tickets));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.id, ticket?.checkNumber, open]);

  if (!ticket || !open) return null;

  const amountWords = (() => {
    try {
      return moneyToWords(ticket.finalPayout);
    } catch (err) {
      return err instanceof Error ? err.message : 'Amount out of range';
    }
  })();
  const amountInvalid = ticket.finalPayout < 0 || ticket.finalPayout > 999_999_999.99;

  const payee = ticket.customerName || 'BEARER';
  const dateStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const operator = ticket.operatorName || settings.operatorName;

  const handlePrint = () => {
    // Stamp the check number on the ticket's payout record for the audit trail.
    if (!ticket.checkNumber) {
      const stamped: Ticket = { ...ticket, checkNumber };
      storageService.saveTicket(stamped);
      setPrintedNumber(checkNumber);
      toast.success(`Check #${checkNumber} stamped on ticket #${ticket.id}`, {
        description: 'The number is now part of the payout audit trail.',
      });
    }
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
                Standard voucher check on one letter page — insert in your printer tray, print, then sign.
              </DialogDescription>
            </div>
            <Button
              onClick={handlePrint}
              disabled={amountInvalid}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              {ticket.checkNumber || printedNumber ? 'Reprint Check' : 'Print Check'}
            </Button>
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
                <span className="font-mono text-slate-900">Ticket #{ticket.id}</span>
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
          Check #{checkNumber} {ticket.checkNumber || printedNumber ? '(stamped on ticket)' : '(will be stamped on first print)'}
        </p>
      </DialogContent>
    </Dialog>
  );
};
