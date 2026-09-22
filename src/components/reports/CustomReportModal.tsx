import React, { useMemo, useState } from "react";
import { storageService } from "@/services/storageService";
import { CashDrawerLog, PullYardVehicle, ScaleWeightEvent, Ticket, YardBayLocation } from "@/types/scrap";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Printer, ScrollText } from "lucide-react";

type ReportType =
  | "ticket-ledger"
  | "material-summary"
  | "scale-activity"
  | "cash-drawer"
  | "top-sellers"
  | "grade-profitability"
  | "vehicle-aging"
  | "bay-status";
type RangeKey = "1" | "7" | "30" | "365" | "all";

interface CustomReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const REPORT_TYPES: Array<{ value: ReportType; label: string; defaultTitle: string }> = [
  { value: "ticket-ledger", label: "Ticket Ledger Detail", defaultTitle: "Ticket Ledger Detail Report" },
  { value: "material-summary", label: "Material & Payout Summary", defaultTitle: "Material & Payout Summary" },
  { value: "scale-activity", label: "Scale Traffic Journal", defaultTitle: "Scale Traffic Journal" },
  { value: "cash-drawer", label: "Cash Drawer Ledger", defaultTitle: "Cash Drawer Ledger Report" },
  { value: "top-sellers", label: "Top Sellers Leaderboard", defaultTitle: "Top Sellers Leaderboard" },
  { value: "grade-profitability", label: "Grade Profitability ($/lb)", defaultTitle: "Grade Profitability Report" },
  { value: "vehicle-aging", label: "Vehicle Inventory Aging", defaultTitle: "Pull-a-Part Inventory Aging" },
  { value: "bay-status", label: "Yard Bay Fill Status", defaultTitle: "Yard Bay Fill Status Report" },
];

const RANGE_LABELS: Record<RangeKey, string> = {
  "1": "Today",
  "7": "Last 7 days",
  "30": "Last 30 days",
  "365": "Year to date",
  all: "All time",
};

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const lbsFmt = (n: number) => `${Math.round(n).toLocaleString()} lb`;

const ticketLbs = (t: Ticket): number =>
  t.ticketType === "CAR_SALVAGE" && t.carRecord
    ? t.carRecord.vehicleWeightLbs
    : (t.scrapLines || []).reduce((acc, l) => acc + l.billableWeight, 0);

function rangeStart(range: RangeKey): number {
  if (range === "all") return 0;
  const days = Number(range);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start.getTime();
}

const inRange = (iso: string, since: number) => new Date(iso).getTime() >= since;

/** Custom printable report builder — choose a dataset, period, title and notes,
 *  preview the live 8.5×11 letter sheet, then print it. */
export const CustomReportModal: React.FC<CustomReportModalProps> = ({ open, onOpenChange }) => {
  const [type, setType] = useState<ReportType>("ticket-ledger");
  const [range, setRange] = useState<RangeKey>("30");
  const [title, setTitle] = useState(REPORT_TYPES[0].defaultTitle);
  const [notes, setNotes] = useState("");

  const since = rangeStart(range);

  const data = useMemo(() => {
    const tickets = storageService
      .getTickets()
      .filter((t) => t.status !== "VOIDED" && inRange(t.createdAt, since))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const events = storageService
      .getScaleEvents()
      .filter((e: ScaleWeightEvent) => inRange(e.detectedAt, since))
      .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
    const cashLogs = storageService
      .getCashDrawerLogs()
      .filter((l: CashDrawerLog) => inRange(l.timestamp, since))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const vehicles = storageService
      .getPullYardVehicles()
      .filter((v: PullYardVehicle) => v.status !== "CRUSHED" && inRange(v.dateSetInYard, since))
      .sort((a, b) => a.dateSetInYard.localeCompare(b.dateSetInYard));
    const bays = storageService
      .getYardBays()
      .slice()
      .sort((a: YardBayLocation, b: YardBayLocation) => (b.currentLbs / Math.max(1, b.capacityLbs)) - (a.currentLbs / Math.max(1, a.capacityLbs)));
    return { tickets, events, cashLogs, vehicles, bays };
  }, [since, open]);

  if (!open) return null;

  const settings = storageService.getSettings();
  const periodLabel = RANGE_LABELS[range];
  const generatedAt = new Date().toLocaleString();

  const handleTypeChange = (next: string) => {
    const found = REPORT_TYPES.find((r) => r.value === next);
    if (!found) return;
    setType(found.value);
    setTitle(found.defaultTitle);
  };

  /* ── Sheet sections per report type ─────────────────────────────── */

  const ledgerRows = data.tickets;
  const ledgerTotals = ledgerRows.reduce(
    (acc, t) => ({ lbs: acc.lbs + ticketLbs(t), payout: acc.payout + t.finalPayout }),
    { lbs: 0, payout: 0 },
  );

  const materialRows = data.tickets
    .flatMap((t) => t.scrapLines || [])
    .reduce<Record<string, { name: string; category: string; lbs: number; payout: number }>>(
      (result, line) => {
        const key = `${line.metalCategory}::${line.metalName}`;
        const entry = result[key] || {
          name: line.metalName,
          category: line.metalCategory,
          lbs: 0,
          payout: 0,
        };
        entry.lbs += line.billableWeight;
        entry.payout += line.lineTotal;
        result[key] = entry;
        return result;
      },
      {},
    );
  const materialList = Object.values(materialRows).sort((a, b) => b.payout - a.payout);
  const materialTotals = materialList.reduce(
    (acc, m) => ({ lbs: acc.lbs + m.lbs, payout: acc.payout + m.payout }),
    { lbs: 0, payout: 0 },
  );

  const platformRows = data.tickets
    .flatMap((t) => t.weightTransactions || [])
    .reduce<Record<string, { name: string; scaleIn: number; scaleOut: number }>>(
      (result, tx) => {
        const name = tx.scaleName || "Unstamped";
        const entry = result[name] || { name, scaleIn: 0, scaleOut: 0 };
        if (tx.type === "SCALE_IN") entry.scaleIn += 1;
        else entry.scaleOut += 1;
        result[name] = entry;
        return result;
      },
      {},
    );
  const platformList = Object.values(platformRows).sort(
    (a, b) => b.scaleIn + b.scaleOut - (a.scaleIn + a.scaleOut),
  );
  const scaleAdded = data.events
    .filter((e) => e.direction === "ADDED")
    .reduce((acc, e) => acc + e.deltaLbs, 0);
  const scaleRemoved = data.events
    .filter((e) => e.direction === "REMOVED")
    .reduce((acc, e) => acc + e.deltaLbs, 0);

  const cashPayouts = data.cashLogs
    .filter((l) => l.type === "PAYOUT_DISBURSEMENT")
    .reduce((acc, l) => acc + l.amount, 0);
  const cashReplenish = data.cashLogs
    .filter((l) => l.type === "VAULT_REPLENISHMENT")
    .reduce((acc, l) => acc + l.amount, 0);
  const closingBalance = data.cashLogs.length
    ? data.cashLogs[data.cashLogs.length - 1].balanceAfter
    : 0;

  /* Top sellers — relationship value ranked by total payout. */
  const sellerList = data.tickets
    .reduce<Record<string, { name: string; tickets: number; lbs: number; payout: number; last: string }>>(
      (result, ticket) => {
        const name = ticket.customerName || "Unknown seller";
        const entry = result[name] || { name, tickets: 0, lbs: 0, payout: 0, last: ticket.createdAt };
        entry.tickets += 1;
        entry.lbs += ticketLbs(ticket);
        entry.payout += ticket.finalPayout;
        if (ticket.createdAt > entry.last) entry.last = ticket.createdAt;
        result[name] = entry;
        return result;
      },
      {},
    );
  const sellers = Object.values(sellerList).sort((a, b) => b.payout - a.payout);
  const sellerTotals = sellers.reduce(
    (acc, seller) => ({ tickets: acc.tickets + seller.tickets, lbs: acc.lbs + seller.lbs, payout: acc.payout + seller.payout }),
    { tickets: 0, lbs: 0, payout: 0 },
  );

  /* Grade profitability — $/lb per grade off the material rollup. */
  const gradeList = materialList
    .map((material) => ({ ...material, perLb: material.lbs > 0 ? material.payout / material.lbs : 0 }))
    .sort((a, b) => b.payout - a.payout);

  /* Vehicle aging — days on yard plus hold buckets. */
  const vehicleRows = data.vehicles.map((vehicle) => ({
    vehicle,
    daysOnYard: Math.max(0, Math.floor((Date.now() - new Date(vehicle.dateSetInYard).getTime()) / 86400000)),
  }));
  const agingBuckets = vehicleRows.reduce(
    (acc, row) => {
      if (row.daysOnYard <= 30) acc.to30 += 1;
      else if (row.daysOnYard <= 60) acc.to60 += 1;
      else if (row.daysOnYard <= 90) acc.to90 += 1;
      else acc.over90 += 1;
      return acc;
    },
    { to30: 0, to60: 0, to90: 0, over90: 0 },
  );
  const avgDaysOnYard = vehicleRows.length
    ? Math.round(vehicleRows.reduce((total, row) => total + row.daysOnYard, 0) / vehicleRows.length)
    : 0;

  /* Yard bay fill snapshot. */
  const bayTotals = data.bays.reduce(
    (acc, bay) => ({
      capacity: acc.capacity + bay.capacityLbs,
      current: acc.current + bay.currentLbs,
      value: acc.value + bay.estValueUsd,
    }),
    { capacity: 0, current: 0, value: 0 },
  );
  const criticalBays = data.bays.filter((bay) => bay.status === "CRITICAL_FULL").length;

  const kpiSets: Record<ReportType, Array<{ label: string; value: string }>> = {
    "ticket-ledger": [
      { label: "Tickets", value: String(ledgerRows.length) },
      { label: "Total payout", value: money(ledgerTotals.payout) },
      { label: "Total weight", value: lbsFmt(ledgerTotals.lbs) },
    ],
    "material-summary": [
      { label: "Materials", value: String(materialList.length) },
      { label: "Payout", value: money(materialTotals.payout) },
      { label: "Billable weight", value: lbsFmt(materialTotals.lbs) },
    ],
    "scale-activity": [
      { label: "Journal events", value: String(data.events.length) },
      { label: "LBS on", value: lbsFmt(scaleAdded) },
      { label: "LBS off", value: lbsFmt(scaleRemoved) },
    ],
    "cash-drawer": [
      { label: "Ledger entries", value: String(data.cashLogs.length) },
      { label: "Cash payouts", value: money(cashPayouts) },
      { label: "Current balance", value: money(closingBalance) },
    ],
    "top-sellers": [
      { label: "Sellers", value: String(sellers.length) },
      { label: "Combined payout", value: money(sellerTotals.payout) },
      { label: "Tickets", value: String(sellerTotals.tickets) },
    ],
    "grade-profitability": [
      { label: "Grades", value: String(gradeList.length) },
      { label: "Payout", value: money(materialTotals.payout) },
      { label: "Avg $/lb", value: materialTotals.lbs > 0 ? `$${(materialTotals.payout / materialTotals.lbs).toFixed(3)}` : "—" },
    ],
    "vehicle-aging": [
      { label: "Vehicles on yard", value: String(vehicleRows.length) },
      { label: "Avg days on yard", value: String(avgDaysOnYard) },
      { label: "Over 60 days", value: String(agingBuckets.to90 + agingBuckets.over90) },
    ],
    "bay-status": [
      { label: "Bays", value: String(data.bays.length) },
      { label: "Est. value", value: money(bayTotals.value) },
      { label: "Critical full", value: String(criticalBays) },
    ],
  };

  const kpis = kpiSets[type];

  const cashTypeLabels: Record<CashDrawerLog["type"], string> = {
    OPENING_FLOAT: "Opening float",
    PAYOUT_DISBURSEMENT: "Payout out",
    VAULT_REPLENISHMENT: "Vault replenish",
    CLOSING_AUDIT: "Closing audit",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="printable-receipt-container w-[calc(100%-1.5rem)] sm:max-w-[920px] bg-slate-950 text-slate-100 border-slate-800 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-slate-800 pb-3 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" /> Custom Printable Report
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 mt-0.5">
                Build a letter-size (8.5×11) report — pick a dataset, period and title, then print.
              </DialogDescription>
            </div>
            <Button
              onClick={() => window.print()}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              <Printer className="w-4 h-4 mr-1.5" /> Print Report
            </Button>
          </div>
        </DialogHeader>

        {/* ── BUILDER PANEL ─────────────────────────────────────────── */}
        <div className="grid gap-5 md:grid-cols-[260px_minmax(0,1fr)] print:block">
          <div className="space-y-4 print:hidden">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Report dataset</Label>
              <Select value={type} onValueChange={handleTypeChange}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white text-xs h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-white">
                  {REPORT_TYPES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Period</Label>
              <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white text-xs h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-white">
                  {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {RANGE_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Custom title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                className="bg-slate-900 border-slate-700 text-white text-xs h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Footer notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={300}
                placeholder="e.g. Prepared for the quarterly audit review…"
                className="bg-slate-900 border-slate-700 text-white text-xs min-h-[70px]"
              />
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-[11px] text-slate-400 leading-relaxed">
              <p className="font-bold text-slate-300 mb-1">Printing tips</p>
              Long tables flow onto extra letter pages automatically, with column headers repeated
              on every page. Margins are preset — choose <span className="text-white">Letter</span>{" "}
              and <span className="text-white">Default margins</span> in the print dialog.
            </div>
          </div>

          {/* ── LIVE LETTER-SHEET PREVIEW ──────────────────────────── */}
          <div className="custom-report-sheet bg-white text-black mx-auto w-full rounded-lg border border-slate-300 shadow-inner p-6 space-y-4 font-mono text-[11px] print:rounded-none print:border-slate-900 print:shadow-none">
            {/* Masthead */}
            <div className="text-center border-b-2 border-black pb-2">
              <h2 className="text-base font-black uppercase tracking-tight">{settings.yardName}</h2>
              <p className="text-[10px] text-slate-700">
                {settings.address}
                {settings.address && settings.cityStateZip ? ", " : ""}
                {settings.cityStateZip}
                {settings.licenseNumber ? ` · Lic #${settings.licenseNumber}` : ""}
              </p>
              <p className="text-[12px] font-black uppercase mt-1">{title || "Custom Report"}</p>
              <p className="text-[10px] text-slate-700">
                Period: {periodLabel} · Generated {generatedAt}
              </p>
            </div>

            {/* KPI strip */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {kpis.map((kpi) => (
                <div key={kpi.label} className="border border-slate-300 rounded p-1.5">
                  <p className="text-slate-600 text-[8px] uppercase tracking-wide">{kpi.label}</p>
                  <p className="font-black text-[13px]">{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Ticket ledger table */}
            {type === "ticket-ledger" && (
              <section>
                <p className="font-black uppercase border-b border-slate-400 pb-0.5 mb-1 flex items-center gap-1.5">
                  <ScrollText className="w-3.5 h-3.5" /> Ticket Detail
                </p>
                <table className="w-full text-[9px]">
                  <thead>
                    <tr className="border-b border-slate-400 text-left">
                      <th className="py-0.5">Date / Time</th>
                      <th className="py-0.5">Ticket #</th>
                      <th className="py-0.5">Type</th>
                      <th className="py-0.5">Seller</th>
                      <th className="py-0.5">Method</th>
                      <th className="py-0.5 text-right">Billable LBS</th>
                      <th className="py-0.5 text-right">Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerRows.length === 0 && (
                      <tr>
                        <td className="py-1 text-slate-500" colSpan={7}>
                          No tickets recorded in this period.
                        </td>
                      </tr>
                    )}
                    {ledgerRows.map((t) => (
                      <tr key={t.id} className="border-b border-slate-200">
                        <td className="py-0.5">
                          {new Date(t.createdAt).toLocaleString([], {
                            month: "numeric",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-0.5 font-bold">#{t.id}</td>
                        <td className="py-0.5">{t.ticketType.replace(/_/g, " ")}</td>
                        <td className="py-0.5 truncate max-w-[1.6in]">{t.customerName}</td>
                        <td className="py-0.5">{t.payoutMethod}</td>
                        <td className="py-0.5 text-right">{ticketLbs(t).toLocaleString()}</td>
                        <td className="py-0.5 text-right font-bold">{money(t.finalPayout)}</td>
                      </tr>
                    ))}
                    {ledgerRows.length > 0 && (
                      <tr className="font-black border-t border-slate-400">
                        <td className="py-1" colSpan={5}>
                          TOTAL — {ledgerRows.length} ticket(s)
                        </td>
                        <td className="py-1 text-right">{ledgerTotals.lbs.toLocaleString()}</td>
                        <td className="py-1 text-right">{money(ledgerTotals.payout)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            )}

            {/* Material payout summary table */}
            {type === "material-summary" && (
              <section>
                <p className="font-black uppercase border-b border-slate-400 pb-0.5 mb-1">
                  Payout by Material
                </p>
                <table className="w-full text-[9px]">
                  <thead>
                    <tr className="border-b border-slate-400 text-left">
                      <th className="py-0.5">Category</th>
                      <th className="py-0.5">Material</th>
                      <th className="py-0.5 text-right">Billable LBS</th>
                      <th className="py-0.5 text-right">Payout</th>
                      <th className="py-0.5 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialList.length === 0 && (
                      <tr>
                        <td className="py-1 text-slate-500" colSpan={5}>
                          No weighed material lines recorded in this period.
                        </td>
                      </tr>
                    )}
                    {materialList.map((m) => (
                      <tr
                        key={`${m.category}-${m.name}`}
                        className="border-b border-slate-200"
                      >
                        <td className="py-0.5">{m.category}</td>
                        <td className="py-0.5 font-bold">{m.name}</td>
                        <td className="py-0.5 text-right">{m.lbs.toLocaleString()}</td>
                        <td className="py-0.5 text-right font-bold">{money(m.payout)}</td>
                        <td className="py-0.5 text-right">
                          {materialTotals.payout > 0
                            ? `${((m.payout / materialTotals.payout) * 100).toFixed(1)}%`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                    {materialList.length > 0 && (
                      <tr className="font-black border-t border-slate-400">
                        <td className="py-1" colSpan={2}>
                          TOTAL — {materialList.length} material(s)
                        </td>
                        <td className="py-1 text-right">{materialTotals.lbs.toLocaleString()}</td>
                        <td className="py-1 text-right">{money(materialTotals.payout)}</td>
                        <td className="py-1 text-right">100%</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            )}

            {/* Scale traffic journal */}
            {type === "scale-activity" && (
              <>
                <section>
                  <p className="font-black uppercase border-b border-slate-400 pb-0.5 mb-1">
                    Journal Events (newest first)
                  </p>
                  <table className="w-full text-[9px]">
                    <thead>
                      <tr className="border-b border-slate-400 text-left">
                        <th className="py-0.5">Time</th>
                        <th className="py-0.5">Platform</th>
                        <th className="py-0.5">Direction</th>
                        <th className="py-0.5 text-right">Delta LBS</th>
                        <th className="py-0.5 text-right">Gross After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.events.length === 0 && (
                        <tr>
                          <td className="py-1 text-slate-500" colSpan={5}>
                            No platform activity recorded in this period.
                          </td>
                        </tr>
                      )}
                      {data.events.slice(0, 200).map((e) => (
                        <tr key={e.id} className="border-b border-slate-200">
                          <td className="py-0.5">
                            {new Date(e.detectedAt).toLocaleString([], {
                              month: "numeric",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-0.5 font-bold">{e.scaleName}</td>
                          <td className="py-0.5 font-bold">{e.direction === "ADDED" ? "ON" : "OFF"}</td>
                          <td className="py-0.5 text-right">{e.deltaLbs.toLocaleString()}</td>
                          <td className="py-0.5 text-right">{e.grossAfterLbs.toLocaleString()}</td>
                        </tr>
                      ))}
                      {data.events.length > 200 && (
                        <tr className="text-slate-600">
                          <td className="py-1" colSpan={5}>
                            … {data.events.length - 200} earlier event(s) omitted from this report.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </section>
                <section>
                  <p className="font-black uppercase border-b border-slate-400 pb-0.5 mb-1">
                    Audit-Stamped Readings by Platform
                  </p>
                  <table className="w-full text-[9px]">
                    <thead>
                      <tr className="border-b border-slate-400 text-left">
                        <th className="py-0.5">Platform</th>
                        <th className="py-0.5 text-right">SCALE_IN</th>
                        <th className="py-0.5 text-right">SCALE_OUT</th>
                        <th className="py-0.5 text-right">Total readings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {platformList.length === 0 && (
                        <tr>
                          <td className="py-1 text-slate-500" colSpan={4}>
                            Stamped readings appear once weighings record a platform name.
                          </td>
                        </tr>
                      )}
                      {platformList.map((p) => (
                        <tr key={p.name} className="border-b border-slate-200">
                          <td className="py-0.5 font-bold">{p.name}</td>
                          <td className="py-0.5 text-right">{p.scaleIn}</td>
                          <td className="py-0.5 text-right">{p.scaleOut}</td>
                          <td className="py-0.5 text-right font-bold">{p.scaleIn + p.scaleOut}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              </>
            )}

            {/* Cash drawer ledger */}
            {type === "cash-drawer" && (
              <>
                <section>
                  <p className="font-black uppercase border-b border-slate-400 pb-0.5 mb-1">
                    Drawer Activity (newest first)
                  </p>
                  <table className="w-full text-[9px]">
                    <thead>
                      <tr className="border-b border-slate-400 text-left">
                        <th className="py-0.5">Time</th>
                        <th className="py-0.5">Entry</th>
                        <th className="py-0.5">Operator</th>
                        <th className="py-0.5 text-right">Amount</th>
                        <th className="py-0.5 text-right">Balance After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.cashLogs.length === 0 && (
                        <tr>
                          <td className="py-1 text-slate-500" colSpan={5}>
                            No drawer activity recorded in this period.
                          </td>
                        </tr>
                      )}
                      {data.cashLogs.map((l) => (
                        <tr key={l.id} className="border-b border-slate-200">
                          <td className="py-0.5">
                            {new Date(l.timestamp).toLocaleString([], {
                              month: "numeric",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-0.5 font-bold">{cashTypeLabels[l.type]}</td>
                          <td className="py-0.5">{l.operatorName}</td>
                          <td className="py-0.5 text-right">
                            {l.type === "PAYOUT_DISBURSEMENT" ? "-" : "+"}
                            {money(l.amount)}
                          </td>
                          <td className="py-0.5 text-right font-bold">{money(l.balanceAfter)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
                <section className="grid grid-cols-3 gap-2 text-center">
                  <div className="border border-slate-300 rounded p-1.5">
                    <p className="text-slate-600 text-[8px] uppercase tracking-wide">Cash payouts</p>
                    <p className="font-black text-[13px]">{money(cashPayouts)}</p>
                  </div>
                  <div className="border border-slate-300 rounded p-1.5">
                    <p className="text-slate-600 text-[8px] uppercase tracking-wide">Replenishments</p>
                    <p className="font-black text-[13px]">{money(cashReplenish)}</p>
                  </div>
                  <div className="border border-slate-300 rounded p-1.5">
                    <p className="text-slate-600 text-[8px] uppercase tracking-wide">
                      Latest balance
                    </p>
                    <p className="font-black text-[13px]">{money(closingBalance)}</p>
                  </div>
                </section>
              </>
            )}

            {/* Top sellers leaderboard */}
            {type === "top-sellers" && (
              <section>
                <p className="font-black uppercase border-b border-slate-400 pb-0.5 mb-1">
                  Top Sellers (ranked by payout)
                </p>
                <table className="w-full text-[9px]">
                  <thead>
                    <tr className="border-b border-slate-400 text-left">
                      <th className="py-0.5">#</th>
                      <th className="py-0.5">Seller</th>
                      <th className="py-0.5 text-right">Tickets</th>
                      <th className="py-0.5 text-right">Total LBS</th>
                      <th className="py-0.5 text-right">Payout</th>
                      <th className="py-0.5 text-right">Last Visit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellers.length === 0 && (
                      <tr>
                        <td className="py-1 text-slate-500" colSpan={6}>
                          No completed tickets recorded in this period.
                        </td>
                      </tr>
                    )}
                    {sellers.slice(0, 60).map((seller, index) => (
                      <tr key={seller.name} className="border-b border-slate-200">
                        <td className="py-0.5 font-black">{index + 1}</td>
                        <td className="py-0.5 font-bold truncate max-w-[2.2in]">{seller.name}</td>
                        <td className="py-0.5 text-right">{seller.tickets}</td>
                        <td className="py-0.5 text-right">{Math.round(seller.lbs).toLocaleString()}</td>
                        <td className="py-0.5 text-right font-bold">{money(seller.payout)}</td>
                        <td className="py-0.5 text-right">{new Date(seller.last).toLocaleDateString()}</td>
                      </tr>
                    ))}
                    {sellers.length > 60 && (
                      <tr className="text-slate-600">
                        <td className="py-1" colSpan={6}>
                          … {sellers.length - 60} additional seller(s) omitted from this sheet.
                        </td>
                      </tr>
                    )}
                    {sellers.length > 0 && (
                      <tr className="font-black border-t border-slate-400">
                        <td className="py-1" colSpan={2}>TOTAL — {sellers.length} seller(s)</td>
                        <td className="py-1 text-right">{sellerTotals.tickets}</td>
                        <td className="py-1 text-right">{Math.round(sellerTotals.lbs).toLocaleString()}</td>
                        <td className="py-1 text-right">{money(sellerTotals.payout)}</td>
                        <td />
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            )}

            {/* Grade profitability */}
            {type === "grade-profitability" && (
              <section>
                <p className="font-black uppercase border-b border-slate-400 pb-0.5 mb-1">
                  Grade Profitability
                </p>
                <table className="w-full text-[9px]">
                  <thead>
                    <tr className="border-b border-slate-400 text-left">
                      <th className="py-0.5">Category</th>
                      <th className="py-0.5">Grade</th>
                      <th className="py-0.5 text-right">Billable LBS</th>
                      <th className="py-0.5 text-right">Payout</th>
                      <th className="py-0.5 text-right">$ / LBS</th>
                      <th className="py-0.5 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradeList.length === 0 && (
                      <tr>
                        <td className="py-1 text-slate-500" colSpan={6}>
                          No weighed material lines recorded in this period.
                        </td>
                      </tr>
                    )}
                    {gradeList.map((grade) => (
                      <tr key={`${grade.category}-${grade.name}`} className="border-b border-slate-200">
                        <td className="py-0.5">{grade.category}</td>
                        <td className="py-0.5 font-bold">{grade.name}</td>
                        <td className="py-0.5 text-right">{grade.lbs.toLocaleString()}</td>
                        <td className="py-0.5 text-right font-bold">{money(grade.payout)}</td>
                        <td className="py-0.5 text-right font-black">${grade.perLb.toFixed(3)}</td>
                        <td className="py-0.5 text-right">
                          {materialTotals.payout > 0 ? `${((grade.payout / materialTotals.payout) * 100).toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                    {gradeList.length > 0 && (
                      <tr className="font-black border-t border-slate-400">
                        <td className="py-1" colSpan={2}>TOTAL — {gradeList.length} grade(s)</td>
                        <td className="py-1 text-right">{materialTotals.lbs.toLocaleString()}</td>
                        <td className="py-1 text-right">{money(materialTotals.payout)}</td>
                        <td className="py-1 text-right">
                          {materialTotals.lbs > 0 ? `$${(materialTotals.payout / materialTotals.lbs).toFixed(3)}` : "—"}
                        </td>
                        <td className="py-1 text-right">100%</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            )}

            {/* Vehicle inventory aging */}
            {type === "vehicle-aging" && (
              <>
                <section className="grid grid-cols-4 gap-2 text-center">
                  <div className="border border-slate-300 rounded p-1.5">
                    <p className="text-slate-600 text-[8px] uppercase tracking-wide">0–30 days</p>
                    <p className="font-black text-[13px]">{agingBuckets.to30}</p>
                  </div>
                  <div className="border border-slate-300 rounded p-1.5">
                    <p className="text-slate-600 text-[8px] uppercase tracking-wide">31–60 days</p>
                    <p className="font-black text-[13px]">{agingBuckets.to60}</p>
                  </div>
                  <div className="border border-slate-300 rounded p-1.5">
                    <p className="text-slate-600 text-[8px] uppercase tracking-wide">61–90 days</p>
                    <p className="font-black text-[13px]">{agingBuckets.to90}</p>
                  </div>
                  <div className="border border-slate-300 rounded p-1.5">
                    <p className="text-slate-600 text-[8px] uppercase tracking-wide">90+ days</p>
                    <p className="font-black text-[13px]">{agingBuckets.over90}</p>
                  </div>
                </section>
                <section>
                  <p className="font-black uppercase border-b border-slate-400 pb-0.5 mb-1">
                    Vehicles On Yard (oldest first)
                  </p>
                  <table className="w-full text-[9px]">
                    <thead>
                      <tr className="border-b border-slate-400 text-left">
                        <th className="py-0.5">Set In Yard</th>
                        <th className="py-0.5">Days</th>
                        <th className="py-0.5">Vehicle</th>
                        <th className="py-0.5">VIN (tail)</th>
                        <th className="py-0.5">Section / Row</th>
                        <th className="py-0.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehicleRows.length === 0 && (
                        <tr>
                          <td className="py-1 text-slate-500" colSpan={6}>
                            No vehicles set in the yard in this period.
                          </td>
                        </tr>
                      )}
                      {vehicleRows.slice(0, 200).map(({ vehicle, daysOnYard }) => (
                        <tr key={vehicle.id} className="border-b border-slate-200">
                          <td className="py-0.5">{new Date(vehicle.dateSetInYard).toLocaleDateString()}</td>
                          <td className={`py-0.5 text-right font-bold ${daysOnYard > 60 ? "text-black underline" : ""}`}>{daysOnYard}</td>
                          <td className="py-0.5 font-bold truncate max-w-[1.8in]">{vehicle.year} {vehicle.make} {vehicle.model}</td>
                          <td className="py-0.5">…{vehicle.vin.slice(-6)}</td>
                          <td className="py-0.5 truncate max-w-[1.4in]">{vehicle.section}{vehicle.rowNumber ? ` / ${vehicle.rowNumber}` : ""}</td>
                          <td className="py-0.5 font-bold">{vehicle.status.replace("_", " ")}</td>
                        </tr>
                      ))}
                      {vehicleRows.length > 200 && (
                        <tr className="text-slate-600">
                          <td className="py-1" colSpan={6}>
                            … {vehicleRows.length - 200} additional vehicle(s) omitted from this sheet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </section>
              </>
            )}

            {/* Yard bay fill status */}
            {type === "bay-status" && (
              <section>
                <p className="font-black uppercase border-b border-slate-400 pb-0.5 mb-1">
                  Yard Bay Fill Status (live snapshot)
                </p>
                <table className="w-full text-[9px]">
                  <thead>
                    <tr className="border-b border-slate-400 text-left">
                      <th className="py-0.5">Bay</th>
                      <th className="py-0.5">Type</th>
                      <th className="py-0.5 text-right">Capacity LBS</th>
                      <th className="py-0.5 text-right">Current LBS</th>
                      <th className="py-0.5 text-right">Fill</th>
                      <th className="py-0.5 text-right">Est. Value</th>
                      <th className="py-0.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bays.length === 0 && (
                      <tr>
                        <td className="py-1 text-slate-500" colSpan={7}>
                          No yard bays configured yet.
                        </td>
                      </tr>
                    )}
                    {data.bays.map((bay) => {
                      const fill = bay.capacityLbs > 0 ? Math.min(100, Math.round((bay.currentLbs / bay.capacityLbs) * 100)) : 0;
                      return (
                        <tr key={bay.id} className="border-b border-slate-200">
                          <td className="py-0.5 font-bold">{bay.bayName}</td>
                          <td className="py-0.5">{bay.categoryType.replace(/_/g, " ")}</td>
                          <td className="py-0.5 text-right">{bay.capacityLbs.toLocaleString()}</td>
                          <td className="py-0.5 text-right">{bay.currentLbs.toLocaleString()}</td>
                          <td className="py-0.5 text-right font-bold">{fill}%</td>
                          <td className="py-0.5 text-right">{money(bay.estValueUsd)}</td>
                          <td className="py-0.5 font-bold">{bay.status.replace("_", " ")}</td>
                        </tr>
                      );
                    })}
                    {data.bays.length > 0 && (
                      <tr className="font-black border-t border-slate-400">
                        <td className="py-1" colSpan={2}>TOTAL — {data.bays.length} bay(s)</td>
                        <td className="py-1 text-right">{bayTotals.capacity.toLocaleString()}</td>
                        <td className="py-1 text-right">{bayTotals.current.toLocaleString()}</td>
                        <td className="py-1 text-right">
                          {bayTotals.capacity > 0 ? `${Math.round((bayTotals.current / bayTotals.capacity) * 100)}%` : "—"}
                        </td>
                        <td className="py-1 text-right">{money(bayTotals.value)}</td>
                        <td />
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            )}

            {/* Notes block */}
            {notes.trim() && (
              <section className="border border-slate-300 rounded p-2 bg-slate-50">
                <p className="font-bold text-[9px] uppercase border-b border-slate-300 pb-0.5 mb-1">
                  Notes
                </p>
                <p className="text-[9px] leading-snug whitespace-pre-wrap">{notes.trim()}</p>
              </section>
            )}

            {/* Signature footer */}
            <section className="border-t-2 border-black pt-3 grid grid-cols-2 gap-8 items-end">
              <div>
                <div className="h-10 border-b border-black" />
                <p className="text-[8px] font-black uppercase tracking-widest mt-1">
                  Prepared By (Signature)
                </p>
                <p className="text-[8px] text-slate-600">
                  {settings.operatorName || "Operator"} · {settings.yardName}
                </p>
              </div>
              <div>
                <div className="h-10 border-b border-black" />
                <p className="text-[8px] font-black uppercase tracking-widest mt-1">
                  Reviewed By (Signature)
                </p>
                <p className="text-[8px] text-slate-600">Management review</p>
              </div>
            </section>

            <p className="text-center text-[8px] text-slate-600 border-t border-slate-300 pt-1.5">
              Printed {generatedAt} · {kpis[0].value} {kpis[0].label.toLowerCase()} in this period ·
              Generated by {settings.yardName} Paymaster System
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
