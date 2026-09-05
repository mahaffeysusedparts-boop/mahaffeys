import React, { useEffect, useState } from 'react';
import { MetalGrade, ScaleStatus, ScrapTicketLine, Ticket, WeightTransaction, ScaleConfig } from '@/types/scrap';
import { scaleService } from '@/services/scaleService';
import { storageService } from '@/services/storageService';
import { calculateComplianceScore } from '@/utils/complianceUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowLeft,
  Check,
  CheckCircle2,
  DollarSign,
  FileCheck,
  Keyboard,
  Layers,
  LogIn,
  LogOut,
  PackagePlus,
  Plus,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

const MAX_ACTIVE_LOADS = 10;

interface ScaleWeightLoggerProps {
  onBack: () => void;
  onNewIntake: () => void;
  activeTicketId: string | null;
  onActiveTicketChange: (id: string | null) => void;
  onTicketCreated: (ticket: Ticket) => void;
}

type WeighState = 'AWAITING_IN' | 'AWAITING_OUT' | 'PENDING_GRADE';

const fmtTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

const fmtLbs = (lbs?: number) => (lbs ?? 0).toLocaleString();

export const ScaleWeightLogger: React.FC<ScaleWeightLoggerProps> = ({
  onBack,
  onNewIntake,
  activeTicketId,
  onActiveTicketChange,
  onTicketCreated,
}) => {
  const [metals] = useState<MetalGrade[]>(() => storageService.getMetals());
  const [popularMetals] = useState<MetalGrade[]>(() => {
    const popular = metals.filter((m) => m.isPopular);
    return (popular.length ? popular : metals).slice(0, 6);
  });

  const [queue, setQueue] = useState<Ticket[]>([]);
  const [queueSearch, setQueueSearch] = useState('');
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);

  const [scale, setScale] = useState<ScaleStatus>(scaleService.getStatus());
  const [scales, setScales] = useState<ScaleConfig[]>(scaleService.getScales());
  const [currentScaleId, setCurrentScaleId] = useState<string | null>(scaleService.getCurrentScaleId());

  const [selectedMetalId, setSelectedMetalId] = useState(metals[0]?.id ?? '');
  const [deductionPercent, setDeductionPercent] = useState(0);
  const [manualWeight, setManualWeight] = useState('');

  const [payoutMethod, setPayoutMethod] = useState<'Cash' | 'Check'>('Cash');
  const [checkNumber, setCheckNumber] = useState(`CHK-${Math.floor(1000 + Math.random() * 9000)}`);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const unsub = scaleService.subscribe((s) => setScale(s));
    setScales(scaleService.getScales());
    setCurrentScaleId(scaleService.getCurrentScaleId());
    return unsub;
  }, []);

  const refreshQueue = () => {
    setQueue(
      storageService
        .getTickets()
        .filter((t) => t.ticketType === 'SCRAP_METAL' && t.status === 'PENDING')
        .slice(0, MAX_ACTIVE_LOADS)
    );
  };

  useEffect(() => {
    refreshQueue();
  }, []);

  // Live cross-workstation updates: when another device (e.g. the iPad)
  // changes tickets, refresh the queue — and if the intake loaded in this
  // editor was completed elsewhere, clear it so a finished load can't be
  // weighed or paid out twice.
  useEffect(() => {
    const onRemoteSync = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      if (detail?.key && detail.key !== 'mahaffeys_tickets') return;
      refreshQueue();
      if (activeTicketId) {
        const stillOpen = storageService
          .getTickets()
          .some((t) => t.id === activeTicketId && t.ticketType === 'SCRAP_METAL' && t.status === 'PENDING');
        if (!stillOpen) {
          setActiveTicket(null);
          onActiveTicketChange(null);
          toast.info(`Intake #${activeTicketId} was completed on another workstation`);
        }
      }
    };
    window.addEventListener('mahaffeys:remote-sync', onRemoteSync);
    return () => window.removeEventListener('mahaffeys:remote-sync', onRemoteSync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTicketId]);

  const syncEditorState = (ticket: Ticket) => {
    setPayoutMethod(ticket.payoutMethod === 'Check' ? 'Check' : 'Cash');
    if (ticket.checkNumber) setCheckNumber(ticket.checkNumber);
    setNotes(ticket.notes && !ticket.notes.startsWith('Seller info') ? ticket.notes : '');
  };

  useEffect(() => {
    if (activeTicketId) {
      const found = storageService
        .getTickets()
        .find((t) => t.id === activeTicketId && t.ticketType === 'SCRAP_METAL' && t.status === 'PENDING');
      if (found) {
        setActiveTicket(found);
        syncEditorState(found);
        return;
      }
    }
    setActiveTicket(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTicketId]);

  const persist = (ticket: Ticket): Ticket => {
    storageService.saveTicket(ticket);
    refreshQueue();
    return ticket;
  };

  const currentLbs = scale.unit === 'KG'
    ? Math.round(scale.grossWeight * 2.20462)
    : Math.round(scale.grossWeight);

  // ---- Weighing state machine -------------------------------------------------
  const weighState: WeighState | null = !activeTicket
    ? null
    : activeTicket.scaleGrossInWeight != null && activeTicket.scaleTareOutWeight != null
      ? 'PENDING_GRADE'
      : activeTicket.scaleGrossInWeight != null
        ? 'AWAITING_OUT'
        : 'AWAITING_IN';

  const recordTransaction = (ticket: Ticket, type: WeightTransaction['type'], weightLbs: number): WeightTransaction[] => [
    ...(ticket.weightTransactions || []),
    {
      id: `wt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      weightLbs,
      recordedAt: new Date().toISOString(),
      operatorName: storageService.getSettings().operatorName,
    },
  ];

  const assertScaleReady = (): boolean => {
    if (!scale.connected) {
      toast.error('Scale is not connected', { description: 'Check the scale host connection and try again.' });
      return false;
    }
    if (currentLbs <= 0) {
      toast.error('Scale is reading zero', { description: 'Wait until the vehicle is on the platform, then log the weight.' });
      return false;
    }
    return true;
  };

  const commitInWeight = (lbs: number) => {
    if (!activeTicket) return;
    if (activeTicket.scaleGrossInWeight != null) {
      toast.error('This intake already has an IN weight logged');
      return;
    }
    const now = new Date().toISOString();
    const next: Ticket = {
      ...activeTicket,
      scaleGrossInWeight: lbs,
      scaleGrossInAt: now,
      scaleTareOutWeight: undefined,
      scaleTareOutAt: undefined,
      weightTransactions: recordTransaction(activeTicket, 'SCALE_IN', lbs),
    };
    setActiveTicket(persist(next));
    toast.success(`IN weight logged: ${fmtLbs(lbs)} LBS`, {
      description: `${activeTicket.customerName} is on the yard. Pick the metal grade below, then log the OUT weight after the load dumps.`,
    });
  };

  const commitOutWeight = (lbs: number) => {
    if (!activeTicket) return;
    const grossIn = activeTicket.scaleGrossInWeight ?? 0;
    const net = grossIn - lbs;
    if (net <= 0) {
      toast.error('OUT weight must be lower than the IN weight', {
        description: `IN was ${fmtLbs(grossIn)} LBS — make sure the load was dumped before logging OUT.`,
      });
      return;
    }
    const now = new Date().toISOString();
    const next: Ticket = {
      ...activeTicket,
      scaleTareOutWeight: lbs,
      scaleTareOutAt: now,
      weightTransactions: recordTransaction(activeTicket, 'SCALE_OUT', lbs),
    };
    setActiveTicket(persist(next));
    toast.success(`OUT weight logged: ${fmtLbs(lbs)} LBS`, {
      description: `Net scrap weight: ${fmtLbs(net)} LBS — review the grade and add the load to the ticket.`,
    });
  };

  const handleLogIn = () => {
    if (!assertScaleReady()) return;
    commitInWeight(currentLbs);
  };

  const handleLogOut = () => {
    if (!assertScaleReady()) return;
    commitOutWeight(currentLbs);
  };

  // Manual fallback for when the live scale is offline or mis-reading.
  const parseManualWeight = (): number | null => {
    const lbs = Math.round(parseFloat(manualWeight));
    if (!Number.isFinite(lbs) || lbs <= 0) {
      toast.error('Enter a weight in pounds greater than zero');
      return null;
    }
    return lbs;
  };

  const handleManualLogIn = () => {
    const lbs = parseManualWeight();
    if (lbs === null) return;
    commitInWeight(lbs);
    setManualWeight('');
  };

  const handleManualLogOut = () => {
    const lbs = parseManualWeight();
    if (lbs === null) return;
    commitOutWeight(lbs);
    setManualWeight('');
  };

  const handleDiscardWeighing = () => {
    if (!activeTicket) return;
    const next: Ticket = {
      ...activeTicket,
      scaleGrossInWeight: undefined,
      scaleGrossInAt: undefined,
      scaleTareOutWeight: undefined,
      scaleTareOutAt: undefined,
    };
    setActiveTicket(persist(next));
    setDeductionPercent(0);
    toast.info('Open weighing cleared');
  };

  // ---- Grade commit -----------------------------------------------------------
  const pendingNet = activeTicket && weighState === 'PENDING_GRADE'
    ? Math.max(0, (activeTicket.scaleGrossInWeight ?? 0) - (activeTicket.scaleTareOutWeight ?? 0))
    : 0;
  const selectedMetal = metals.find((m) => m.id === selectedMetalId);
  const pendingDeductionLbs = Math.round(pendingNet * (deductionPercent / 100) * 10) / 10;
  const pendingBillable = Math.max(0, Math.round((pendingNet - pendingDeductionLbs) * 10) / 10);
  const pendingTotal = selectedMetal ? Math.round(pendingBillable * selectedMetal.ratePerLb * 100) / 100 : 0;

  const handleCommitLoad = () => {
    if (!activeTicket || weighState !== 'PENDING_GRADE') return;
    const metal = metals.find((m) => m.id === selectedMetalId);
    if (!metal) {
      toast.error('Select a metal grade for this load');
      return;
    }
    if (deductionPercent < 0 || deductionPercent > 100) {
      toast.error('Deduction must be between 0 and 100 percent');
      return;
    }

    const gross = activeTicket.scaleGrossInWeight ?? 0;
    const tare = activeTicket.scaleTareOutWeight ?? 0;
    const net = Math.max(0, gross - tare);
    const deductionLbs = Math.round(net * (deductionPercent / 100) * 10) / 10;
    const billableWeight = Math.max(0, Math.round((net - deductionLbs) * 10) / 10);
    const lineTotal = Math.round(billableWeight * metal.ratePerLb * 100) / 100;
    const lines = activeTicket.scrapLines || [];

    const newLine: ScrapTicketLine = {
      id: `line-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      loadNumber: lines.length + 1,
      capturedAt: new Date().toISOString(),
      metalGradeId: metal.id,
      metalName: metal.name,
      metalCategory: metal.category,
      grossWeight: gross,
      tareWeight: tare,
      netWeight: net,
      deductionPercent,
      deductionLbs,
      billableWeight,
      ratePerLb: metal.ratePerLb,
      lineTotal,
    };

    const next: Ticket = {
      ...activeTicket,
      scrapLines: [...lines, newLine],
      scaleGrossInWeight: undefined,
      scaleGrossInAt: undefined,
      scaleTareOutWeight: undefined,
      scaleTareOutAt: undefined,
    };
    setActiveTicket(persist(next));
    setDeductionPercent(0);
    toast.success(`Load ${newLine.loadNumber}: ${fmtLbs(billableWeight)} LBS of ${metal.name} added`);
  };

  const handleRemoveLine = (id: string) => {
    if (!activeTicket) return;
    const lines = (activeTicket.scrapLines || [])
      .filter((l) => l.id !== id)
      .map((l, index) => ({ ...l, loadNumber: index + 1 }));
    setActiveTicket(persist({ ...activeTicket, scrapLines: lines }));
  };

  // ---- Queue ------------------------------------------------------------------
  const handleSwitch = (ticket: Ticket) => {
    setActiveTicket(ticket);
    syncEditorState(ticket);
    onActiveTicketChange(ticket.id);
    toast.success(`Switched to intake #${ticket.id}`, {
      description: `${ticket.customerName} · ${ticket.scrapLines?.length || 0} weighed load(s)`,
    });
  };

  const handleSwitchAway = () => {
    setActiveTicket(null);
    onActiveTicketChange(null);
  };

  const queueStatus = (t: Ticket): { label: string; badge: React.ReactNode } => {
    if (t.scaleGrossInWeight != null && t.scaleTareOutWeight != null) {
      return {
        label: 'PENDING GRADE',
        badge: (
          <Badge className="border border-violet-500/40 bg-violet-500/15 font-mono text-[9px] text-violet-300">
            PENDING GRADE
          </Badge>
        ),
      };
    }
    if (t.scaleGrossInWeight != null) {
      return {
        label: 'ON YARD — AWAITING OUT',
        badge: (
          <Badge className="border border-amber-500/40 bg-amber-500/15 font-mono text-[9px] text-amber-300">
            ON YARD · AWAITING OUT
          </Badge>
        ),
      };
    }
    return {
      label: 'AWAITING IN',
      badge: (
        <Badge className="border border-sky-500/40 bg-sky-500/15 font-mono text-[9px] text-sky-300">
          AWAITING IN
        </Badge>
      ),
    };
  };

  const filteredQueue = queue.filter((t) => {
    const q = queueSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      t.id.toLowerCase().includes(q) ||
      t.customerName.toLowerCase().includes(q) ||
      (t.customerPhone || '').toLowerCase().includes(q) ||
      (t.vehicleLicensePlate || '').toLowerCase().includes(q)
    );
  });

  // ---- Payout -----------------------------------------------------------------
  const lines = activeTicket?.scrapLines || [];
  const totalBillableWeight = lines.reduce((acc, l) => acc + l.billableWeight, 0);
  const totalPayout = lines.reduce((acc, l) => acc + l.lineTotal, 0);
  const hasNonFerrous = lines.some((l) =>
    l.metalCategory === 'Non-Ferrous' || l.metalCategory === 'Precious' || l.metalCategory === 'E-Waste' || l.metalCategory === 'Batteries & Auto'
  );
  const maxCashLimit = hasNonFerrous ? 25.0 : 100.0;
  const exceedsCashLimit = totalPayout > maxCashLimit;

  useEffect(() => {
    if (exceedsCashLimit && payoutMethod === 'Cash') {
      setPayoutMethod('Check');
    }
  }, [exceedsCashLimit, payoutMethod]);

  const handleNotesBlur = () => {
    if (!activeTicket) return;
    const trimmed = notes.trim();
    if (trimmed !== (activeTicket.notes || '')) {
      setActiveTicket(persist({ ...activeTicket, notes: trimmed || activeTicket.notes }));
    }
  };

  const handleComplete = () => {
    if (!activeTicket) return;
    if (lines.length === 0) {
      toast.error('Weigh at least one load before completing this ticket');
      return;
    }
    if (activeTicket.scaleGrossInWeight != null) {
      toast.error('An open weighing is in progress', {
        description: 'Finish or clear the IN/OUT weighing before completing the ticket.',
      });
      return;
    }
    if (payoutMethod === 'Cash' && exceedsCashLimit) {
      toast.error(`Cash payouts are capped at $${maxCashLimit.toFixed(2)} by law — issue a Check.`);
      return;
    }
    if (payoutMethod === 'Check' && !checkNumber.trim()) {
      toast.error('Enter a check number before completing the ticket');
      return;
    }

    const completed: Ticket = {
      ...activeTicket,
      status: 'COMPLETED',
      scrapLines: lines,
      grossTotal: Math.round(totalPayout * 100) / 100,
      totalDeductions: 0,
      finalPayout: Math.round(totalPayout * 100) / 100,
      payoutMethod,
      checkNumber: payoutMethod === 'Check' ? checkNumber.trim() : undefined,
      operatorName: storageService.getSettings().operatorName,
      notes: notes.trim() || activeTicket.notes,
    };

    persist(completed);
    toast.success(`Ticket #${completed.id} completed — voucher issued`);
    setActiveTicket(null);
    onActiveTicketChange(null);
    setNotes('');
    onTicketCreated(completed);
  };

  const compliance = calculateComplianceScore(activeTicket?.complianceCaptures, 'SCRAP_METAL');

  // Grade picker: shown right after the IN weight is logged so the operator
  // can pick while the load dumps, and again before committing the net.
  const gradeSelector = (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-slate-400">
        Metal Grade {weighState === 'AWAITING_OUT' ? '— pick while the load dumps:' : '(1-Tap):'}
      </Label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {popularMetals.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setSelectedMetalId(m.id)}
            className={`flex min-h-[44px] items-center justify-between rounded-xl border p-2.5 text-left text-xs transition-all active:scale-[0.98] ${
              selectedMetalId === m.id
                ? 'border-emerald-500 bg-emerald-950/80 font-bold text-white'
                : 'border-slate-800/80 bg-slate-950 text-slate-300 hover:border-slate-700'
            }`}
          >
            <span className="truncate">{m.name}</span>
            <span className="ml-1 shrink-0 font-mono font-bold text-emerald-400">${m.ratePerLb.toFixed(2)}</span>
          </button>
        ))}
      </div>
      <div>
        <Label className="text-[11px] text-slate-400">All Metal Grades</Label>
        <Select value={selectedMetalId} onValueChange={setSelectedMetalId}>
          <SelectTrigger className="mt-1 h-11 w-full border-slate-800 bg-slate-950 text-xs text-white">
            <SelectValue placeholder="Choose a material" />
          </SelectTrigger>
          <SelectContent className="border-slate-800 bg-slate-900 text-white">
            {metals.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-xs">
                {m.name} · ${m.ratePerLb.toFixed(2)}/lb
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  // Typed-weight fallback row for the current step (IN or OUT).
  const manualEntryRow = (direction: 'IN' | 'OUT') => (
    <div className={`flex items-end gap-2 rounded-xl border border-dashed p-3 ${scale.connected ? 'border-slate-700 bg-slate-950' : 'border-amber-500/50 bg-amber-950/20'}`}>
      <div className="min-w-0 flex-1">
        <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Manual Fallback — Type {direction} Weight (LBS)
          {!scale.connected && <span className="ml-1 text-amber-400">· SCALE OFFLINE</span>}
        </Label>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          value={manualWeight}
          onChange={(e) => setManualWeight(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (direction === 'IN' ? handleManualLogIn : handleManualLogOut)();
          }}
          placeholder={direction === 'IN' ? 'e.g. 8750' : 'e.g. 6420'}
          className="mt-1 h-11 border-slate-700 bg-slate-900 font-mono text-base font-bold text-white"
        />
      </div>
      <Button
        onClick={direction === 'IN' ? handleManualLogIn : handleManualLogOut}
        className="h-11 shrink-0 gap-1.5 border border-slate-600 bg-slate-800 text-xs font-bold text-slate-100 hover:bg-slate-700"
      >
        <Keyboard className="h-4 w-4" /> Log {direction} Manually
      </Button>
    </div>
  );

  // ---- Render -----------------------------------------------------------------
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24 font-sans sm:pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-bold text-white">Scrap Intake — Part 2</h1>
              <Badge className="border border-emerald-500/40 bg-emerald-500/15 font-mono text-xs text-emerald-300">
                SCALE WORKSTATION
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Log the IN weight when the vehicle drives on, switch transactions freely, then log the OUT weight to net the load.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={onNewIntake}
            disabled={queue.length >= MAX_ACTIVE_LOADS}
            className="gap-1.5 bg-sky-600 text-xs font-bold text-white hover:bg-sky-500"
          >
            <Plus className="h-3.5 w-3.5" /> New Intake (Part 1)
          </Button>
          <Badge className="gap-1 border border-amber-500/40 bg-amber-500/10 font-mono text-xs text-amber-300">
            <Layers className="h-3.5 w-3.5" /> {queue.length}/{MAX_ACTIVE_LOADS} ACTIVE
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            onClick={refreshQueue}
            className="h-8 text-xs text-slate-400 hover:text-white"
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Active loads queue */}
      {queue.length > 0 && (
        <Card className="border-2 border-amber-500/40 bg-slate-900 text-white shadow-xl">
          <CardHeader className="flex flex-col gap-2 border-b border-amber-500/30 bg-amber-950/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-amber-300">
              <Layers className="h-4 w-4 text-amber-400" /> Active Intakes — Switch Transactions
            </CardTitle>
            {queue.length > 3 && (
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <Input
                  placeholder="Filter by name, phone, tag, or #..."
                  value={queueSearch}
                  onChange={(e) => setQueueSearch(e.target.value)}
                  className="h-9 border-slate-800 bg-slate-950 pl-8 text-xs"
                />
              </div>
            )}
          </CardHeader>

          <CardContent className="p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredQueue.map((ticket) => {
                const ticketLines = ticket.scrapLines || [];
                const ticketWeight = ticketLines.reduce((sum, line) => sum + line.billableWeight, 0);
                const materials = [...new Set(ticketLines.map((l) => l.metalName))].slice(0, 3);
                const isCurrent = activeTicket?.id === ticket.id;
                const status = queueStatus(ticket);
                return (
                  <div
                    key={ticket.id}
                    className={`space-y-2.5 rounded-xl border p-3 text-left transition-all ${
                      isCurrent
                        ? 'border-emerald-500 bg-emerald-950/40 text-white ring-1 ring-emerald-500/50'
                        : 'border-slate-800 bg-slate-950 text-slate-200 hover:border-amber-500/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-white">{ticket.customerName}</div>
                        <div className="font-mono text-[10px] text-slate-400">
                          #{ticket.id} · {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      {isCurrent ? (
                        <Badge className="shrink-0 bg-emerald-500 font-mono text-[9px] font-black text-slate-950">
                          CURRENT
                        </Badge>
                      ) : (
                        status.badge
                      )}
                    </div>

                    <div className="space-y-0.5 font-mono text-[11px] text-slate-400">
                      {ticket.customerPhone && (
                        <div>
                          Phone: <span className="font-bold text-emerald-400">{ticket.customerPhone}</span>
                        </div>
                      )}
                      {ticket.vehicleLicensePlate && (
                        <div>
                          Tag: <span className="text-slate-200">{ticket.vehicleLicensePlate}</span>
                        </div>
                      )}
                      {ticket.scaleGrossInWeight != null && (
                        <div>
                          IN:{' '}
                          <span className="font-bold text-emerald-400">{fmtLbs(ticket.scaleGrossInWeight)} LBS</span>
                          {ticket.scaleGrossInAt && <span className="text-slate-500"> @ {fmtTime(ticket.scaleGrossInAt)}</span>}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-2 font-mono text-[10px]">
                      <div className="flex items-center justify-between">
                        <span className="uppercase tracking-wide text-slate-500">Weighed loads</span>
                        <span className="font-bold text-white">{ticketLines.length}</span>
                      </div>
                      {ticketWeight > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="uppercase tracking-wide text-slate-500">Billable weight</span>
                          <span className="font-bold text-emerald-400">{fmtLbs(ticketWeight)} LBS</span>
                        </div>
                      )}
                      {materials.length > 0 && (
                        <div className="truncate text-slate-400">
                          {materials.join(' · ')}
                          {ticketLines.length > materials.length ? ' +' : ''}
                        </div>
                      )}
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleSwitch(ticket)}
                      className="h-8 w-full gap-1.5 bg-emerald-600 text-xs font-bold text-white shadow hover:bg-emerald-500"
                    >
                      <Scale className="h-3.5 w-3.5" /> {isCurrent ? 'Continue This Intake' : 'Switch to This Intake'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No active intake selected */}
      {!activeTicket && (
        <Card className="border-slate-800 bg-slate-900 text-white shadow-xl">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-950 text-emerald-400 ring-1 ring-emerald-500/30">
              <Scale className="h-8 w-8" />
            </div>
            <div>
              <p className="text-lg font-bold text-white">Select an intake to weigh</p>
              <p className="mt-1 max-w-md text-sm text-slate-400">
                {queue.length > 0
                  ? 'Pick one of the active intakes above to log its IN weight, or start a new Part 1 intake.'
                  : 'No active intakes right now. Start a Part 1 intake to collect seller info & photos first.'}
              </p>
            </div>
            {queue.length === 0 && (
              <Button onClick={onNewIntake} className="gap-2 bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500">
                <Plus className="h-4 w-4" /> Start Part 1 Intake
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {activeTicket && (
        <>
          {/* Seller summary banner */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-2 font-bold text-emerald-400">
                <ShieldCheck className="h-4 w-4" /> {activeTicket.customerName}
              </span>
              {activeTicket.customerPhone && (
                <span className="font-mono text-emerald-400">{activeTicket.customerPhone}</span>
              )}
              <span className="font-mono text-slate-400">ID: {activeTicket.customerIdNumber || 'On File'}</span>
              {activeTicket.vehicleLicensePlate && (
                <span className="font-mono text-slate-300">Tag: {activeTicket.vehicleLicensePlate}</span>
              )}
              <Badge className="border border-amber-500/30 bg-amber-500/15 font-mono text-[10px] text-amber-300">
                # {activeTicket.id}
              </Badge>
              <Badge
                className={`font-mono text-[10px] ${
                  compliance.score === 100
                    ? 'border border-emerald-500/40 bg-emerald-950 text-emerald-400'
                    : 'border border-amber-500/40 bg-amber-950 text-amber-400'
                }`}
              >
                {compliance.score}% PHOTOS
              </Badge>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleSwitchAway}
              className="shrink-0 gap-1.5 border-slate-700 bg-slate-950 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <Layers className="h-3.5 w-3.5" /> Save &amp; Switch Transaction
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left: weighing + lines */}
            <div className="space-y-6 lg:col-span-2">
              <Card className="border-slate-800 bg-slate-900 text-white shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 bg-slate-950/60 px-4 py-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-300">
                    <Scale className="h-4 w-4 text-emerald-400" /> Vehicle Weighing
                  </CardTitle>
                  <Badge
                    className={`font-mono text-[10px] ${
                      weighState === 'AWAITING_IN'
                        ? 'border border-sky-500/40 bg-sky-500/15 text-sky-300'
                        : weighState === 'AWAITING_OUT'
                          ? 'border border-amber-500/40 bg-amber-500/15 text-amber-300'
                          : 'border border-violet-500/40 bg-violet-500/15 text-violet-300'
                    }`}
                  >
                    {weighState === 'AWAITING_IN' ? 'STEP: LOG IN' : weighState === 'AWAITING_OUT' ? 'STEP: LOG OUT · PICK GRADE' : 'STEP: ASSIGN GRADE'}
                  </Badge>
                </CardHeader>

                <CardContent className="space-y-4 p-4">
                  {/* Live readout */}
                  <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-black/90 p-4">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] opacity-5" />
                    <div className="relative z-10 flex items-center justify-between font-mono text-[10px] text-slate-400">
                      <span>GROSS: {scale.grossWeight.toLocaleString()} {scale.unit}</span>
                      {scale.tareWeight > 0 && (
                        <span className="font-bold text-amber-400">TARE: {scale.tareWeight.toLocaleString()} {scale.unit}</span>
                      )}
                      <Badge
                        className={`font-mono text-[10px] ${
                          scale.connected
                            ? scale.isStable
                              ? 'bg-emerald-950/60 text-emerald-400'
                              : 'animate-pulse bg-amber-950/60 text-amber-400'
                            : 'bg-red-950/60 text-red-400'
                        }`}
                      >
                        {!scale.connected ? 'OFFLINE' : scale.isStable ? 'STABLE' : 'MOTION'}
                      </Badge>
                    </div>
                    <div className="relative z-10 my-2 flex items-baseline justify-center gap-2 font-mono">
                      <span className="text-5xl font-extrabold text-emerald-400 drop-shadow-[0_0_20px_rgba(16,185,129,0.35)] sm:text-6xl">
                        {fmtLbs(currentLbs)}
                      </span>
                      <span className="text-xl font-bold uppercase text-slate-400">LBS</span>
                    </div>
                    <div className="relative z-10 grid grid-cols-3 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { scaleService.setZero(); toast.success('Scale zeroed'); }}
                        className="h-9 border-slate-700 bg-slate-800/80 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                      >
                        <RotateCcw className="mr-1 h-3.5 w-3.5 text-slate-400" /> ZERO
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (scale.tareWeight > 0) { scaleService.clearTare(); toast.info('Tare cleared'); }
                          else { scaleService.setTare(); toast.success(`Tare set to ${scale.grossWeight} ${scale.unit}`); }
                        }}
                        className="h-9 border-slate-700 bg-slate-800/80 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                      >
                        {scale.tareWeight > 0 ? 'CLEAR TARE' : 'TARE'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => scaleService.setUnit(scale.unit === 'LBS' ? 'KG' : 'LBS')}
                        className="h-9 border-slate-700 bg-slate-800/80 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                      >
                        <ArrowDownUp className="mr-1 h-3.5 w-3.5 text-slate-400" /> {scale.unit === 'LBS' ? 'KG' : 'LBS'}
                      </Button>
                    </div>
                  </div>

                  {/* IN / OUT state machine */}
                  {weighState === 'AWAITING_IN' && (
                    <div className="space-y-3">
                      <Button
                        onClick={handleLogIn}
                        disabled={!scale.connected || currentLbs <= 0}
                        className="h-16 w-full gap-2 bg-emerald-600 text-base font-extrabold text-white shadow-lg shadow-emerald-950 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500"
                      >
                        <LogIn className="h-6 w-6" />
                        LOG IN WEIGHT · {fmtLbs(currentLbs)} LBS
                      </Button>
                      <p className="text-center text-[11px] text-slate-400">
                        Vehicle drives ON with the load. The IN weight is saved to this intake instantly — switch to another
                        transaction and come back later to log the OUT.
                      </p>
                      {manualEntryRow('IN')}
                    </div>
                  )}

                  {weighState === 'AWAITING_OUT' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 font-mono text-xs">
                        <div>
                          <span className="block text-[10px] uppercase tracking-wide text-slate-400">IN (Gross) Logged</span>
                          <span className="text-lg font-bold text-emerald-400">{fmtLbs(activeTicket.scaleGrossInWeight)} LBS</span>
                        </div>
                        <span className="text-[10px] text-slate-500">@ {fmtTime(activeTicket.scaleGrossInAt)}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleDiscardWeighing}
                          className="h-7 gap-1 text-[10px] text-slate-400 hover:bg-slate-800 hover:text-red-400"
                        >
                          <X className="h-3 w-3" /> Clear
                        </Button>
                      </div>
                      <Button
                        onClick={handleLogOut}
                        disabled={!scale.connected || currentLbs <= 0}
                        className="h-16 w-full gap-2 bg-amber-600 text-base font-extrabold text-white shadow-lg shadow-amber-950 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500"
                      >
                        <LogOut className="h-6 w-6" />
                        LOG OUT WEIGHT · {fmtLbs(currentLbs)} LBS
                      </Button>
                      <p className="text-center text-[11px] text-slate-400">
                        After the load is dumped, the empty vehicle drives back ON. Net = IN − OUT.
                      </p>
                      {manualEntryRow('OUT')}
                      {gradeSelector}
                    </div>
                  )}

                  {weighState === 'PENDING_GRADE' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-2 font-mono">
                        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                          <span className="block text-[10px] uppercase tracking-wide text-slate-400">IN (Gross)</span>
                          <span className="text-lg font-bold text-emerald-400">{fmtLbs(activeTicket.scaleGrossInWeight)}</span>
                          <span className="block text-[10px] text-slate-500">@ {fmtTime(activeTicket.scaleGrossInAt)}</span>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                          <span className="block text-[10px] uppercase tracking-wide text-slate-400">OUT (Tare)</span>
                          <span className="text-lg font-bold text-amber-300">{fmtLbs(activeTicket.scaleTareOutWeight)}</span>
                          <span className="block text-[10px] text-slate-500">@ {fmtTime(activeTicket.scaleTareOutAt)}</span>
                        </div>
                        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3">
                          <span className="block text-[10px] uppercase tracking-wide text-emerald-300">Net Scrap</span>
                          <span className="text-lg font-black text-emerald-400">{fmtLbs(pendingNet)}</span>
                          <span className="block text-[10px] text-emerald-500">LBS</span>
                        </div>
                      </div>

                      {gradeSelector}

                      <div>
                        <Label className="text-[11px] text-slate-400">Contamination %</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={deductionPercent}
                          onChange={(e) => setDeductionPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                          className="mt-1 h-11 border-slate-800 bg-slate-950 font-mono text-base text-red-400"
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 font-mono text-xs">
                        <span className="text-slate-400">
                          {fmtLbs(pendingNet)} lb net − {fmtLbs(pendingDeductionLbs)} lb ded ={' '}
                          <span className="font-bold text-white">{fmtLbs(pendingBillable)} lb billable</span>
                        </span>
                        <span className="font-extrabold text-emerald-400">${pendingTotal.toFixed(2)}</span>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={handleCommitLoad}
                          className="h-12 flex-1 gap-2 bg-emerald-600 text-sm font-extrabold text-white shadow-md hover:bg-emerald-500"
                        >
                          <PackagePlus className="h-5 w-5" /> Add Load to Ticket
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDiscardWeighing}
                          className="h-12 shrink-0 gap-1.5 border-slate-700 bg-slate-950 text-xs text-slate-400 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" /> Discard Weighing
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Lines table */}
              <Card className="overflow-hidden border-slate-800 bg-slate-900 text-white shadow-lg">
                <CardHeader className="border-b border-slate-800 bg-slate-950/60 px-4 py-3">
                  <CardTitle className="text-sm font-bold uppercase tracking-wide text-slate-300">
                    Weighed Loads on This Ticket ({lines.length})
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-0">
                  {lines.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No loads weighed yet. Log the IN weight when the vehicle arrives, then the OUT weight after it dumps —
                      the net becomes a weighed load line.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader className="bg-slate-950/80">
                        <TableRow className="border-slate-800 text-xs hover:bg-slate-950">
                          <TableHead className="text-slate-400">Load #</TableHead>
                          <TableHead className="text-slate-400">Metal Grade</TableHead>
                          <TableHead className="text-slate-400">IN / OUT</TableHead>
                          <TableHead className="text-right text-slate-400">Net</TableHead>
                          <TableHead className="text-right text-slate-400">Deductions</TableHead>
                          <TableHead className="text-right text-slate-400">Billable</TableHead>
                          <TableHead className="text-right text-slate-400">Rate/lb</TableHead>
                          <TableHead className="text-right text-slate-400">Total</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.map((line) => (
                          <TableRow key={line.id} className="border-slate-800 font-mono text-xs hover:bg-slate-800/40">
                            <TableCell className="font-bold text-amber-300">#{line.loadNumber}</TableCell>
                            <TableCell className="font-sans font-semibold text-white">
                              {line.metalName}
                              <span className="block text-[10px] text-slate-400">{line.metalCategory}</span>
                            </TableCell>
                            <TableCell className="text-slate-400">
                              {fmtLbs(line.grossWeight)} / {fmtLbs(line.tareWeight)}
                            </TableCell>
                            <TableCell className="text-right text-slate-300">{fmtLbs(line.netWeight)} lb</TableCell>
                            <TableCell className="text-right text-red-400">
                              {line.deductionPercent > 0 ? `−${fmtLbs(line.deductionLbs)} lb (${line.deductionPercent}%)` : '—'}
                            </TableCell>
                            <TableCell className="text-right font-bold text-emerald-300">{fmtLbs(line.billableWeight)} lb</TableCell>
                            <TableCell className="text-right text-slate-300">${line.ratePerLb.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-extrabold text-emerald-400">${line.lineTotal.toFixed(2)}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveLine(line.id)}
                                className="h-8 w-8 text-slate-500 hover:bg-slate-800 hover:text-red-400"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right: payout */}
            <div className="space-y-6">
              <Card className="border-slate-800 bg-slate-900 text-white shadow-xl">
                <CardHeader className="border-b border-slate-800 bg-slate-950/60 px-4 py-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-300">
                    <DollarSign className="h-4 w-4 text-emerald-400" /> Payout &amp; Statutory Limits
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4 p-4">
                  <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Receipt #:</span>
                      <span className="font-bold text-amber-400">{activeTicket.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Billable:</span>
                      <span className="font-bold text-white">{fmtLbs(totalBillableWeight)} LBS</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Cash Limit:</span>
                      <span className="font-bold text-amber-400">
                        ${maxCashLimit.toFixed(2)} ({hasNonFerrous ? 'Non-Ferrous' : 'Ferrous'})
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between border-t border-slate-800 pt-3">
                      <span className="text-sm font-bold text-slate-200">TOTAL PAYOUT:</span>
                      <span className="font-mono text-3xl font-black text-emerald-400">${totalPayout.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={exceedsCashLimit}
                      onClick={() => setPayoutMethod('Cash')}
                      className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all ${
                        payoutMethod === 'Cash'
                          ? 'border-emerald-500 bg-emerald-950/80 text-white'
                          : exceedsCashLimit
                            ? 'cursor-not-allowed border-slate-800 bg-slate-950 text-slate-500 opacity-40'
                            : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">1. CASH PAYOUT</span>
                        {payoutMethod === 'Cash' && <Check className="h-4 w-4 text-emerald-400" />}
                      </div>
                      <span className="mt-1 block text-[10px] text-slate-400">
                        Max ${maxCashLimit.toFixed(0)} ({hasNonFerrous ? 'Non-Ferrous' : 'Ferrous'})
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPayoutMethod('Check')}
                      className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all ${
                        payoutMethod === 'Check'
                          ? 'border-emerald-500 bg-emerald-950/80 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">2. CHECK ISSUE</span>
                        {payoutMethod === 'Check' && <Check className="h-4 w-4 text-emerald-400" />}
                      </div>
                      <span className="mt-1 block text-[10px] text-slate-400">Any amount over limits</span>
                    </button>
                  </div>

                  {exceedsCashLimit && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-950/40 p-3 text-xs text-amber-200">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                      <div>
                        <span className="block font-bold">State Scrap Metal Theft Law Capping</span>
                        <p className="text-[11px] text-slate-300">
                          Cash is capped at <strong className="text-amber-300">$25.00 Non-Ferrous</strong> /{' '}
                          <strong className="text-amber-300">$100.00 Ferrous</strong>. This ${totalPayout.toFixed(2)} payout
                          defaults to <strong className="text-emerald-400">CHECK ISSUE</strong>.
                        </p>
                      </div>
                    </div>
                  )}

                  {payoutMethod === 'Check' && (
                    <div className="space-y-2 rounded-xl border-2 border-emerald-500/40 bg-slate-950 p-3">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                          <FileCheck className="h-4 w-4 text-emerald-400" /> Check Number *
                        </Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setCheckNumber(`CHK-${Math.floor(10000 + Math.random() * 90000)}`)}
                          className="h-7 bg-slate-900 text-[10px] text-slate-300"
                        >
                          Auto-Generate
                        </Button>
                      </div>
                      <Input
                        value={checkNumber}
                        onChange={(e) => setCheckNumber(e.target.value)}
                        placeholder="e.g. 9042"
                        className="h-11 border-slate-800 bg-slate-900 font-mono text-sm font-bold text-amber-300"
                      />
                    </div>
                  )}

                  <div>
                    <Label className="mb-1.5 block text-xs text-slate-300">Ticket Notes</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      onBlur={handleNotesBlur}
                      placeholder="Optional material or transaction notes"
                      className="min-h-20 rounded-xl border-slate-700 bg-slate-950 text-white"
                    />
                  </div>

                  <Button
                    onClick={handleComplete}
                    disabled={lines.length === 0}
                    className="h-12 w-full gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-sm font-extrabold tracking-wide text-slate-950 shadow-lg shadow-emerald-950 hover:from-emerald-400 hover:to-teal-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400"
                  >
                    <CheckCircle2 className="h-5 w-5" /> Complete Ticket #{activeTicket.id} &amp; Issue Voucher
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
