import React, { useEffect, useRef, useState } from 'react';
import { MetalGrade, ScaleStatus, ScrapTicketLine, Ticket, WeightTransaction, ScaleConfig, ScaleWeighingMode } from '@/types/scrap';
import { scaleService } from '@/services/scaleService';
import { storageService } from '@/services/storageService';
import { authService } from '@/services/authService';
import { scrapBuyingService } from '@/services/scrapBuyingService';
import { useIntakeRequirements } from '@/services/intakeRequirementsService';
import { useQuery } from '@tanstack/react-query';
import { calculateComplianceScore } from '@/utils/complianceUtils';
import { computeWeightBreakdown, buildScrapTicketLine } from '@/utils/weightCalculations';
import { normalizeWeight, validateScaleReading } from '@/utils/weighingContract';
import type { WeightCapture, WeighingType } from '@/types/scrapBuying';
import { WeighingTypeSelector } from './WeighingTypeSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { scaleAccent } from '@/components/scale/scaleAccent';
import { VoidTicketDialog } from '@/components/tickets/VoidTicketDialog';
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowLeft,
  Ban,
  Check,
  CheckCircle2,
  DollarSign,
  FileCheck,
  Keyboard,
  Layers,
  LogIn,
  LogOut,
  PackageCheck,
  PackagePlus,
  Plus,
  Radar,
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

type SingleTareMode = 'NONE' | 'SCALE_TARE' | 'MANUAL';

// Auto-capture tuning: a reading only fires after it stays stable this long,
// and must exceed this floor so idle platform drift never auto-logs.
const AUTO_CAPTURE_SETTLE_MS = 1500;
const AUTO_CAPTURE_MIN_LBS = 20;

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
  const requirements = useIntakeRequirements();
  const [metals] = useState<MetalGrade[]>(() => storageService.getMetals());
  const [popularMetals] = useState<MetalGrade[]>(() => {
    const popular = metals.filter((m) => m.isPopular);
    return (popular.length ? popular : metals).slice(0, 6);
  });

  const [queue, setQueue] = useState<Ticket[]>([]);
  const [queueSearch, setQueueSearch] = useState('');
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  // Ticket pending a confirmed void (active panel or a queued intake row).
  const [voidTarget, setVoidTarget] = useState<Ticket | null>(null);

  const [scale, setScale] = useState<ScaleStatus>(scaleService.getStatus());
  const [scales, setScales] = useState<ScaleConfig[]>(scaleService.getScales());
  const [currentScaleId, setCurrentScaleId] = useState<string | null>(scaleService.getCurrentScaleId());
  // A platform switch awaiting confirmation (mid-weighing guard). The value's
  // id may be null = "No Scale".
  const [pendingScaleSwitch, setPendingScaleSwitch] = useState<{ id: string | null } | null>(null);

  const [selectedMetalId, setSelectedMetalId] = useState(metals[0]?.id ?? '');
  const [deductionPercent, setDeductionPercent] = useState(0);
  const [manualWeight, setManualWeight] = useState('');

  // Hands-free logging: when armed, the next stable reading auto-commits as
  // the IN (or OUT) weight after the settle window elapses.
  const [autoCapture, setAutoCapture] = useState(false);
  const stableSinceRef = useRef<number | null>(null);
  const autoCaptureContextRef = useRef<string | null>(null);
  // Manual capture attempted while the reading was still in MOTION — parked
  // here until the operator confirms or waits for stability.
  const [pendingUnstable, setPendingUnstable] = useState<{ direction: 'IN' | 'OUT' | 'SINGLE'; lbs: number; capture: WeightCapture } | null>(null);
  const [correctionTarget, setCorrectionTarget] = useState<{ action: 'TRUCK' | 'PLATFORM' | 'LINE'; lineId?: string } | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [deductionReason, setDeductionReason] = useState('');
  const [remoteConflict, setRemoteConflict] = useState(false);
  const [saveState, setSaveState] = useState<'SAVED'|'PENDING'|'ERROR'>('SAVED');
  const [saveError, setSaveError] = useState('');
  const busyRef = useRef(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const serverQueue = useQuery({queryKey:['scrap-buying-queue'],queryFn:() => scrapBuyingService.queue(),refetchInterval:5000});

  const [notes, setNotes] = useState('');

  const singleCapture = activeTicket?.pendingPlatformCapture ?? null;
  const selectedWeighingType: WeighingType | null = singleCapture ? 'PLATFORM'
    : activeTicket?.scaleGrossInWeight != null ? 'VEHICLE_IN_OUT'
    : activeTicket?.selectedWeighingType ?? null;
  const weighingMode: ScaleWeighingMode | null = selectedWeighingType === 'PLATFORM' ? 'SINGLE_WEIGHT'
    : selectedWeighingType === 'VEHICLE_IN_OUT' ? 'VEHICLE_IN_OUT' : null;
  const [singleTareMode, setSingleTareMode] = useState<SingleTareMode>('NONE');
  const [singleManualTare, setSingleManualTare] = useState('');
  const [singleManualWeight, setSingleManualWeight] = useState('');

  useEffect(() => {
    const unsub = scaleService.subscribe((s) => {
      setScale(s);
      setScales(scaleService.getScales());
      setCurrentScaleId(scaleService.getCurrentScaleId());
    });
    setScales(scaleService.getScales());
    setCurrentScaleId(scaleService.getCurrentScaleId());
    return unsub;
  }, []);

  const activeScale = scales.find((s) => s.id === currentScaleId) ?? null;
  const accent = scaleAccent(activeScale?.accentColor);
  const activeScaleIsSmall = activeScale?.weighingMode === 'SINGLE_WEIGHT';
  const supportedTypes = activeScale?.supportedWeighingTypes ?? (activeScale ? [activeScaleIsSmall ? 'PLATFORM' : 'VEHICLE_IN_OUT'] : ['PLATFORM', 'VEHICLE_IN_OUT']);
  const modeCompatible = selectedWeighingType !== null && supportedTypes.includes(selectedWeighingType);

  const canEdit = () => {
    if (busyRef.current) return false;
    const latest = storageService.getTickets().find((ticket) => ticket.id === activeTicket?.id);
    if (remoteConflict || !latest || latest.status !== 'PENDING' || latest.buying?.revision !== activeTicket?.buying?.revision) {
      setRemoteConflict(true);
      toast.error('This ticket changed or closed on another workstation. Review it before continuing.');
      return false;
    }
    return true;
  };

  const selectWeighingType = async (type: WeighingType) => {
    if (!activeTicket || !canEdit() || singleCapture || activeTicket.scaleGrossInWeight != null) return;
    if (type === 'SPLIT_GROUPS' || !supportedTypes.includes(type)) return;
    await persist({ ...activeTicket, selectedWeighingType: type });
  };

  const applyScaleSwitch = (id: string | null) => {
    const next = scales.find((s) => s.id === id);
    scaleService.setCurrentScale(id);
    setCurrentScaleId(id);
    toast.success(next ? 'Switched to scale: ' + next.name : 'Scale disconnected');
  };

  // Mid-weighing switch guard: if the active intake has an IN weight but no
  // OUT yet, confirm before moving to another platform.
  const requestScaleSwitch = (id: string | null) => {
    if (id === currentScaleId) return;
    const midWeighing = !!activeTicket
      && activeTicket.scaleGrossInWeight != null
      && activeTicket.scaleTareOutWeight == null;
    const hasPendingSingle = singleCapture !== null;
    if (midWeighing || hasPendingSingle) {
      setPendingScaleSwitch({ id });
      return;
    }
    applyScaleSwitch(id);
  };

  const cycleActiveScale = () => {
    const list = scaleService.getScales();
    if (list.length < 2) return;
    const index = list.findIndex((s) => s.id === scaleService.getCurrentScaleId());
    const next = list[(index + 1) % list.length];
    requestScaleSwitch(next.id);
  };

  // Scale-desk shortcuts: Alt+S cycles platforms, Alt+I / Alt+O capture the
  // current IN / OUT reading (guarded by the same checks as the buttons).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        cycleActiveScale();
      } else if (key === 'i') {
        if (weighingMode === 'VEHICLE_IN_OUT' && weighState === 'AWAITING_IN') {
          e.preventDefault();
          handleLogIn();
        }
      } else if (key === 'o') {
        if (weighingMode === 'VEHICLE_IN_OUT' && weighState === 'AWAITING_OUT') {
          e.preventDefault();
          handleLogOut();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

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
      // Scale config edited on another workstation: pull it in live.
      if (detail?.key === 'mahaffeys_settings') {
        scaleService.reloadScales();
        setScales(scaleService.getScales());
        setCurrentScaleId(scaleService.getCurrentScaleId());
        return;
      }
      if (detail?.key && detail.key !== 'mahaffeys_tickets') return;
      refreshQueue();
      if (activeTicketId) {
        const latest = storageService
          .getTickets()
          .find((t) => t.id === activeTicketId && t.ticketType === 'SCRAP_METAL');
        const stillOpen = latest?.status === 'PENDING';
        if (!busyRef.current && (!stillOpen || (activeTicket && (latest?.buying?.revision ?? 0) > (activeTicket.buying?.revision ?? 0)))) {
          setRemoteConflict(true);
          setAutoCapture(false);
          toast.warning(`Intake #${activeTicketId} changed or closed on another workstation`, {
            description: 'Your current review is preserved. Further writes are blocked; return to the queue to review the current ticket.',
          });
        }
      }
    };
    window.addEventListener('mahaffeys:remote-sync', onRemoteSync);
    return () => window.removeEventListener('mahaffeys:remote-sync', onRemoteSync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTicketId, activeTicket]);

  const syncEditorState = (ticket: Ticket) => {
    setNotes(ticket.notes && !ticket.notes.startsWith('Seller info') ? ticket.notes : '');
  };

  useEffect(() => {
    setRemoteConflict(false);
    setSingleTareMode('NONE');
    setSingleManualTare('');
    setSingleManualWeight('');
    setDeductionPercent(0);
    setDeductionReason('');
    setManualWeight('');
    setReviewConfirmed(false);
    setActiveTicket(null);
    let mounted = true;
    if (activeTicketId) {
      setSaveState('PENDING');
      scrapBuyingService.adopt(activeTicketId).then((ticket) => {
        if (!mounted) return;
        if (ticket.buying?.stage !== 'DRAFT') { setSaveState('ERROR'); setSaveError('This ticket is no longer a draft. Review it in the payment queue.'); return; }
        setActiveTicket(ticket); syncEditorState(ticket); setSaveState('SAVED'); setSaveError('');
      }).catch((error) => { if (mounted) { setSaveState('ERROR'); setSaveError(error instanceof Error ? error.message : 'Unable to resume draft'); } });
    } else setSaveState('SAVED');
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTicketId]);

  useEffect(() => {
    refreshQueue();
    if (activeTicket && serverQueue.data) {
      const latest = serverQueue.data.tickets.find((ticket) => ticket.id === activeTicket.id);
      if (latest && (latest.buying?.revision ?? 0) > (activeTicket.buying?.revision ?? 0) && !busyRef.current) setRemoteConflict(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverQueue.data]);

  const persist = async (ticket: Ticket): Promise<Ticket | null> => {
    if (busyRef.current) return null;
    busyRef.current = true; setSaveState('PENDING'); setSaveError('');
    try {
      const saved = await scrapBuyingService.save(ticket);
      setActiveTicket(saved); refreshQueue(); setSaveState('SAVED'); setReviewConfirmed(false);
      return saved;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Server did not confirm the update';
      setSaveState('ERROR'); setSaveError(message); toast.error(message); return null;
    } finally { busyRef.current = false; }
  };

  // After a confirmed void: clear the desk if it was the active transaction,
  // then pull the refreshed queue so the row disappears everywhere.
  const handleTicketVoided = (ticketId: string) => {
    if (activeTicketId === ticketId) {
      setActiveTicket(null);
      onActiveTicketChange(null);
      setNotes('');
      setManualWeight('');
      setDeductionPercent(0);
    }
    refreshQueue();
  };

  const currentLbs = Number.isFinite(scale.grossWeight) && scale.grossWeight >= 0 && scale.grossWeight <= 1000000000
    ? normalizeWeight(scale.grossWeight, scale.unit) : 0;
  const selectedMetal = metals.find((m) => m.id === selectedMetalId);
  const nextLoadNumber = Math.max(0, ...(activeTicket?.scrapLines ?? []).map((line) => line.loadNumber ?? 0),
    ...(activeTicket?.weighingCorrections ?? []).map((correction) => correction.originalLine?.loadNumber ?? 0)) + 1;
  const makeCapture = (lbs: number, isManual: boolean): WeightCapture => ({
    id: crypto.randomUUID(), scaleId: currentScaleId,
    originalWeight: isManual ? lbs : scale.grossWeight,
    originalUnit: isManual ? 'LBS' : scale.unit, normalizedLbs: lbs,
    actorId: authService.getCurrentUser()?.id ?? 'legacy-unverified',
    capturedAt: new Date().toISOString(), stable: !isManual && scale.isStable,
    source: isManual ? 'MANUAL' : 'SCALE',
  });
  const validateCapture = (lbs: number) => {
    try {
      if (!canEdit() || !modeCompatible) return false;
      if (lbs <= 0) throw new Error('Weight must be greater than zero');
      validateScaleReading(lbs, activeScale?.capacityLbs, activeScale?.resolutionLbs);
      if (normalizeWeight(lbs, 'LBS') !== lbs) throw new Error('Manual weights support at most six decimal places');
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invalid weight');
      return false;
    }
  };

  // ---- Weighing state machine -------------------------------------------------
  const weighState: WeighState | null = !activeTicket
    ? null
    : activeTicket.scaleGrossInWeight != null && activeTicket.scaleTareOutWeight != null
      ? 'PENDING_GRADE'
      : activeTicket.scaleGrossInWeight != null
        ? 'AWAITING_OUT'
        : 'AWAITING_IN';

  const previewBreakdown = (gross: number, tare: number) => {
    if (!selectedMetal) return null;
    try { return computeWeightBreakdown(gross, tare, deductionPercent, selectedMetal); }
    catch { return null; }
  };
  const selectedSingleBreakdown = singleCapture ? previewBreakdown(singleCapture.capturedLbs, singleCapture.tareLbs) : null;
  const singleCapturedNet = selectedSingleBreakdown?.netWeight ?? 0;

  const recordTransaction = (ticket: Ticket, type: WeightTransaction['type'], capture: WeightCapture): WeightTransaction[] => [
    ...(ticket.weightTransactions || []),
    {
      id: capture.id, type, weightLbs: capture.normalizedLbs,
      recordedAt: capture.capturedAt,
      operatorName: authService.getCurrentUser()?.fullName ?? storageService.getSettings().operatorName, capture,
      scaleName: scaleService.getCurrentScale()?.name,
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

  const commitInWeight = async (lbs: number, capture = makeCapture(lbs, false)) => {
    if (!activeTicket || weighingMode !== 'VEHICLE_IN_OUT' || !validateCapture(lbs)) return;
    if (activeTicket.scaleGrossInWeight != null) {
      toast.error('This intake already has an IN weight logged');
      return;
    }
    const next: Ticket = {
      ...activeTicket,
      scaleGrossInWeight: lbs,
      scaleGrossInAt: capture.capturedAt,
      scaleTareOutWeight: undefined,
      scaleTareOutAt: undefined,
      weightTransactions: recordTransaction(activeTicket, 'SCALE_IN', capture),
    };
    if (!await persist(next)) return;
    toast.success(`IN weight logged: ${fmtLbs(lbs)} LBS`, {
      description: `${activeTicket.customerName} is on the yard. Pick the metal grade below, then log the OUT weight after the load dumps.`,
    });
  };

  const commitOutWeight = async (lbs: number, capture = makeCapture(lbs, false)) => {
    if (!activeTicket || weighingMode !== 'VEHICLE_IN_OUT' || weighState !== 'AWAITING_OUT' || !validateCapture(lbs)) return;
    const grossIn = activeTicket.scaleGrossInWeight ?? 0;
    const net = grossIn - lbs;
    if (net <= 0) {
      toast.error('OUT weight must be lower than the IN weight', {
        description: `IN was ${fmtLbs(grossIn)} LBS — make sure the load was dumped before logging OUT.`,
      });
      return;
    }
    const next: Ticket = {
      ...activeTicket,
      scaleTareOutWeight: lbs,
      scaleTareOutAt: capture.capturedAt,
      weightTransactions: recordTransaction(activeTicket, 'SCALE_OUT', capture),
    };
    if (!await persist(next)) return;
    toast.success(`OUT weight logged: ${fmtLbs(lbs)} LBS`, {
      description: `Net scrap weight: ${fmtLbs(net)} LBS — review the grade and add the load to the ticket.`,
    });
  };

  const handleLogIn = () => {
    if (!assertScaleReady()) return;
    if (!scale.isStable) {
      setPendingUnstable({ direction: 'IN', lbs: currentLbs, capture: makeCapture(currentLbs, false) });
      return;
    }
    commitInWeight(currentLbs);
  };

  const handleLogOut = () => {
    if (!assertScaleReady()) return;
    if (!scale.isStable) {
      setPendingUnstable({ direction: 'OUT', lbs: currentLbs, capture: makeCapture(currentLbs, false) });
      return;
    }
    commitOutWeight(currentLbs);
  };

  // Manual fallback for when the live scale is offline or mis-reading.
  const parseManualWeight = (): number | null => {
    const lbs = Number(manualWeight);
    if (!Number.isFinite(lbs) || lbs <= 0) {
      toast.error('Enter a weight in pounds greater than zero');
      return null;
    }
    return lbs;
  };

  const handleManualLogIn = () => {
    const lbs = parseManualWeight();
    if (lbs === null) return;
    commitInWeight(lbs, makeCapture(lbs, true));
    setManualWeight('');
  };

  const handleManualLogOut = () => {
    const lbs = parseManualWeight();
    if (lbs === null) return;
    commitOutWeight(lbs, makeCapture(lbs, true));
    setManualWeight('');
  };

  const handleDiscardWeighing = () => {
    setCorrectionReason('');
    setCorrectionTarget({ action: 'TRUCK' });
  };

  // ---- Auto-capture engine -----------------------------------------------------
  // Watches the live poll: once a reading holds stable (and above the floor)
  // for the settle window, it commits itself as the armed IN/OUT weight.
  useEffect(() => {
    if (!autoCapture || !activeTicket || remoteConflict || weighingMode !== 'VEHICLE_IN_OUT' || !modeCompatible) return;
    const context = `${activeTicket.id}:${weighingMode}:${currentScaleId}:${weighState}`;
    if (autoCaptureContextRef.current !== context) {
      setAutoCapture(false);
      stableSinceRef.current = null;
      return;
    }
    if (!scale.connected || !scale.isStable || currentLbs <= AUTO_CAPTURE_MIN_LBS) {
      stableSinceRef.current = null;
      return;
    }
    if (stableSinceRef.current === null) {
      stableSinceRef.current = Date.now();
      return;
    }
    if (Date.now() - stableSinceRef.current < AUTO_CAPTURE_SETTLE_MS) return;

    // Stable long enough — fire and disarm.
    stableSinceRef.current = null;
    setAutoCapture(false);
    navigator.vibrate?.(40);

    if (weighState === 'AWAITING_IN') {
      commitInWeight(currentLbs);
    } else if (weighState === 'AWAITING_OUT') {
      const grossIn = activeTicket.scaleGrossInWeight ?? 0;
      const net = grossIn - currentLbs;
      if (net < AUTO_CAPTURE_MIN_LBS) {
        toast.error('Auto-capture cancelled', {
          description: `Stable reading ${fmtLbs(currentLbs)} LBS nets only ${fmtLbs(Math.max(0, net))} LBS against the ${fmtLbs(grossIn)} LBS IN weight — confirm the load was actually dumped, then re-arm.`,
        });
        return;
      }
      commitOutWeight(currentLbs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, currentLbs, autoCapture, activeTicket, weighState, weighingMode, currentScaleId, remoteConflict, modeCompatible]);

  // Context changes must disarm and discard any unconfirmed hardware prompt.
  useEffect(() => {
    setAutoCapture(false);
    stableSinceRef.current = null;
    autoCaptureContextRef.current = null;
    setPendingUnstable(null);
    setCorrectionTarget(null);
  }, [activeTicket?.id, weighState, currentScaleId, weighingMode]);

  // ---- Grade commit -----------------------------------------------------------
  const pendingBreakdown = activeTicket && weighState === 'PENDING_GRADE'
    ? previewBreakdown(activeTicket.scaleGrossInWeight ?? 0, activeTicket.scaleTareOutWeight ?? 0) : null;
  const pendingNet = pendingBreakdown?.netWeight ?? 0;
  const pendingDeductionLbs = pendingBreakdown?.deductionLbs ?? 0;
  const pendingBillable = pendingBreakdown?.billableWeight ?? 0;
  const pendingTotal = pendingBreakdown?.lineTotal ?? 0;
  const deductionReady = deductionPercent === 0 || deductionReason.trim().length > 0;

  const handleCommitLoad = async () => {
    if (!activeTicket || !canEdit() || weighState !== 'PENDING_GRADE') return;
    if (!selectedMetal || !pendingBreakdown || !deductionReady) {
      toast.error('Review valid weights, grade and a reason for any deduction');
      return;
    }
    const latestRate = storageService.getMetals().find((metal) => metal.id === selectedMetalId)?.ratePerLb;
    if (latestRate !== selectedMetal.ratePerLb) {
      toast.error('Buying rate changed. Reload this workstation and review the current rate before confirming.');
      return;
    }
    const lines = activeTicket.scrapLines || [];
    const newLine = buildScrapTicketLine(pendingBreakdown, selectedMetal, nextLoadNumber, 'VEHICLE_IN_OUT');
    newLine.sourceCaptureIds = (activeTicket.weightTransactions ?? []).filter((tx) =>
      (tx.type === 'SCALE_IN' && tx.recordedAt === activeTicket.scaleGrossInAt) ||
      (tx.type === 'SCALE_OUT' && tx.recordedAt === activeTicket.scaleTareOutAt)).map((tx) => tx.id);
    if (lines.some((line) => line.sourceCaptureIds?.some((id) => newLine.sourceCaptureIds?.includes(id)))) {
      toast.error('An IN/OUT capture has already been used in a payable line');
      return;
    }
    newLine.deductionReason = deductionPercent > 0 ? deductionReason.trim() : undefined;
    const next: Ticket = {
      ...activeTicket,
      scrapLines: [...lines, newLine],
      scaleGrossInWeight: undefined, scaleGrossInAt: undefined,
      scaleTareOutWeight: undefined, scaleTareOutAt: undefined,
    };
    if (!await persist(next)) return;
    setDeductionPercent(0);
    setDeductionReason('');
    toast.success(`Load ${newLine.loadNumber} added — add another load or review the ticket`);
  };

  // ---- Single-weight (small-load) capture --------------------------------------
  const scaleTareLbs = Number.isFinite(scale.tareWeight) && scale.tareWeight >= 0 && scale.tareWeight <= 1000000000
    ? normalizeWeight(scale.tareWeight, scale.unit) : NaN;
  const resolveSingleTare = (): number | null => {
    if (singleTareMode === 'NONE') return 0;
    if (singleTareMode === 'SCALE_TARE') {
      if (!scale.connected || !Number.isFinite(scaleTareLbs)) {
        toast.error('Scale-applied tare requires a connected scale with a valid tare');
        return null;
      }
      return scaleTareLbs;
    }
    const lbs = Number(singleManualTare);
    if (!singleManualTare.trim() || !Number.isFinite(lbs) || lbs < 0) {
      toast.error('Enter a valid tare weight in pounds');
      return null;
    }
    return lbs;
  };

  const captureSingle = async (lbs: number, isManual: boolean, capture = makeCapture(lbs, isManual)) => {
    if (!activeTicket || weighingMode !== 'SINGLE_WEIGHT' || singleCapture || !validateCapture(lbs)) return;
    const tareLbs = resolveSingleTare();
    if (tareLbs === null) return;
    if (tareLbs > lbs) {
      toast.error('Tare exceeds the captured gross weight');
      return;
    }
    if (!isManual && scaleTareLbs > 0 && singleTareMode !== 'SCALE_TARE') {
      toast.error('Scale tare is active. Select scale-applied tare or clear it before capture.');
      return;
    }
    const draft = { capturedLbs: lbs, tareLbs, tareTreatment: singleTareMode, isManual, capture };
    if (!await persist({ ...activeTicket, pendingPlatformCapture: draft,
      weightTransactions: recordTransaction(activeTicket, 'SINGLE_WEIGHT', capture) })) return;
    toast.success(`Captured ${fmtLbs(lbs)} LBS${isManual ? ' (manual)' : ''} — review this batch`);
  };

  const handleSingleCapture = () => {
    if (!scale.connected) {
      toast.error('Scale is not connected', { description: 'Use manual entry below, or check the scale host connection.' });
      return;
    }
    if (currentLbs <= 0) {
      toast.error('Scale is reading zero', { description: 'Place the small load on the platform before capturing.' });
      return;
    }
    if (!scale.isStable) {
      setPendingUnstable({ direction: 'SINGLE', lbs: currentLbs, capture: makeCapture(currentLbs, false) });
      return;
    }
    captureSingle(currentLbs, false);
  };

  const handleSingleManualCapture = () => {
    const lbs = Number(singleManualWeight);
    if (!Number.isFinite(lbs) || lbs <= 0) {
      toast.error('Enter a weight in pounds greater than zero');
      return;
    }
    captureSingle(lbs, true);
  };

  const handleCommitSingleLoad = async () => {
    if (!activeTicket || !canEdit() || !singleCapture || !selectedMetal) return;
    if (!selectedSingleBreakdown || !deductionReady) {
      toast.error('Review valid weights and a reason for any deduction');
      return;
    }
    if (storageService.getMetals().find((metal) => metal.id === selectedMetalId)?.ratePerLb !== selectedMetal.ratePerLb) {
      toast.error('Buying rate changed. Reload this workstation and review the current rate before confirming.');
      return;
    }
    const lines = activeTicket.scrapLines || [];
    if (lines.some((line) => line.sourceCaptureIds?.includes(singleCapture.capture.id))) {
      toast.error('This capture has already been added to a payable line');
      return;
    }
    const newLine = buildScrapTicketLine(selectedSingleBreakdown, selectedMetal, nextLoadNumber, 'SINGLE_WEIGHT');
    newLine.sourceCaptureIds = [singleCapture.capture.id];
    newLine.tareTreatment = singleCapture.tareTreatment;
    newLine.deductionReason = deductionPercent > 0 ? deductionReason.trim() : undefined;
    if (!await persist({ ...activeTicket, scrapLines: [...lines, newLine], pendingPlatformCapture: undefined })) return;
    setSingleTareMode('NONE');
    setSingleManualTare('');
    setSingleManualWeight('');
    setDeductionPercent(0);
    setDeductionReason('');
    toast.success(`Batch ${newLine.loadNumber} added — add another weight or review the ticket`);
  };

  const handleDiscardSingleCapture = () => {
    setCorrectionReason('');
    setCorrectionTarget({ action: 'PLATFORM' });
  };

  const handleRemoveLine = (id: string) => {
    setCorrectionReason('');
    setCorrectionTarget({ action: 'LINE', lineId: id });
  };

  const confirmCorrection = async () => {
    if (!activeTicket || !canEdit() || !correctionTarget || !correctionReason.trim()) return;
    const originalLine = activeTicket.scrapLines?.find((line) => line.id === correctionTarget.lineId);
    const truckIds = (activeTicket.weightTransactions ?? []).filter((tx) =>
      tx.recordedAt === activeTicket.scaleGrossInAt || tx.recordedAt === activeTicket.scaleTareOutAt).map((tx) => tx.id);
    const next: Ticket = { ...activeTicket, weighingCorrections: [...(activeTicket.weighingCorrections ?? []), {
      id: crypto.randomUUID(), at: new Date().toISOString(), actor: storageService.getSettings().operatorName,
      reason: correctionReason.trim(), action: originalLine ? 'REMOVE_LINE' : 'CANCEL_WEIGHING',
      sourceCaptureIds: originalLine?.sourceCaptureIds ?? (correctionTarget.action === 'PLATFORM' && singleCapture ? [singleCapture.capture.id] : truckIds),
      originalLine, originalGrossLbs: correctionTarget.action === 'PLATFORM' ? singleCapture?.capturedLbs : activeTicket.scaleGrossInWeight,
      originalTareLbs: correctionTarget.action === 'PLATFORM' ? singleCapture?.tareLbs : activeTicket.scaleTareOutWeight,
    }] };
    if (correctionTarget.action === 'LINE') next.scrapLines = (activeTicket.scrapLines ?? []).filter((line) => line.id !== correctionTarget.lineId);
    else if (correctionTarget.action === 'PLATFORM') next.pendingPlatformCapture = undefined;
    else { next.scaleGrossInWeight = undefined; next.scaleGrossInAt = undefined; next.scaleTareOutWeight = undefined; next.scaleTareOutAt = undefined; }
    if (!await persist(next)) return;
    setCorrectionTarget(null);
    setSingleTareMode('NONE'); setSingleManualTare(''); setSingleManualWeight('');
    setDeductionPercent(0); setDeductionReason('');
    toast.info('Correction recorded; original readings retained');
  };

  // ---- Queue ------------------------------------------------------------------
  const handleSwitch = (ticket: Ticket) => {
    if (ticket.id === activeTicket?.id) return;
    setActiveTicket(ticket);
    setRemoteConflict(false);
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
    if (t.pendingPlatformCapture || (t.scaleGrossInWeight == null && (t.scrapLines?.length ?? 0) > 0)) {
      return { label: t.pendingPlatformCapture ? 'REVIEW PLATFORM BATCH' : 'REVIEW TICKET / ADD LOAD', badge: <Badge className="border border-teal-500/50 bg-teal-950 text-[9px] text-teal-200">{t.pendingPlatformCapture ? 'REVIEW BATCH' : 'REVIEW TICKET'}</Badge> };
    }
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
  const handleNotesBlur = async () => {
    if (!activeTicket || !canEdit()) return;
    const trimmed = notes.trim();
    if (trimmed !== (activeTicket.notes || '')) {
      await persist({ ...activeTicket, notes: trimmed || activeTicket.notes });
    }
  };

  const handleComplete = async () => {
    if (!activeTicket || !canEdit() || busyRef.current) return;
    if (!reviewConfirmed || singleCapture || activeTicket.scaleGrossInWeight != null || lines.length === 0) {
      toast.error('Complete every cycle and explicitly confirm final seller/material review first'); return;
    }
    if (notes.trim() !== (activeTicket.notes ?? '').trim() && !await persist({...activeTicket,notes:notes.trim()})) return;
    busyRef.current = true; setSaveState('PENDING'); setSaveError('');
    try {
      const current = storageService.getTickets().find((ticket) => ticket.id === activeTicket.id) ?? activeTicket;
      const completed = await scrapBuyingService.finalize(current);
      setSaveState('SAVED'); refreshQueue();
      toast.success(`Ticket #${completed.id} finalized — UNPAID voucher. Payment is a separate manager action.`);
      setActiveTicket(null); onActiveTicketChange(null); setNotes(''); onTicketCreated(completed);
      void serverQueue.refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Finalization was not confirmed';
      setSaveState('ERROR'); setSaveError(message); toast.error(message);
    } finally { busyRef.current = false; }
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

  const deductionReasonField = deductionPercent > 0 ? (
    <div className="space-y-1">
      <Label htmlFor={`deduction-reason-${weighingMode}`} className="text-xs text-amber-200">Deduction reason (required)</Label>
      <Input id={`deduction-reason-${weighingMode}`} value={deductionReason} onChange={(event) => setDeductionReason(event.target.value)} placeholder="e.g. visible dirt or non-metal contamination" className="h-11 rounded-xl border-amber-500/50 bg-slate-950 text-white" />
    </div>
  ) : null;

  // Hands-free capture arm — used in both the IN and OUT steps.
  const autoCaptureToggle = (
    <button
      type="button"
      onClick={() => {
        autoCaptureContextRef.current = autoCapture ? null : `${activeTicket?.id}:${weighingMode}:${currentScaleId}:${weighState}`;
        stableSinceRef.current = null;
        setAutoCapture(!autoCapture);
      }}
      disabled={!scale.connected || !modeCompatible || remoteConflict}
      className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all active:scale-[0.99] ${
        autoCapture
          ? 'border-emerald-500 bg-emerald-950/80 text-emerald-300 ring-1 ring-emerald-500/40'
          : 'border-dashed border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-500 hover:text-slate-200 disabled:opacity-40'
      }`}
    >
      <Radar className={`h-4 w-4 ${autoCapture ? 'animate-pulse' : ''}`} />
      {autoCapture
        ? `AUTO-CAPTURE ARMED — logs when stable (${AUTO_CAPTURE_SETTLE_MS / 1000}s)`
        : 'Arm Auto-Capture (logs when the reading settles)'}
    </button>
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
      <div role="status" aria-live="polite" className={`rounded-xl border p-3 text-sm ${saveState === 'ERROR' || serverQueue.isError ? 'border-amber-500 bg-amber-950 text-amber-100' : 'border-emerald-800 bg-emerald-950 text-emerald-100'}`}>
        {saveState === 'PENDING' ? 'Saving / loading server draft — not yet confirmed' : saveState === 'ERROR' ? `Not confirmed: ${saveError}` : serverQueue.isError ? 'Shared queue refresh failed. Current work remains on this desk.' : 'Server draft acknowledged · payments are separate'}
      </div>
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
              Check in the seller, choose a weighing type, then add as many reviewed batches or load cycles as needed.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={currentScaleId || 'none'}
            onValueChange={(val) => requestScaleSwitch(val === 'none' ? null : val)}
          >
            <SelectTrigger className="h-8 w-52 gap-2 border-slate-700 bg-slate-800 text-xs text-white">
              <span className={`h-2 w-2 shrink-0 rounded-full ${accent.dot}`} />
              <SelectValue placeholder="Active Scale" />
            </SelectTrigger>
            <SelectContent className="border-slate-700 bg-slate-900 text-white">
              <SelectItem value="none">No Scale</SelectItem>
              {scales.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${scaleAccent(s.accentColor).dot}`} />
                    {s.name}
                    {s.location ? ' (' + s.location + ')' : ''}
                    {s.weighingMode === 'SINGLE_WEIGHT' && (
                      <Badge className="ml-1 border border-violet-500/40 bg-violet-500/15 text-[8px] text-violet-300">SMALL</Badge>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                      <div className="text-slate-300">{Math.max(0, Math.floor((Date.now() - Date.parse(ticket.createdAt)) / 60000))} min · {ticket.operatorName || 'Unassigned'}</div>
                      <div className="text-teal-200">{ticket.pendingPlatformCapture ? 'Platform' : ticket.scaleGrossInWeight != null ? 'Truck IN/OUT' : ticket.selectedWeighingType === 'PLATFORM' ? 'Platform' : ticket.selectedWeighingType === 'VEHICLE_IN_OUT' ? 'Truck IN/OUT' : 'Choose weighing type'} · {status.label}</div>
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

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSwitch(ticket)}
                        className="h-8 flex-1 gap-1.5 bg-emerald-600 text-xs font-bold text-white shadow hover:bg-emerald-500"
                      >
                        <Scale className="h-3.5 w-3.5" /> {isCurrent ? 'Continue This Intake' : 'Switch to This Intake'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setVoidTarget(ticket)}
                        title="Void this intake"
                        className="h-8 w-9 shrink-0 border-slate-800 bg-slate-950 p-0 text-slate-500 hover:border-red-500/40 hover:bg-red-950/40 hover:text-red-400"
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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

            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setVoidTarget(activeTicket)}
                className="gap-1.5 border-red-500/40 bg-red-950/30 text-xs font-bold text-red-400 hover:bg-red-950/60 hover:text-red-300"
              >
                <Ban className="h-3.5 w-3.5" /> Void Transaction
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSwitchAway}
                className="gap-1.5 border-slate-700 bg-slate-950 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <Layers className="h-3.5 w-3.5" /> Save &amp; Switch Transaction
              </Button>
            </div>
          </div>

          {remoteConflict && <div role="alert" className="rounded-xl border border-amber-500 bg-amber-950 p-4 text-sm text-amber-100">This ticket changed or closed remotely. Your review is preserved, but writes are blocked. Use Save &amp; Switch Transaction to return to the queue.</div>}
          <WeighingTypeSelector value={selectedWeighingType} scale={activeScale}
            locked={remoteConflict || singleCapture !== null || activeTicket.scaleGrossInWeight != null} onSelect={selectWeighingType} />
          {selectedWeighingType && !modeCompatible && <p role="alert" className="rounded-xl border border-amber-500/60 bg-amber-950 p-3 text-sm text-amber-100">Selected mode is incompatible with this scale. Select a compatible scale; existing readings have not been changed.</p>}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left: weighing + lines */}
            <div className="space-y-6 lg:col-span-2">
              <fieldset disabled={!modeCompatible || remoteConflict || saveState === 'PENDING'} className="min-w-0 space-y-6">
              {weighingMode === 'SINGLE_WEIGHT' && (
                <Card className="border-violet-500/40 bg-slate-900 text-white shadow-lg">
                  <CardHeader className="flex flex-row items-center justify-between border-b border-violet-500/30 bg-violet-950/20 px-4 py-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-violet-200">
                      <PackageCheck className="h-4 w-4 text-violet-400" /> Platform Batch #{nextLoadNumber}
                    </CardTitle>
                    <Badge className="border border-emerald-500/50 bg-emerald-950 text-emerald-300 font-mono text-[10px]">
                      {singleCapture ? 'REVIEW BATCH' : 'ADD ANOTHER WEIGHT'}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4 p-4">
                    <div className="rounded-xl border border-slate-800 bg-black/90 p-4">
                      <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
                        <span>{activeScale?.name || 'Active scale'} · LIVE READING</span>
                        <Badge className={scale.connected ? scale.isStable ? 'bg-emerald-950/60 text-emerald-400' : 'animate-pulse bg-amber-950/60 text-amber-400' : 'bg-red-950/60 text-red-400'}>
                          {!scale.connected ? 'OFFLINE' : scale.isStable ? 'STABLE' : 'MOTION'}
                        </Badge>
                      </div>
                      <div className="my-3 flex items-baseline justify-center gap-2 font-mono">
                        <span className="text-5xl font-extrabold text-violet-300 sm:text-6xl">{fmtLbs(currentLbs)}</span>
                        <span className="text-xl font-bold text-slate-400">LBS</span>
                      </div>
                      <p className="text-center text-[10px] text-slate-500">Display: {scale.unit} · Stored weights: LBS</p>
                    </div>

                    {!singleCapture ? (
                      <>
                        {gradeSelector}
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-slate-300">Tare for this load</Label>
                          <Select value={singleTareMode} onValueChange={(v) => setSingleTareMode(v as SingleTareMode)}>
                            <SelectTrigger className="h-11 border-slate-800 bg-slate-950 text-xs text-white"><SelectValue /></SelectTrigger>
                            <SelectContent className="border-slate-800 bg-slate-900 text-white">
                              <SelectItem value="NONE">No container tare — gross equals net</SelectItem>
                              <SelectItem value="SCALE_TARE">Scale-applied tare ({fmtLbs(scaleTareLbs)} LBS) — subtract once from gross</SelectItem>
                              <SelectItem value="MANUAL">Manual container tare — gross reading required</SelectItem>
                            </SelectContent>
                          </Select>
                          {singleTareMode === 'MANUAL' && (
                            <Input type="number" min={0} value={singleManualTare} onChange={(e) => setSingleManualTare(e.target.value)} placeholder="Tare in LBS" className="h-11 border-slate-800 bg-slate-950 font-mono text-white" />
                          )}
                        </div>
                        <Button onClick={handleSingleCapture} disabled={!scale.connected || !scale.isStable || currentLbs <= 0} className="h-16 w-full gap-2 bg-violet-600 text-base font-extrabold text-white hover:bg-violet-500 disabled:bg-slate-800 disabled:text-slate-500">
                          <Scale className="h-6 w-6" /> Capture Stable Weight
                        </Button>
                        <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-950/20 p-3">
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Manual fallback — offline capture (LBS)</Label>
                          <div className="mt-2 flex gap-2">
                            <Input type="number" min={0} value={singleManualWeight} onChange={(e) => setSingleManualWeight(e.target.value)} placeholder="e.g. 85" className="h-11 border-slate-700 bg-slate-950 font-mono text-white" />
                            <Button onClick={handleSingleManualCapture} className="h-11 shrink-0 gap-1.5 bg-amber-700 text-xs font-bold text-white hover:bg-amber-600"><Keyboard className="h-4 w-4" /> Capture Manual</Button>
                          </div>
                          <p className="mt-1 text-[10px] text-amber-200/70">Manual entries are clearly marked and are not connected live readings.</p>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2 font-mono sm:grid-cols-4">
                          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><span className="block text-[10px] text-slate-400">SINGLE / GROSS</span><span className="text-lg font-bold text-violet-300">{fmtLbs(singleCapture.capturedLbs)} LBS</span>{singleCapture.isManual && <Badge className="mt-1 bg-amber-500/15 text-[9px] text-amber-300">MANUAL</Badge>}</div>
                          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><span className="block text-[10px] text-slate-400">TARE USED</span><span className="text-lg font-bold text-amber-300">{fmtLbs(singleCapture.tareLbs)} LBS</span></div>
                          <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3"><span className="block text-[10px] text-emerald-300">FINAL NET</span><span className="text-lg font-black text-emerald-400">{fmtLbs(singleCapturedNet)} LBS</span></div>
                          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><span className="block text-[10px] text-slate-400">RATE</span><span className="text-lg font-bold text-white">${selectedMetal?.ratePerLb.toFixed(2) || '0.00'}/lb</span></div>
                        </div>
                        {gradeSelector}
                        <div><Label className="text-[11px] text-slate-400">Contamination %</Label><Input type="number" min={0} max={100} value={deductionPercent} onChange={(e) => setDeductionPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))} className="mt-1 h-11 border-slate-800 bg-slate-950 font-mono text-base text-red-400" /></div>
                        {deductionReasonField}
                        <p className="text-xs text-slate-300">Tare treatment: {singleCapture.tareTreatment === 'NONE' ? 'no container tare' : singleCapture.tareTreatment === 'SCALE_TARE' ? 'scale-applied tare, subtracted once from gross' : 'manual container tare'}. Tare and deduction settings reset for every new batch.</p>
                        {!selectedSingleBreakdown && <p role="alert" className="text-sm text-amber-200">Invalid weights or rate. Correct this batch before confirming.</p>}
                        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-xs"><span className="text-slate-400">{fmtLbs(singleCapturedNet)} lb net − {fmtLbs(selectedSingleBreakdown?.deductionLbs)} lb ded = <span className="font-bold text-white">{fmtLbs(selectedSingleBreakdown?.billableWeight)} lb billable</span></span><span className="font-extrabold text-emerald-400">${(selectedSingleBreakdown?.lineTotal || 0).toFixed(2)}</span></div>
                        <div className="flex gap-2"><Button onClick={handleCommitSingleLoad} disabled={!selectedSingleBreakdown || !deductionReady} className="h-12 flex-1 gap-2 bg-emerald-600 text-sm font-extrabold text-white hover:bg-emerald-500"><PackagePlus className="h-5 w-5" /> Add Weight · Keep Ticket Open</Button><Button variant="outline" onClick={handleDiscardSingleCapture} className="h-12 border-slate-700 bg-slate-950 text-xs text-slate-400 hover:text-red-400"><Trash2 className="h-4 w-4" /> Cancel</Button></div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card className={`${weighingMode !== 'VEHICLE_IN_OUT' ? 'hidden ' : ''}border-slate-800 bg-slate-900 text-white shadow-lg`}>
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 bg-slate-950/60 px-4 py-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-300">
                    <Scale className="h-4 w-4 text-emerald-400" /> Truck Load Cycle #{nextLoadNumber}
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
                      <span className="flex items-center gap-1.5">
                        GROSS: {scale.grossWeight.toLocaleString()} {scale.unit}
                        {activeScale && (
                          <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${accent.chipBorder} ${accent.chipBg} ${accent.chipText}`}>
                            {activeScale.name}
                            {activeScaleIsSmall && <span className="ml-1 rounded border border-violet-500/40 bg-violet-500/15 px-1 py-0.5 text-[8px] text-violet-300">SMALL</span>}
                          </span>
                        )}
                      </span>
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
                      {autoCaptureToggle}
                      <p className="text-center text-[11px] text-slate-400">
                        Vehicle drives ON with the load. The IN weight is saved to this intake instantly — switch to another
                        transaction and come back later to log the OUT.
                        <span className="ml-1 whitespace-nowrap rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[9px] text-slate-300">Alt+I</span>
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
                        {activeTicket.scaleGrossInAt && (
                          <Badge className="border border-amber-500/40 bg-amber-500/10 font-mono text-[9px] text-amber-300">
                            ON YARD {Math.max(0, Math.round((Date.now() - new Date(activeTicket.scaleGrossInAt).getTime()) / 60000))} MIN
                          </Badge>
                        )}
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
                      {autoCaptureToggle}
                      <p className="text-center text-[11px] text-slate-400">
                        After the load is dumped, the empty vehicle drives back ON. Net = IN − OUT.
                        Different grades require separately measured, non-overlapping loads; do not assign this net to multiple grades.
                        <span className="ml-1 whitespace-nowrap rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[9px] text-slate-300">Alt+O</span>
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
                      {deductionReasonField}
                      {!pendingBreakdown && <p role="alert" className="text-sm text-amber-200">Invalid weights or rate. Correct this weighing before confirming.</p>}

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
                          disabled={!pendingBreakdown || !deductionReady}
                          className="h-12 flex-1 gap-2 bg-emerald-600 text-sm font-extrabold text-white shadow-md hover:bg-emerald-500"
                        >
                          <PackagePlus className="h-5 w-5" /> Add Load · Keep Ticket Open
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
              </fieldset>

              {/* Lines table */}
              <Card className="overflow-hidden border-slate-800 bg-slate-900 text-white shadow-lg">
                <CardHeader className="border-b border-slate-800 bg-slate-950/60 px-4 py-3">
                  <CardTitle className="text-sm font-bold uppercase tracking-wide text-slate-300">
                    Weighed Loads on This Ticket ({lines.length})
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-0">
                  {lines.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-300">
                      No reviewed lines yet. Choose a weighing type, capture a batch or complete a load cycle, then review and add it here. Each separately measured batch or load keeps its own weight and payout.
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
                              <div className="flex items-center gap-2">
                                {line.metalName}
                                <Badge className="border border-violet-500/40 bg-violet-500/15 text-[9px] text-violet-300">{line.weighingMode === 'SINGLE_WEIGHT' ? 'PLATFORM' : line.weighingMode === 'VEHICLE_IN_OUT' ? 'TRUCK IN/OUT' : 'LEGACY / UNSPECIFIED'}</Badge>
                              </div>
                              <span className="block text-[10px] text-slate-400">{line.metalCategory}</span>
                            </TableCell>
                            <TableCell className="text-slate-400">
                              {line.weighingMode === 'SINGLE_WEIGHT' ? `${fmtLbs(line.grossWeight)} single / ${fmtLbs(line.tareWeight)} tare` : `${fmtLbs(line.grossWeight)} / ${fmtLbs(line.tareWeight)}`}
                            </TableCell>
                            <TableCell className="text-right text-slate-300">{fmtLbs(line.netWeight)} lb</TableCell>
                            <TableCell className="text-right text-red-400">
                              {line.deductionPercent > 0 ? `−${fmtLbs(line.deductionLbs)} lb (${line.deductionPercent}%)` : '—'}
                              {line.deductionReason && <span className="block text-[10px] text-slate-300">{line.deductionReason}</span>}
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

              {/* Weighing audit trail — platform + operator stamps for every captured reading */}
              {(activeTicket.weightTransactions?.length ?? 0) > 0 && (
                <Card className="overflow-hidden border-slate-800 bg-slate-900 text-white shadow-lg">
                  <CardHeader className="border-b border-slate-800 bg-slate-950/60 px-4 py-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-300">
                      <ShieldCheck className="h-4 w-4 text-sky-400" /> Weighing Audit Trail
                      <Badge className="border border-slate-700 bg-slate-950 font-mono text-[9px] text-slate-400">
                        {activeTicket.weightTransactions!.length} READINGS
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-800/80">
                      {[...activeTicket.weightTransactions!].reverse().map((tx) => (
                        <div key={tx.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2 font-mono text-[11px]">
                          <div className="flex items-center gap-2.5">
                            <Badge
                              className={`font-mono text-[9px] font-bold ${
                                tx.type === 'SCALE_IN'
                                  ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                                  : tx.type === 'SCALE_OUT'
                                    ? 'border border-amber-500/40 bg-amber-500/15 text-amber-300'
                                    : 'border border-violet-500/40 bg-violet-500/15 text-violet-300'
                              }`}
                            >
                              {tx.type === 'SCALE_IN' ? 'IN' : tx.type === 'SCALE_OUT' ? 'OUT' : 'SINGLE'}
                            </Badge>
                            <span className="font-bold text-white">{fmtLbs(tx.weightLbs)} LBS</span>
                            <span className="text-slate-400">{tx.scaleName || 'Unstamped platform'}</span>
                            {tx.capture && <span className="text-amber-200">{tx.capture.originalWeight} {tx.capture.originalUnit} · {tx.capture.source === 'MANUAL' ? 'MANUAL' : tx.capture.stable ? 'STABLE' : 'UNSTABLE OVERRIDE'}</span>}
                          </div>
                          <span className="text-slate-500">
                            {tx.operatorName || '—'} ·{' '}
                            {new Date(tx.recordedAt).toLocaleString([], {
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                    {(activeTicket.weighingCorrections ?? []).map((correction) => <div key={correction.id} className="border-t border-amber-500/30 px-4 py-3 text-xs text-amber-100"><strong>{correction.action === 'REMOVE_LINE' ? 'Line removed' : 'Weighing cancelled'}</strong> · {correction.reason}<span className="mt-1 block text-slate-300">{correction.actor} · {new Date(correction.at).toLocaleString()} · {correction.sourceCaptureIds.length} linked reading(s)</span></div>)}
                    <p className="border-t border-slate-800 px-4 py-2 text-[10px] text-slate-300">
                      This workstation preserves original readings and audited cancellations. Server-enforced immutability and transactional migration remain a release gate.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Finalize purchase separately from disbursement */}
            <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-white">
              <h2 className="text-base font-bold">Final purchase review</h2>
              <p className="rounded-xl border border-amber-500/40 bg-amber-950 p-3 text-xs text-amber-100">Finalization creates an UNPAID voucher. A manager records actual cash disbursement or check issuance separately in the buying payment queue.</p>
              <div className="space-y-2 rounded-xl bg-slate-950 p-4 font-mono text-sm">
                <div className="flex justify-between"><span>Reviewed lines</span><strong>{lines.length}</strong></div>
                <div className="flex justify-between"><span>Payable pounds</span><strong>{fmtLbs(totalBillableWeight)} lb</strong></div>
                <div className="flex justify-between text-emerald-300"><span>Purchase amount</span><strong>${totalPayout.toFixed(2)}</strong></div>
              </div>
              <Label htmlFor="canonical-ticket-notes">Ticket notes</Label>
              <Textarea id="canonical-ticket-notes" value={notes} onChange={(event) => setNotes(event.target.value)} onBlur={handleNotesBlur} disabled={saveState === 'PENDING' || remoteConflict} className="rounded-xl border-slate-700 bg-slate-950 text-white" />
              {(singleCapture || activeTicket.scaleGrossInWeight != null) && <p role="alert" className="text-sm text-amber-200">Unfinished weighing blocks finalization. Finish or explicitly cancel it first.</p>}
              <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs leading-relaxed text-slate-100">
                {requirements.data ? <><p className="font-semibold">Yard requirements · revision {requirements.data.revision}</p><p className="mt-1">Photos: {requirements.data.requirePhotos ? 'Required' : 'Optional'} · Phone: {requirements.data.requirePhone ? 'Required' : 'Optional'} · Address: {requirements.data.requireAddress ? 'Required' : 'Optional'}</p><p className="mt-2 text-amber-100">Missing optional information is recorded on the voucher; identity, completed weights and payment checks stay protected.</p></> : <p role="status">Loading yard requirements…</p>}
                <a href="/settings#intake-requirements" className="mt-2 inline-block text-emerald-200 underline">Administrator requirement settings</a>
                {requirements.isError && <p role="alert" className="mt-2 text-amber-200">Requirements could not refresh. <button onClick={() => void requirements.refetch()} className="underline">Retry</button> before finalizing.</p>}
              </div>
              <label className="flex items-start gap-2 rounded-xl border border-slate-700 p-3 text-xs leading-relaxed"><input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} className="mt-0.5 accent-emerald-500" />I reviewed seller identity, the required information above, each separately measured grade, rates and deductions. Any missing optional information will remain clearly recorded.</label>
              <Button onClick={handleComplete} disabled={!reviewConfirmed || !requirements.data || requirements.isError || !lines.length || !!singleCapture || activeTicket.scaleGrossInWeight != null || remoteConflict || saveState === 'PENDING'} className="h-12 w-full rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-500">Finalize intake & open voucher</Button>
            </div>
          </div>
        </>
      )}

      {/* Mid-weighing platform switch guard */}
      <AlertDialog
        open={pendingScaleSwitch !== null}
        onOpenChange={(open) => { if (!open) setPendingScaleSwitch(null); }}
      >
        <AlertDialogContent className="border-slate-700 bg-slate-900 text-white rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-white">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Switch scale mid-weighing?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              Intake <span className="font-mono font-bold text-white">#{activeTicket?.id}</span> has unfinished weighing work.
              {singleCapture ? ' Finish the platform batch or explicitly cancel it with a reason before switching scales. No reading will be discarded.' : ' The IN reading is already saved. Switching changes the platform used for the OUT reading; the selected mode must remain compatible. Confirm the equipment is appropriate before proceeding.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white">
              Keep Current Platform
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={singleCapture !== null}
              onClick={() => {
                if (pendingScaleSwitch && !singleCapture) applyScaleSwitch(pendingScaleSwitch.id);
                setPendingScaleSwitch(null);
              }}
              className="bg-amber-600 font-bold text-white hover:bg-amber-500 disabled:opacity-50"
            >
              Switch Platform
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unstable-reading capture guard */}
      <AlertDialog
        open={pendingUnstable !== null}
        onOpenChange={(open) => { if (!open) setPendingUnstable(null); }}
      >
        <AlertDialogContent className="rounded-2xl border-slate-700 bg-slate-900 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-white">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Weight is still in motion
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              The platform hasn't settled yet. Current reading:{' '}
              <span className="font-mono font-bold text-amber-300">{fmtLbs(pendingUnstable?.lbs)} LBS</span> for the{' '}
              <span className="font-bold text-white">
                {pendingUnstable?.direction === 'IN' ? 'IN (gross)' : pendingUnstable?.direction === 'OUT' ? 'OUT (tare)' : 'single-weight'}
              </span>{' '}
              weight. Capturing now may log an inaccurate weight — or wait a moment for the{' '}
              <span className="font-mono font-bold text-emerald-400">STABLE</span> indicator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white">
              Wait for Stable
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingUnstable) {
                  if (pendingUnstable.direction === 'IN') commitInWeight(pendingUnstable.lbs, pendingUnstable.capture);
                  else if (pendingUnstable.direction === 'OUT') commitOutWeight(pendingUnstable.lbs, pendingUnstable.capture);
                  else captureSingle(pendingUnstable.lbs, false, pendingUnstable.capture);
                }
                setPendingUnstable(null);
              }}
              className="bg-amber-600 font-bold text-white hover:bg-amber-500"
            >
              Capture {pendingUnstable?.direction === 'IN' ? 'IN' : pendingUnstable?.direction === 'OUT' ? 'OUT' : 'Single'} Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={correctionTarget !== null} onOpenChange={(open) => { if (!open) setCorrectionTarget(null); }}>
        <AlertDialogContent className="rounded-2xl border-slate-700 bg-slate-900 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Record weighing correction</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">{correctionTarget?.action === 'LINE' ? 'Remove this reviewed line from the payable total?' : 'Cancel this unfinished weighing?'} Original readings and the correction reason will remain in this ticket’s audit history.</AlertDialogDescription>
          </AlertDialogHeader>
          <Label htmlFor="weighing-correction-reason">Reason (required)</Label>
          <Textarea id="weighing-correction-reason" value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} className="rounded-xl border-slate-700 bg-slate-950 text-white" />
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 bg-slate-800 text-white hover:bg-slate-700">Keep weighing</AlertDialogCancel>
            <AlertDialogAction disabled={!correctionReason.trim() || remoteConflict} onClick={confirmCorrection} className="bg-amber-700 text-white hover:bg-amber-600">Confirm audited correction</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Void a transaction at any stage — active panel or a queued intake */}
      <VoidTicketDialog
        ticket={voidTarget}
        open={voidTarget !== null}
        onOpenChange={(open) => { if (!open) setVoidTarget(null); }}
        onVoided={handleTicketVoided}
      />
    </div>
  );
};
