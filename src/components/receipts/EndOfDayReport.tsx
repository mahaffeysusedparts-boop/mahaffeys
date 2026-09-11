import React, { useMemo, useState } from 'react';
import { storageService } from '@/services/storageService';
import { Ticket, CashDrawerLog } from '@/types/scrap';
import { downloadCsv } from '@/utils/exportUtils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Printer, Download, ClipboardList } from 'lucide-react';

interface EndOfDayReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-filled yyyy-mm-dd (e.g. opened right after a closing audit). Defaults to today. */
  initialDate?: string;
}

function toLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayRange(ymd: string): { start: number; end: number } {
  const [y, m, d] = ymd.split('-').map(Number);
  return {
    start: new Date(y, m - 1, d).getTime(),
    end: new Date(y, m - 1, d + 1).getTime(),
  };
}

const inDay = (iso: string, range: { start: number; end: number }) => {
  const t = new Date(iso).getTime();
  return t >= range.start && t < range.end;
};

interface DaySummary {
  tickets: Ticket[];
  countsByType: Array<{ type: string; count: number; grossLbs: number; netLbs: number; payout: number }>;
  totalGrossLbs: number;
  totalNetLbs: number;
  totalPayout: number;
  payoutsByMethod: Array<{ method: string; count: number; total: number; checkNumbers: string[] }>;
  cash: {
    openingBalance: number;
    floats: number;
    replenishments: number;
    payouts: number;
    expectedClose: number;
    countedClose: number | null;
    discrepancy: number | null;
    auditedBy: string | null;
  };
  scale: { eventCount: number; addedLbs: number; removedLbs: number; totalCrossedLbs: number };
}

function buildSummary(ymd: string): DaySummary {
  const range = dayRange(ymd);
  const allTickets = storageService.getTickets();
  const allLogs = [...storageService.getCashDrawerLogs()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const allEvents = storageService.getScaleEvents();

  const tickets = allTickets.filter((t) => inDay(t.createdAt, range) && t.status !== 'VOIDED');

  const ticketLbs = (t: Ticket): { gross: number; net: number } => {
    if (t.ticketType === 'CAR_SALVAGE' && t.carRecord) {
      const w = t.carRecord.vehicleWeightLbs;
      return { gross: w, net: w };
    }
    const lines = t.scrapLines || [];
    return {
      gross: lines.reduce((acc, l) => acc + l.grossWeight, 0),
      net: lines.reduce((acc, l) => acc + l.netWeight, 0),
    };
  };

  const typeMap = new Map<string, { count: number; grossLbs: number; netLbs: number; payout: number }>();
  tickets.forEach((t) => {
    const w = ticketLbs(t);
    const entry = typeMap.get(t.ticketType) || { count: 0, grossLbs: 0, netLbs: 0, payout: 0 };
    entry.count += 1;
    entry.grossLbs += w.gross;
    entry.netLbs += w.net;
    entry.payout += t.finalPayout;
    typeMap.set(t.ticketType, entry);
  });

  const methodMap = new Map<string, { count: number; total: number; checkNumbers: string[] }>();
  tickets.forEach((t) => {
    const key = t.payoutMethod || 'Other';
    const entry = methodMap.get(key) || { count: 0, total: 0, checkNumbers: [] };
    entry.count += 1;
    entry.total += t.finalPayout;
    if (t.payoutMethod === 'Check' && t.checkNumber) entry.checkNumbers.push(t.checkNumber);
    methodMap.set(key, entry);
  });

  const ledger = allLogs.filter((l) => inDay(l.timestamp, range));
  const lastBefore = [...allLogs].reverse().find((l) => new Date(l.timestamp).getTime() < range.start);
  const openingBalance = lastBefore ? lastBefore.balanceAfter : 0;
  const sumType = (type: CashDrawerLog['type']) =>
    ledger.filter((l) => l.type === type).reduce((acc, l) => acc + l.amount, 0);

  const floats = sumType('OPENING_FLOAT');
  const replenishments = sumType('VAULT_REPLENISHMENT');
  const payouts = sumType('PAYOUT_DISBURSEMENT');
  const closingAudit = [...ledger].reverse().find((l) => l.type === 'CLOSING_AUDIT');

  const events = allEvents.filter((e) => inDay(e.detectedAt, range));
  const addedLbs = events.filter((e) => e.direction === 'ADDED').reduce((acc, e) => acc + e.deltaLbs, 0);
  const removedLbs = events.filter((e) => e.direction === 'REMOVED').reduce((acc, e) => acc + e.deltaLbs, 0);

  return {
    tickets,
    countsByType: [...typeMap.entries()].map(([type, v]) => ({ type, ...v })),
    totalGrossLbs: [...typeMap.values()].reduce((acc, v) => acc + v.grossLbs, 0),
    totalNetLbs: [...typeMap.values()].reduce((acc, v) => acc + v.netLbs, 0),
    totalPayout: tickets.reduce((acc, t) => acc + t.finalPayout, 0),
    payoutsByMethod: [...methodMap.entries()].map(([method, v]) => ({ method, ...v })),
    cash: {
      openingBalance,
      floats,
      replenishments,
      payouts,
      expectedClose: openingBalance + floats + replenishments + payouts,
      countedClose: closingAudit ? closingAudit.balanceAfter : null,
      discrepancy: closingAudit ? closingAudit.amount : null,
      auditedBy: closingAudit ? closingAudit.operatorName : null,
    },
    scale: {
      eventCount: events.length,
      addedLbs,
      removedLbs,
      totalCrossedLbs: addedLbs + removedLbs,
    },
  };
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const lbsFmt = (n: number) => `${Math.round(n).toLocaleString()} lb`;

/**
 * End-of-day (Z) report — printable + CSV-exportable summary of tickets,
 * payout mix, cash drawer reconciliation and scale activity for one day.
 */
export const EndOfDayReport: React.FC<EndOfDayReportProps> = ({ open, onOpenChange, initialDate }) => {
  const [ymd, setYmd] = useState(initialDate || toLocalYmd(new Date()));

  const summary = useMemo(() => (open ? buildSummary(ymd) : null), [ymd, open]);

  if (!open || !summary) return null;

  const settings = storageService.getSettings();
  const prettyDate = new Date(ymd + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const handleExportCsv = () => {
    const rows: Record<string, string | number>[] = [
      { section: 'HEADER', metric: 'Yard', value: settings.yardName },
      { section: 'HEADER', metric: 'Business day', value: prettyDate },
      ...summary.countsByType.map((r) => ({
        section: 'TICKETS',
        metric: r.type,
        value: `${r.count} tickets | gross ${lbsFmt(r.grossLbs)} | net ${lbsFmt(r.netLbs)} | ${money(r.payout)}`,
      })),
      { section: 'TICKETS', metric: 'TOTAL', value: `${summary.tickets.length} tickets | ${money(summary.totalPayout)}` },
      ...summary.payoutsByMethod.map((r) => ({
        section: 'PAYOUTS',
        metric: r.method,
        value: `${r.count} | ${money(r.total)}${r.checkNumbers.length ? ` | checks #${r.checkNumbers.join(', #')}` : ''}`,
      })),
      { section: 'CASH DRAWER', metric: 'Opening balance', value: money(summary.cash.openingBalance) },
      { section: 'CASH DRAWER', metric: 'Vault replenishments', value: money(summary.cash.replenishments) },
      { section: 'CASH DRAWER', metric: 'Cash payouts', value: money(summary.cash.payouts) },
      { section: 'CASH DRAWER', metric: 'Expected at close', value: money(summary.cash.expectedClose) },
      { section: 'CASH DRAWER', metric: 'Counted at close', value: summary.cash.countedClose !== null ? money(summary.cash.countedClose) : 'not audited' },
      { section: 'CASH DRAWER', metric: 'Discrepancy', value: summary.cash.discrepancy !== null ? money(summary.cash.discrepancy) : 'not audited' },
      { section: 'SCALE ACTIVITY', metric: 'Events', value: summary.scale.eventCount },
      { section: 'SCALE ACTIVITY', metric: 'Total LBS crossed', value: lbsFmt(summary.scale.totalCrossedLbs) },
    ];
    downloadCsv(`EndOfDay_${ymd}.csv`, rows);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-[720px] bg-slate-950 text-slate-100 border-slate-800 max-h-[90vh] overflow-y-auto printable-receipt-container">
        <DialogHeader className="border-b border-slate-800 pb-3 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-emerald-400" /> End-of-Day (Z) Report
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 mt-0.5">
                Daily close-out summary — tickets, payout mix, cash drawer reconciliation and scale traffic.
              </DialogDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={ymd}
                max={toLocalYmd(new Date())}
                onChange={(e) => setYmd(e.target.value || toLocalYmd(new Date()))}
                className="bg-slate-900 border-slate-800 text-white text-xs h-9 w-[150px]"
              />
              <Button onClick={handleExportCsv} variant="outline" size="sm" className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold">
                <Download className="w-4 h-4 mr-1.5" /> CSV
              </Button>
              <Button onClick={() => window.print()} size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
                <Printer className="w-4 h-4 mr-1.5" /> Print
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* ── PRINTABLE Z-REPORT SHEET ─────────────────────────────────── */}
        <div className="z-report-sheet bg-white text-black mx-auto w-full rounded-lg border border-slate-300 shadow-inner p-6 space-y-4 font-mono text-[11px] print:rounded-none print:border-slate-900 print:shadow-none">
          <div className="text-center border-b-2 border-black pb-2">
            <h2 className="text-base font-black uppercase tracking-tight">{settings.yardName}</h2>
            <p className="text-[10px] text-slate-700">{settings.address}{settings.address && settings.cityStateZip ? ', ' : ''}{settings.cityStateZip}</p>
            <p className="text-[12px] font-black uppercase mt-1">End-of-Day Z-Report — {prettyDate}</p>
          </div>

          {/* Tickets by type */}
          <section>
            <p className="font-black uppercase border-b border-slate-400 pb-0.5 mb-1">1 · Tickets</p>
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-slate-300 text-left">
                  <th className="py-0.5">Type</th>
                  <th className="py-0.5 text-right">Count</th>
                  <th className="py-0.5 text-right">Gross</th>
                  <th className="py-0.5 text-right">Net</th>
                  <th className="py-0.5 text-right">Payout</th>
                </tr>
              </thead>
              <tbody>
                {summary.countsByType.length === 0 && (
                  <tr><td className="py-1 text-slate-500" colSpan={5}>No tickets recorded this day.</td></tr>
                )}
                {summary.countsByType.map((r) => (
                  <tr key={r.type} className="border-b border-slate-200">
                    <td className="py-0.5 font-bold">{r.type}</td>
                    <td className="py-0.5 text-right">{r.count}</td>
                    <td className="py-0.5 text-right">{lbsFmt(r.grossLbs)}</td>
                    <td className="py-0.5 text-right">{lbsFmt(r.netLbs)}</td>
                    <td className="py-0.5 text-right">{money(r.payout)}</td>
                  </tr>
                ))}
                <tr className="font-black border-t border-slate-400">
                  <td className="py-1">TOTAL</td>
                  <td className="py-1 text-right">{summary.tickets.length}</td>
                  <td className="py-1 text-right">{lbsFmt(summary.totalGrossLbs)}</td>
                  <td className="py-1 text-right">{lbsFmt(summary.totalNetLbs)}</td>
                  <td className="py-1 text-right">{money(summary.totalPayout)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Payouts by method */}
          <section>
            <p className="font-black uppercase border-b border-slate-400 pb-0.5 mb-1">2 · Payouts by Method</p>
            <div className="space-y-0.5 text-[10px]">
              {summary.payoutsByMethod.length === 0 && <p className="text-slate-500">No payouts this day.</p>}
              {summary.payoutsByMethod.map((r) => (
                <div key={r.method} className="flex justify-between gap-4">
                  <span>
                    {r.method} ({r.count})
                    {r.checkNumbers.length > 0 && <span className="text-slate-600"> — checks #{r.checkNumbers.join(', #')}</span>}
                  </span>
                  <span className="font-bold">{money(r.total)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Cash drawer */}
          <section>
            <p className="font-black uppercase border-b border-slate-400 pb-0.5 mb-1">3 · Cash Drawer Ledger</p>
            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between"><span>Opening balance</span><span>{money(summary.cash.openingBalance)}</span></div>
              {summary.cash.floats !== 0 && (
                <div className="flex justify-between"><span>Opening float</span><span>{money(summary.cash.floats)}</span></div>
              )}
              <div className="flex justify-between"><span>Vault replenishments</span><span>{money(summary.cash.replenishments)}</span></div>
              <div className="flex justify-between"><span>Cash payouts out</span><span>{money(summary.cash.payouts)}</span></div>
              <div className="flex justify-between font-bold border-t border-slate-300 pt-0.5">
                <span>Expected drawer at close</span><span>{money(summary.cash.expectedClose)}</span>
              </div>
              <div className="flex justify-between">
                <span>Closing audit count{summary.cash.auditedBy ? ` (by ${summary.cash.auditedBy})` : ''}</span>
                <span>{summary.cash.countedClose !== null ? money(summary.cash.countedClose) : '— not audited —'}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Discrepancy</span>
                <span>
                  {summary.cash.discrepancy !== null
                    ? `${summary.cash.discrepancy >= 0 ? '+' : ''}${money(summary.cash.discrepancy)}`
                    : '—'}
                </span>
              </div>
            </div>
          </section>

          {/* Scale activity */}
          <section>
            <p className="font-black uppercase border-b border-slate-400 pb-0.5 mb-1">4 · Scale Activity</p>
            <div className="grid grid-cols-3 gap-2 text-[10px] text-center">
              <div className="border border-slate-300 rounded p-1.5">
                <p className="text-slate-600 text-[8px] uppercase tracking-wide">Events</p>
                <p className="font-black text-[13px]">{summary.scale.eventCount}</p>
              </div>
              <div className="border border-slate-300 rounded p-1.5">
                <p className="text-slate-600 text-[8px] uppercase tracking-wide">Added</p>
                <p className="font-black text-[13px]">{lbsFmt(summary.scale.addedLbs)}</p>
              </div>
              <div className="border border-slate-300 rounded p-1.5">
                <p className="text-slate-600 text-[8px] uppercase tracking-wide">Removed</p>
                <p className="font-black text-[13px]">{lbsFmt(summary.scale.removedLbs)}</p>
              </div>
            </div>
            <p className="text-[9px] text-slate-600 mt-1">Total traffic across platforms: {lbsFmt(summary.scale.totalCrossedLbs)}</p>
          </section>

          {/* Signatures */}
          <section className="border-t-2 border-black pt-3 grid grid-cols-2 gap-8 items-end">
            <div>
              <div className="h-10 border-b border-black" />
              <p className="text-[8px] font-black uppercase tracking-widest mt-1">Operator Signature</p>
              <p className="text-[8px] text-slate-600">{settings.operatorName || 'Operator'}</p>
            </div>
            <div>
              <div className="h-10 border-b border-black" />
              <p className="text-[8px] font-black uppercase tracking-widest mt-1">Manager Signature</p>
              <p className="text-[8px] text-slate-600">Reviewed &amp; balanced</p>
            </div>
          </section>

          <p className="text-center text-[8px] text-slate-600 border-t border-slate-300 pt-1.5">
            Printed {new Date().toLocaleString()} · {summary.tickets.length} ticket(s) · Generated by {settings.yardName} Paymaster System · Retain for records
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
