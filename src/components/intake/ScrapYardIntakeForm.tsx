import React, { useState, useEffect } from 'react';
import { Customer, MetalGrade, ScrapTicketLine, Ticket, WeightUnit, ComplianceCaptures } from '@/types/scrap';
import { storageService } from '@/services/storageService';
import { optimizeImageDataUrl, uploadDataUrl } from '@/services/mediaService';
import { EntranceLprMonitor } from './EntranceLprMonitor';
import { LiveScaleGauge } from '../scale/LiveScaleGauge';
import { ComplianceCaptureModal } from '../compliance/ComplianceCaptureModal';
import { calculateComplianceScore } from '@/utils/complianceUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Scale,
  Plus,
  Trash2,
  User,
  DollarSign,
  ArrowLeft,
  ArrowRight,
  Truck,
  CheckCircle2,
  Camera,
  Package,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  FileCheck,
  Check,
  Tablet,
  Laptop,
  Clock,
  Layers,
  Search,
  Upload,
  RefreshCw,
  Hash,
  Phone,
  ScaleWeight,
} from 'lucide-react';
import { toast } from 'sonner';

interface ScrapYardIntakeFormProps {
  onBack: () => void;
  onTicketCreated: (ticket: Ticket) => void;
}

const MAX_ACTIVE_LOADS = 10;

export const ScrapYardIntakeForm: React.FC<ScrapYardIntakeFormProps> = ({ onBack, onTicketCreated }) => {
  // Step 1: Field / Mobile Intake (Customer & Compliance Studio)
  // Step 2: Office PC Scale (Weight Entry, Metal Lines & Statutory Payout)
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Loaded or active ticket ID
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  // Editable Receipt / Ticket Number
  const [customReceiptNumber, setCustomReceiptNumber] = useState<string>(
    storageService.generateScrapReceiptNumber()
  );

  const [metals] = useState<MetalGrade[]>(storageService.getMetals());
  const [customers] = useState<Customer[]>(storageService.getCustomers());

  // Pending Tickets Queue / Group
  const [pendingTickets, setPendingTickets] = useState<Ticket[]>([]);
  const [pendingSearch, setPendingSearch] = useState('');
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);

  // Customer Credentials (Manual Entry Only - No OCR)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerIdNumber, setCustomerIdNumber] = useState<string>('');
  const [vehicleLicensePlate, setVehicleLicensePlate] = useState<string>('');

  // Compliance Captures
  const [complianceCaptures, setComplianceCaptures] = useState<ComplianceCaptures>({
    personPhotoUrl: undefined,
    idPhotoUrl: undefined,
    vehiclePhotoUrl: undefined,
    licensePlatePhotoUrl: undefined,
    loadPhotoUrl: undefined,
  });
  const [isComplianceModalOpen, setIsComplianceModalOpen] = useState(false);

  // Weighed Scrap Lines
  const [lines, setLines] = useState<ScrapTicketLine[]>([]);

  // Scale & Item Entry
  const [selectedMetalId, setSelectedMetalId] = useState<string>(metals[0]?.id || '');
  const [grossWeight, setGrossWeight] = useState<number>(0);
  const [tareWeight, setTareWeight] = useState<number>(0);
  const [deductionPercent, setDeductionPercent] = useState<number>(0);

  const [weighingMode, setWeighingMode] = useState<'SINGLE_ITEM' | 'VEHICLE_DOUBLE'>('SINGLE_ITEM');
  const [vehicleGrossIn, setVehicleGrossIn] = useState<number>(0);
  const [vehicleTareOut, setVehicleTareOut] = useState<number>(0);
  const [isGrossInCaptured, setIsGrossInCaptured] = useState(false);
  const [isTareOutCaptured, setIsTareOutCaptured] = useState(false);

  // Payout Method State
  const [payoutMethod, setPayoutMethod] = useState<'Cash' | 'Check'>('Cash');
  const [checkNumber, setCheckNumber] = useState<string>('CHK-' + Math.floor(1000 + Math.random() * 9000));
  const [notes, setNotes] = useState<string>('');

  const complianceStats = calculateComplianceScore(complianceCaptures);

  const handleAutoGenerateReceiptNumber = () => {
    const newNum = storageService.generateScrapReceiptNumber();
    setCustomReceiptNumber(newNum);
    toast.info(`Generated Receipt #${newNum}`);
  };

  // Refresh active ticket drafts and pending tickets
  const refreshPendingTickets = () => {
    const allTickets = storageService.getTickets();
    const activeLoads = allTickets.filter(
      (ticket) => ticket.ticketType === 'SCRAP_METAL' && (ticket.status === 'DRAFT' || ticket.status === 'PENDING')
    );
    setPendingTickets(activeLoads.slice(0, MAX_ACTIVE_LOADS));
  };

  useEffect(() => {
    refreshPendingTickets();
  }, []);

  const handleCustomerSelect = (custId: string) => {
    setSelectedCustomerId(custId);
    const cust = customers.find((c) => c.id === custId);
    if (cust) {
      setCustomerName(cust.fullName);
      setCustomerPhone(cust.phone || '');
      setCustomerIdNumber(cust.idNumber);
      if (cust.vehicleLicensePlate) setVehicleLicensePlate(cust.vehicleLicensePlate);
      if (cust.idPhotoUrl) {
        setComplianceCaptures((prev) => ({
          ...prev,
          idPhotoUrl: cust.idPhotoUrl || prev.idPhotoUrl,
        }));
      }
    }
  };

  const handleApplyComplianceCaptures = (captures: ComplianceCaptures) => {
    setComplianceCaptures(captures);
    toast.success('Compliance photos captured');
  };

  const hasCurrentWork = () => Boolean(
    customerName.trim() || customerPhone.trim() || customerIdNumber.trim() || vehicleLicensePlate.trim() || lines.length || notes.trim()
  );

  const saveCurrentDraft = (quiet = false, requestedStatus?: 'DRAFT' | 'PENDING') => {
    if (!hasCurrentWork()) return true;
    if (!customerName.trim()) {
      if (!quiet) toast.error('Enter a customer or driver name before saving this active load');
      return false;
    }

    const activeTickets = storageService.getTickets().filter(
      (ticket) => ticket.ticketType === 'SCRAP_METAL' && (ticket.status === 'DRAFT' || ticket.status === 'PENDING')
    );
    const isExistingActiveTicket = activeTickets.some((ticket) => ticket.id === activeTicketId || ticket.id === customReceiptNumber.trim());
    if (!isExistingActiveTicket && activeTickets.length >= MAX_ACTIVE_LOADS) {
      toast.error(`Up to ${MAX_ACTIVE_LOADS} loads can be active at one time. Complete or remove one before starting another.`);
      return false;
    }

    const ticketId = customReceiptNumber.trim() || storageService.generateScrapReceiptNumber();
    const existingTicket = activeTickets.find((ticket) => ticket.id === activeTicketId || ticket.id === ticketId);
    if (activeTicketId && activeTicketId !== ticketId) {
      const update = storageService.updateTicketId(activeTicketId, ticketId);
      if (!update.success) {
        toast.error(update.message || 'Could not update the active load number');
        return false;
      }
    }

    const payoutTotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const draftTicket: Ticket = {
      id: ticketId,
      ticketType: 'SCRAP_METAL',
      createdAt: existingTicket?.createdAt || new Date().toISOString(),
      status: requestedStatus || (existingTicket?.status === 'PENDING' ? 'PENDING' : 'DRAFT'),
      customerId: selectedCustomerId || undefined,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      customerIdNumber: customerIdNumber.trim() || undefined,
      vehicleLicensePlate: vehicleLicensePlate.trim() || undefined,
      scrapLines: lines,
      complianceCaptures,
      grossTotal: Math.round(payoutTotal * 100) / 100,
      totalDeductions: 0,
      finalPayout: Math.round(payoutTotal * 100) / 100,
      payoutMethod,
      checkNumber: payoutMethod === 'Check' ? checkNumber.trim() || undefined : undefined,
      operatorName: storageService.getSettings().operatorName,
      notes: notes.trim() || 'Active intake load in progress.',
    };

    storageService.saveTicket(draftTicket);
    setActiveTicketId(ticketId);
    setCustomReceiptNumber(ticketId);
    refreshPendingTickets();
    if (!quiet) toast.success(`Load #${ticketId} saved to the active queue`);
    return true;
  };

  const handleLoadPendingTicket = (pending: Ticket) => {
    if (pending.id !== activeTicketId && !saveCurrentDraft(true)) return;

    setActiveTicketId(pending.id);
    setCustomReceiptNumber(pending.id);
    setSelectedCustomerId(pending.customerId || '');
    setCustomerName(pending.customerName);
    setCustomerPhone(pending.customerPhone || '');
    setCustomerIdNumber(pending.customerIdNumber || '');
    setVehicleLicensePlate(pending.vehicleLicensePlate || '');
    setComplianceCaptures(pending.complianceCaptures || {});
    setLines(pending.scrapLines || []);
    setNotes(pending.notes || '');
    setPayoutMethod(pending.payoutMethod === 'Check' ? 'Check' : 'Cash');
    if (pending.checkNumber) setCheckNumber(pending.checkNumber);

    setCurrentStep(pending.scrapLines?.length ? 2 : 1);
    setIsPendingModalOpen(false);
    toast.success(`Switched to active load #${pending.id}`, {
      description: `${pending.customerName} · ${pending.scrapLines?.length || 0} weighed load(s)`,
    });
  };

  const handleStartNewLoad = () => {
    if (!saveCurrentDraft(true)) return;
    const activeCount = storageService.getTickets().filter(
      (ticket) => ticket.ticketType === 'SCRAP_METAL' && (ticket.status === 'DRAFT' || ticket.status === 'PENDING')
    ).length;
    if (activeCount >= MAX_ACTIVE_LOADS) {
      toast.error(`The active queue is full (${MAX_ACTIVE_LOADS}/${MAX_ACTIVE_LOADS}). Complete a load before starting another.`);
      return;
    }
    resetForm();
    toast.success('New intake load opened', { description: `${MAX_ACTIVE_LOADS - activeCount} active slot(s) remaining.` });
  };

  const handleSaveAsPendingGroup = () => {
    if (!saveCurrentDraft(false, 'PENDING')) return;
    toast.success(`Load #${customReceiptNumber} is ready for final weighing`, {
      description: `${customerName} remains available in the active load queue.`,
    });
    resetForm();
  };

  const resetForm = () => {
    setActiveTicketId(null);
    setCustomReceiptNumber(storageService.generateScrapReceiptNumber());
    setSelectedCustomerId('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerIdNumber('');
    setVehicleLicensePlate('');
    setLines([]);
    setNotes('');
    setComplianceCaptures({
      personPhotoUrl: undefined,
      idPhotoUrl: undefined,
      vehiclePhotoUrl: undefined,
      licensePlatePhotoUrl: undefined,
      loadPhotoUrl: undefined,
    });
    setVehicleGrossIn(0);
    setVehicleTareOut(0);
    setIsGrossInCaptured(false);
    setIsTareOutCaptured(false);
    setCurrentStep(1);
  };

  const selectedMetal = metals.find((m) => m.id === selectedMetalId) || metals[0];

  // Handle "Log Gross In" button click - captures current scale weight as vehicle gross
  const handleLogGrossIn = (weight: number, unit: WeightUnit) => {
    const lbs = unit === 'KG' ? Math.round(weight * 2.20462) : Math.round(weight);
    if (lbs <= 0) {
      toast.error('Cannot log weight - scale reading is zero or negative');
      return;
    }
    setVehicleGrossIn(lbs);
    setIsGrossInCaptured(true);
    toast.success(`Gross In recorded: ${lbs.toLocaleString()} LBS`, {
      description: 'Now capture Tare Out when vehicle drives off scale.',
    });
  };

  // Handle "Log Tare Out" button click - captures current scale weight as vehicle tare
  const handleLogTareOut = (weight: number, unit: WeightUnit) => {
    const lbs = unit === 'KG' ? Math.round(weight * 2.20462) : Math.round(weight);
    if (lbs <= 0) {
      toast.error('Cannot log weight - scale reading is zero or negative');
      return;
    }
    if (vehicleGrossIn === 0) {
      toast.error('Log Gross In first before capturing Tare Out');
      return;
    }
    setVehicleTareOut(lbs);
    setIsTareOutCaptured(true);
    const net = Math.max(0, vehicleGrossIn - lbs);
    setGrossWeight(net);
    toast.success(`Tare Out recorded: ${lbs.toLocaleString()} LBS`, {
      description: `Net scrap weight: ${net.toLocaleString()} LBS`,
    });
  };

  // Handle generic weight capture (for single item mode)
  const handleHoldWeightFromScale = (weight: number, unit: WeightUnit) => {
    const lbs = unit === 'KG' ? Math.round(weight * 2.20462) : Math.round(weight);
    setGrossWeight(lbs);
    toast.success(`Scale weight captured: ${lbs.toLocaleString()} LBS`);
  };

  // Handle adding a line item
  const handleAddLine = () => {
    if (!selectedMetal) return;

    let net: number;
    if (weighingMode === 'VEHICLE_DOUBLE') {
      if (!isGrossInCaptured || !isTareOutCaptured) {
        toast.error('Log both Gross In and Tare Out before adding a line');
        return;
      }
      net = Math.max(0, vehicleGrossIn - vehicleTareOut);
    } else {
      net = Math.max(0, grossWeight - tareWeight);
    }

    const deductionLbs = Math.round((net * (deductionPercent / 100)) * 10) / 10;
    const billableWeight = Math.max(0, net - deductionLbs);
    const lineTotal = Math.round(billableWeight * selectedMetal.ratePerLb * 100) / 100;

    const newLine: ScrapTicketLine = {
      id: `line-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      loadNumber: lines.length + 1,
      capturedAt: new Date().toISOString(),
      metalGradeId: selectedMetal.id,
      metalName: selectedMetal.name,
      metalCategory: selectedMetal.category,
      grossWeight: weighingMode === 'VEHICLE_DOUBLE' ? vehicleGrossIn : grossWeight,
      tareWeight: weighingMode === 'VEHICLE_DOUBLE' ? vehicleTareOut : tareWeight,
      netWeight: net,
      deductionPercent,
      deductionLbs,
      billableWeight,
      ratePerLb: selectedMetal.ratePerLb,
      lineTotal,
    };

    setLines([...lines, newLine]);
    toast.success(`Load ${newLine.loadNumber}: ${newLine.billableWeight} LBS of ${newLine.metalName} added`);

    // Reset for next line
    setGrossWeight(0);
    setTareWeight(0);
    setDeductionPercent(0);
    setVehicleGrossIn(0);
    setVehicleTareOut(0);
    setIsGrossInCaptured(false);
    setIsTareOutCaptured(false);
  };

  const handleRemoveLine = (id: string) => {
    setLines(lines.filter((l) => l.id !== id).map((l, index) => ({ ...l, loadNumber: index + 1 })));
  };

  const handleResetVehicleWeights = () => {
    setVehicleGrossIn(0);
    setVehicleTareOut(0);
    setIsGrossInCaptured(false);
    setIsTareOutCaptured(false);
    setGrossWeight(0);
    toast.info('Vehicle weight entries cleared');
  };

  const totalBillableWeight = lines.reduce((acc, l) => acc + l.billableWeight, 0);
  const totalPayout = lines.reduce((acc, l) => acc + l.lineTotal, 0);

  const hasNonFerrous = lines.some(
    (l) => l.metalCategory === 'Non-Ferrous' || l.metalCategory === 'Precious' || l.metalCategory === 'E-Waste' || l.metalCategory === 'Batteries & Auto'
  );
  const maxCashLimit = hasNonFerrous ? 25.00 : 100.00;
  const exceedsCashLimit = totalPayout > maxCashLimit;

  useEffect(() => {
    if (exceedsCashLimit && payoutMethod === 'Cash') {
      setPayoutMethod('Check');
    }
  }, [totalPayout, exceedsCashLimit, payoutMethod]);

  const handleProceedToStep2 = () => {
    if (!customerName.trim()) {
      toast.error('Please enter customer/seller name before proceeding');
      return;
    }
    setCurrentStep(2);
    toast.success('Intake Details Transferred! Ready for Scale Weighing.');
  };

  const handleSubmitTicket = () => {
    if (lines.length === 0) {
      toast.error('Add at least one scrap line item to complete ticket');
      return;
    }
    if (!customerName.trim()) {
      toast.error('Please enter customer name for state compliance record');
      return;
    }
    if (!customReceiptNumber.trim()) {
      toast.error('Please enter a Receipt / Ticket Number');
      return;
    }

    if (payoutMethod === 'Cash' && exceedsCashLimit) {
      toast.error(`Cash payouts are limited by law to $${maxCashLimit.toFixed(2)}. Payout must be issued by Check.`);
      return;
    }

    if (payoutMethod === 'Check' && !checkNumber.trim()) {
      toast.error('Please enter or record a Check Number before completing the ticket');
      return;
    }

    const currentOp = storageService.getSettings().operatorName;
    const finalTicketId = customReceiptNumber.trim();

    if (activeTicketId && activeTicketId !== finalTicketId) {
      const res = storageService.updateTicketId(activeTicketId, finalTicketId);
      if (!res.success) {
        toast.error(res.message || "Failed to update receipt number");
        return;
      }
    }

    const completedTicket: Ticket = {
      id: finalTicketId,
      ticketType: 'SCRAP_METAL',
      createdAt: new Date().toISOString(),
      status: 'COMPLETED',
      customerId: selectedCustomerId || undefined,
      customerName,
      customerPhone: customerPhone.trim() || undefined,
      customerIdNumber,
      vehicleLicensePlate,
      scrapLines: lines,
      complianceCaptures,
      grossTotal: totalPayout,
      totalDeductions: 0,
      finalPayout: Math.round(totalPayout * 100) / 100,
      payoutMethod,
      checkNumber: payoutMethod === 'Check' ? checkNumber : undefined,
      operatorName: currentOp,
      notes,
    };

    storageService.saveTicket(completedTicket);
    refreshPendingTickets();
    toast.success(`Scrap Ticket #${completedTicket.id} Completed! Voucher Issued.`);
    onTicketCreated(completedTicket);
  };

  const popularMetals = metals.filter((m) => m.isPopular).slice(0, 6);

  const filteredPendingTickets = pendingTickets.filter((t) => {
    const q = pendingSearch.toLowerCase();
    return (
      t.id.toLowerCase().includes(q) ||
      t.customerName.toLowerCase().includes(q) ||
      (t.customerPhone && t.customerPhone.toLowerCase().includes(q)) ||
      (t.customerIdNumber && t.customerIdNumber.toLowerCase().includes(q)) ||
      (t.vehicleLicensePlate && t.vehicleLicensePlate.toLowerCase().includes(q))
    );
  });

  const netScrapWeight = Math.max(0, vehicleGrossIn - vehicleTareOut);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 sm:pb-12 font-sans">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={currentStep === 2 ? () => setCurrentStep(1) : onBack}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> {currentStep === 2 ? 'Back to Step 1' : 'Back'}
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white font-mono">
                Scrap Yard Intake Station
              </h1>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-mono">
                {currentStep === 1 ? 'STEP 1: FIELD / INTAKE' : 'STEP 2: SCALE WORKSTATION'}
              </Badge>
            </div>
            <p className="text-xs text-slate-400">
              {currentStep === 1
                ? 'Part 1: Record seller details and compliance captures'
                : 'Part 2: Scale weight entry & final voucher processing'}
            </p>
          </div>
        </div>

        {/* Action Controls & Active Load Queue */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={handleStartNewLoad}
            disabled={pendingTickets.length >= MAX_ACTIVE_LOADS && !activeTicketId}
            className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> New Active Load
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { refreshPendingTickets(); setIsPendingModalOpen(true); }}
            className="relative bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/20 text-amber-300 font-bold text-xs gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>Active Loads</span>
            <Badge className="ml-1 bg-amber-500 text-slate-950 font-black text-[10px] px-1.5 py-0">
              {pendingTickets.length}/{MAX_ACTIVE_LOADS}
            </Badge>
          </Button>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <Button
              size="sm"
              variant={currentStep === 1 ? 'default' : 'ghost'}
              onClick={() => setCurrentStep(1)}
              className={`text-xs font-bold gap-1 ${
                currentStep === 1 ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Tablet className="w-3.5 h-3.5" /> 1. Intake
            </Button>
            <Button
              size="sm"
              variant={currentStep === 2 ? 'default' : 'ghost'}
              onClick={handleProceedToStep2}
              className={`text-xs font-bold gap-1 ${
                currentStep === 2 ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" /> 2. Scale
            </Button>
          </div>
        </div>
      </div>

      <EntranceLprMonitor onTicketCreated={() => refreshPendingTickets()} />

      {/* SIMULTANEOUS ACTIVE LOAD WORKSPACE */}
      {pendingTickets.length > 0 && (
        <Card className="bg-slate-900 border-2 border-amber-500/40 text-white shadow-xl overflow-hidden">

          <CardHeader className="py-3 px-4 bg-amber-950/40 border-b border-amber-500/30 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <CardTitle className="text-sm font-bold tracking-wide uppercase text-amber-300">
                Active Load Workspace — Switch Between Open Tickets ({pendingTickets.length}/{MAX_ACTIVE_LOADS})
              </CardTitle>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={refreshPendingTickets}
              className="text-slate-400 hover:text-white text-xs h-7"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
            </Button>
          </CardHeader>

          <CardContent className="p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingTickets.map((ticket) => {
                const ticketLoads = ticket.scrapLines || [];
                const ticketWeight = ticketLoads.reduce((sum, line) => sum + line.billableWeight, 0);
                const ticketMaterials = [...new Set(ticketLoads.map((line) => line.metalName))].slice(0, 3);
                const isCurrent = activeTicketId === ticket.id || (!activeTicketId && customReceiptNumber.trim() === ticket.id);
                return (
                <div
                  key={ticket.id}
                  className={`p-3 rounded-xl border text-left transition-all space-y-2.5 ${
                    isCurrent
                      ? "bg-amber-950/60 border-amber-500 text-white ring-1 ring-amber-500/50"
                      : "bg-slate-950 border-slate-800 hover:border-amber-500/40 text-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-white text-sm">{ticket.customerName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        #{ticket.id} • {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    {isCurrent ? (
                      <Badge className="bg-emerald-500 text-slate-950 text-[9px] font-mono shrink-0 font-black">
                        CURRENT
                      </Badge>
                    ) : (
                      <Badge className={`${ticket.status === 'PENDING' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-sky-500/20 text-sky-300 border-sky-500/40'} text-[9px] font-mono shrink-0 border`}>
                        {ticket.status}
                      </Badge>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400 space-y-0.5 font-mono">
                    {ticket.customerPhone && <div>Phone: <span className="text-emerald-400 font-bold">{ticket.customerPhone}</span></div>}
                    {ticket.customerIdNumber && <div>ID #: <span className="text-amber-300">{ticket.customerIdNumber}</span></div>}
                    {ticket.vehicleLicensePlate && <div>Tag: <span className="text-slate-200">{ticket.vehicleLicensePlate}</span></div>}
                  </div>

                  <div className="rounded-lg bg-slate-900/80 border border-slate-800 px-2.5 py-2 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-slate-500 uppercase tracking-wide">Weighed loads</span>
                      <span className="text-white font-bold">{ticketLoads.length}</span>
                    </div>
                    {ticketWeight > 0 && (
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-slate-500 uppercase tracking-wide">Current weight</span>
                        <span className="text-emerald-400 font-bold">{ticketWeight.toLocaleString()} LBS</span>
                      </div>
                    )}
                    {ticketMaterials.length > 0 && (
                      <div className="text-[10px] font-mono text-slate-400 truncate">
                        {ticketMaterials.join(' · ')}{ticketLoads.length > 0 && ticket.scrapLines!.length > ticketMaterials.length ? ' +' : ''}
                      </div>
                    )}
                  </div>

                  <Button
                    size="sm"
                    onClick={() => handleLoadPendingTicket(ticket)}
                    className="w-full h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow"
                  >
                    <Scale className="w-3.5 h-3.5" /> {isCurrent ? 'Continue This Load' : 'Switch to This Load'}
                  </Button>
                </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* EDITABLE RECEIPT / TICKET NUMBER BAR */}
      <Card className="bg-slate-900 border-slate-800 text-white p-3 rounded-xl shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <Label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Receipt / Ticket Number (Editable)
              </Label>
              <p className="text-[10px] text-slate-400">
                Custom invoice or printed voucher # to print on customer & yard copy
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={customReceiptNumber}
              onChange={(e) => setCustomReceiptNumber(e.target.value)}
              placeholder="e.g. T-2025-1001 or INV-8821"
              className="bg-slate-950 border-slate-700 text-amber-300 font-mono font-extrabold text-sm h-10 w-52 text-center"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAutoGenerateReceiptNumber}
              className="border-slate-700 bg-slate-800 text-slate-300 hover:text-white text-xs h-10 gap-1 shrink-0"
              title="Auto-Generate New Ticket Number"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" /> New #
            </Button>
          </div>
        </div>
      </Card>

      {/* STEP 1: INITIAL INTAKE & CUSTOMER COMPLIANCE PAGE */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="lg:col-span-2 space-y-6">

              {/* 1. CUSTOMER / SELLER PROFILE CARD - MANUAL ENTRY ONLY */}
              <Card className="bg-slate-900 border-slate-800 text-white shadow-xl relative overflow-hidden">
                <CardHeader className="py-3.5 px-4 bg-slate-950/80 border-b border-slate-800 flex flex-row items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-400" />
                    <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300">
                      Customer / Seller Profile
                    </CardTitle>
                    <Badge className="bg-blue-950 text-blue-300 border-blue-500/40 text-[10px] font-mono">
                      MANUAL ENTRY
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  
                  <div className="p-3 bg-blue-950/40 border border-blue-500/40 rounded-xl flex items-center justify-between text-xs text-blue-300">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>Enter seller details manually. Compliance photos will be captured in the Photo Studio below.</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-300">Select Registered Customer</Label>
                      <Select value={selectedCustomerId} onValueChange={handleCustomerSelect}>
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs mt-1 h-11">
                          <SelectValue placeholder="-- Select existing --" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                          {customers.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="text-xs">
                              {c.fullName} ({c.phone || c.idNumber || 'No Phone/ID'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs text-slate-300 flex items-center justify-between">
                        <span>Seller Name *</span>
                      </Label>
                      <Input
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="e.g. Marcus Vance"
                        className="bg-slate-950 border-slate-800 text-white font-bold text-xs mt-1 h-11"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs text-slate-300 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-emerald-400" /> Phone Number *
                      </Label>
                      <Input
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="(555) 000-0000"
                        className="bg-slate-950 border-slate-800 text-emerald-400 font-mono font-bold text-xs mt-1 h-11"
                      />
                    </div>

                    <div>
                      <Label className="text-xs text-slate-300 flex items-center justify-between">
                        <span>Driver License / ID #</span>
                      </Label>
                      <Input
                        value={customerIdNumber}
                        onChange={(e) => setCustomerIdNumber(e.target.value)}
                        placeholder="e.g. DL-4481029-GA"
                        className="bg-slate-950 border-slate-800 text-amber-300 font-mono text-xs mt-1 h-11"
                      />
                    </div>

                    <div>
                      <Label className="text-xs text-slate-300 flex items-center justify-between">
                        <span>Vehicle License Plate Tag</span>
                      </Label>
                      <Input
                        value={vehicleLicensePlate}
                        onChange={(e) => setVehicleLicensePlate(e.target.value)}
                        placeholder="e.g. TOW-912 (GA)"
                        className="bg-slate-950 border-slate-800 text-slate-200 font-mono uppercase text-xs mt-1 h-11"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 2. LEGAL COMPLIANCE & PHOTO CAPTURE STUDIO - MANUAL PHOTO ONLY */}
              <Card className="bg-slate-900 border-blue-500/40 text-white shadow-xl overflow-hidden">
                <CardHeader className="py-3 px-4 bg-gradient-to-r from-blue-950/80 to-slate-950 border-b border-blue-500/30 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-blue-400" />
                    <CardTitle className="text-sm font-bold tracking-wide uppercase text-white">
                      State Legal Compliance & Photo Studio
                    </CardTitle>
                  </div>

                  <Badge
                    className={`text-xs ${
                      complianceStats.score === 100
                        ? "bg-emerald-950 text-emerald-400 border-emerald-500/40"
                        : "bg-amber-950 text-amber-400 border-amber-500/40"
                    }`}
                  >
                    {complianceStats.score}% Photos Captured
                  </Badge>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { title: "ID Photo", icon: UserCheck, val: complianceCaptures.idPhotoUrl },
                      { title: "Seller Face", icon: UserCheck, val: complianceCaptures.personPhotoUrl },
                      { title: "Vehicle 45°", icon: Truck, val: complianceCaptures.vehiclePhotoUrl },
                      { title: "License Plate", icon: ShieldCheck, val: complianceCaptures.licensePlatePhotoUrl },
                      { title: "Cargo Load", icon: Package, val: complianceCaptures.loadPhotoUrl },
                    ].map((item, idx) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={idx}
                          onClick={() => setIsComplianceModalOpen(true)}
                          className="group cursor-pointer p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-blue-500 transition-all text-center"
                        >
                          <div className="aspect-video bg-slate-900 rounded overflow-hidden relative flex items-center justify-center mb-1">
                            {item.val ? (
                              <img src={item.val} alt={item.title} className="w-full h-full object-cover" />
                            ) : (
                              <Icon className="w-4 h-4 text-slate-500" />
                            )}
                            {item.val && (
                              <span className="absolute top-0.5 right-0.5 bg-emerald-500 text-slate-950 p-0.5 rounded-full">
                                <CheckCircle2 className="w-2.5 h-2.5 stroke-[3]" />
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-300 font-medium truncate block">{item.title}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
                    <p className="text-xs text-slate-400">
                      5-point photo verification for state compliance. Both parties sign the printed voucher.
                    </p>
                    <Button
                      onClick={() => setIsComplianceModalOpen(true)}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs gap-2 min-h-[44px]"
                    >
                      <Camera className="w-4 h-4" /> Launch Photo Studio
                    </Button>
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* Right Column: Step 1 Confirmation */}
            <div className="space-y-6">
              <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
                <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800">
                  <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300 flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-400" /> Save to Pending Group
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Receipt / Ticket #:</span>
                      <span className="text-amber-400 font-bold">{customReceiptNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Seller Name:</span>
                      <span className="text-white font-bold">{customerName || 'Not Entered'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Phone #:</span>
                      <span className="text-emerald-400 font-bold">{customerPhone || 'Not Entered'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">License / ID #:</span>
                      <span className="text-amber-300 font-mono font-bold">{customerIdNumber || 'Not Entered'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Compliance Photos:</span>
                      <span className="text-emerald-400 font-bold">{complianceStats.score}% Captured</span>
                    </div>
                  </div>

                  <Button
                    onClick={handleSaveAsPendingGroup}
                    className="w-full h-12 bg-amber-600 hover:bg-amber-500 text-slate-950 font-extrabold text-xs sm:text-sm gap-2 shadow-lg"
                  >
                    <Clock className="w-4 h-4 text-slate-950" /> Save to Pending Group
                  </Button>

                  <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800" /></div>
                    <div className="relative flex justify-center text-[10px] uppercase text-slate-500"><span className="bg-slate-900 px-2">OR</span></div>
                  </div>

                  <Button
                    onClick={handleProceedToStep2}
                    variant="outline"
                    className="w-full h-11 border-emerald-500/50 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/50 font-bold text-xs gap-2"
                  >
                    Proceed Directly to Scale Weighing <ArrowRight className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>

          </div>
        </div>
      )}

      {/* STEP 2: WEIGHING, SCRAP LINES & PAYOUT PAGE (SCALE WORKSTATION) */}
      {currentStep === 2 && (
        <div className="space-y-6">
          
          {/* Summary Banner from Step 1 */}
          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center gap-1.5">
                <Laptop className="w-4 h-4" /> SCALE WORKSTATION
              </div>
              <div>
                <span className="font-bold text-white">{customerName}</span>
                {customerPhone && <span className="text-emerald-400 ml-2 font-mono">({customerPhone})</span>}
                <span className="text-slate-400 ml-2 font-mono">ID: {customerIdNumber || 'Not Entered'}</span>
                <span className="text-emerald-400 ml-2">| Tag: {vehicleLicensePlate || 'Not Entered'}</span>
                <Badge className="ml-2 bg-amber-500/20 text-amber-300 border-amber-500/30 font-mono text-[10px]">
                  Receipt #{customReceiptNumber}
                </Badge>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentStep(1)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
            >
              Edit Step 1 Details
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left 2 Columns: Scale Entry & Line Items Table */}
            <div className="lg:col-span-2 space-y-6">
              
              <Card className="bg-slate-900 border-slate-800 text-white shadow-lg">
                <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-emerald-400" /> Scale Entry
                  </CardTitle>

                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => { setWeighingMode('SINGLE_ITEM'); handleResetVehicleWeights(); }}
                      className={`px-3 py-1.5 rounded text-xs font-bold transition-colors min-h-[36px] ${
                        weighingMode === 'SINGLE_ITEM' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Single Item Scale
                    </button>
                    <button
                      type="button"
                      onClick={() => setWeighingMode('VEHICLE_DOUBLE')}
                      className={`px-3 py-1.5 rounded text-xs font-bold transition-colors flex items-center gap-1 min-h-[36px] ${
                        weighingMode === 'VEHICLE_DOUBLE' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Truck className="w-3.5 h-3.5" /> Vehicle Gross/Tare
                    </button>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  
                  {/* Quick Metal Touch Pills */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400 font-semibold block">Select Metal Grade (1-Tap):</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {popularMetals.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSelectedMetalId(m.id)}
                          className={`p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between min-h-[44px] ${
                            selectedMetalId === m.id
                              ? 'bg-emerald-950/80 border-emerald-500 text-white font-bold'
                              : 'bg-slate-950 border-slate-800/80 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span className="truncate">{m.name}</span>
                          <span className="text-emerald-400 font-mono font-bold shrink-0 ml-1">${m.ratePerLb.toFixed(2)}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Vehicle Double Weighing Display */}
                  {weighingMode === 'VEHICLE_DOUBLE' && (
                    <div className="p-4 bg-slate-950 border border-emerald-500/40 rounded-lg space-y-4">
                      <div className="flex items-center justify-between text-emerald-400 font-bold">
                        <span className="flex items-center gap-2">
                          <Truck className="w-4 h-4" />
                          Vehicle Drive-On / Drive-Off Calculation
                        </span>
                        <span className="font-mono">Gross In − Tare Out = Net</span>
                      </div>
                      
                      {/* Weight Summary Cards */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className={`p-3 rounded-lg border text-center ${
                          isGrossInCaptured 
                            ? 'bg-emerald-950/60 border-emerald-500/50' 
                            : 'bg-slate-900 border-slate-800'
                        }`}>
                          <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Gross In</span>
                          <span className={`font-mono font-bold text-lg ${
                            isGrossInCaptured ? 'text-emerald-400' : 'text-slate-500'
                          }`}>
                            {vehicleGrossIn > 0 ? `${vehicleGrossIn.toLocaleString()} lbs` : '---'}
                          </span>
                          {isGrossInCaptured && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto mt-1" />
                          )}
                        </div>
                        
                        <div className={`p-3 rounded-lg border text-center ${
                          isTareOutCaptured 
                            ? 'bg-amber-950/60 border-amber-500/50' 
                            : 'bg-slate-900 border-slate-800'
                        }`}>
                          <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Tare Out</span>
                          <span className={`font-mono font-bold text-lg ${
                            isTareOutCaptured ? 'text-amber-400' : 'text-slate-500'
                          }`}>
                            {vehicleTareOut > 0 ? `${vehicleTareOut.toLocaleString()} lbs` : '---'}
                          </span>
                          {isTareOutCaptured && (
                            <CheckCircle2 className="w-4 h-4 text-amber-400 mx-auto mt-1" />
                          )}
                        </div>
                        
                        <div className="p-3 rounded-lg border border-emerald-500/50 bg-emerald-950/40 text-center">
                          <span className="text-[10px] text-emerald-400 block uppercase tracking-wider">Net Scrap</span>
                          <span className="font-mono font-black text-xl text-emerald-400">
                            {netScrapWeight.toLocaleString()} lbs
                          </span>
                        </div>
                      </div>

                      {/* Weight Logging Buttons */}
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            // Capture from scale service
                            const scale = storageService.getScaleStatus?.() || { netWeight: 0, unit: 'LBS' as WeightUnit };
                            handleLogGrossIn(scale.netWeight || 0, scale.unit || 'LBS');
                          }}
                          disabled={isGrossInCaptured}
                          className={`flex-1 h-12 font-bold text-sm gap-2 ${
                            isGrossInCaptured
                              ? 'bg-emerald-900 text-emerald-400 border border-emerald-700 cursor-not-allowed'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          {isGrossInCaptured ? (
                            <>
                              <CheckCircle2 className="w-4 h-4" /> Gross In Captured
                            </>
                          ) : (
                            <>
                              <ScaleWeight className="w-4 h-4" /> Log Gross In
                            </>
                          )}
                        </Button>
                        
                        <Button
                          onClick={() => {
                            const scale = storageService.getScaleStatus?.() || { netWeight: 0, unit: 'LBS' as WeightUnit };
                            handleLogTareOut(scale.netWeight || 0, scale.unit || 'LBS');
                          }}
                          disabled={!isGrossInCaptured || isTareOutCaptured}
                          className={`flex-1 h-12 font-bold text-sm gap-2 ${
                            isTareOutCaptured
                              ? 'bg-amber-900 text-amber-400 border border-amber-700 cursor-not-allowed'
                              : !isGrossInCaptured
                              ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                              : 'bg-amber-600 hover:bg-amber-500 text-slate-950'
                          }`}
                        >
                          {isTareOutCaptured ? (
                            <>
                              <CheckCircle2 className="w-4 h-4" /> Tare Out Captured
                            </>
                          ) : (
                            <>
                              <ScaleWeight className="w-4 h-4" /> Log Tare Out
                            </>
                          )}
                        </Button>
                      </div>

                      {isTareOutCaptured && (
                        <Button
                          onClick={handleResetVehicleWeights}
                          variant="outline"
                          size="sm"
                          className="w-full border-slate-700 text-slate-400 hover:text-white text-xs"
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reset Vehicle Weights
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Weight Entry (Single Item Mode) */}
                  {weighingMode === 'SINGLE_ITEM' && (
                    <>
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div>
                            <Label className="text-[11px] text-slate-400">Gross Weight (LBS)</Label>
                            <Input
                              type="number"
                              value={grossWeight}
                              onChange={(e) => setGrossWeight(parseFloat(e.target.value) || 0)}
                              className="bg-slate-950 border-slate-800 text-emerald-300 font-mono font-bold text-base mt-1 h-11"
                            />
                          </div>

                          <div>
                            <Label className="text-[11px] text-slate-400">Box/Container Tare (LBS)</Label>
                            <Input
                              type="number"
                              value={tareWeight}
                              onChange={(e) => setTareWeight(parseFloat(e.target.value) || 0)}
                              className="bg-slate-950 border-slate-800 text-amber-300 font-mono text-base mt-1 h-11"
                            />
                          </div>

                          <div>
                            <Label className="text-[11px] text-slate-400">Contamination %</Label>
                            <Input
                              type="number"
                              value={deductionPercent}
                              onChange={(e) => setDeductionPercent(parseFloat(e.target.value) || 0)}
                              className="bg-slate-950 border-slate-800 text-red-400 font-mono text-base mt-1 h-11"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 pt-1 text-xs">
                          <span className="text-slate-500 font-mono text-[10px] hidden sm:inline">Quick Adjust:</span>
                          <button
                            type="button"
                            onClick={() => setGrossWeight((w) => Math.max(0, w + 10))}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-bold border border-slate-700 active:scale-95"
                          >
                            +10 lbs
                          </button>
                          <button
                            type="button"
                            onClick={() => setGrossWeight((w) => Math.max(0, w + 50))}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-bold border border-slate-700 active:scale-95"
                          >
                            +50 lbs
                          </button>
                          <button
                            type="button"
                            onClick={() => setGrossWeight((w) => Math.max(0, w + 100))}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-bold border border-slate-700 active:scale-95"
                          >
                            +100 lbs
                          </button>
                          <button
                            type="button"
                            onClick={() => { setGrossWeight(0); setTareWeight(0); }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-950 text-slate-400 hover:text-white text-xs border border-slate-800 ml-auto"
                          >
                            Clear Weights
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  <Button
                    onClick={handleAddLine}
                    disabled={weighingMode === 'VEHICLE_DOUBLE' ? (!isGrossInCaptured || !isTareOutCaptured) : (grossWeight <= 0)}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-md disabled:bg-emerald-900 disabled:text-emerald-400"
                  >
                    <Plus className="w-5 h-5 mr-1" /> Add Line Item To Voucher
                  </Button>

                </CardContent>
              </Card>

              {/* Itemized Table */}
              <Card className="bg-slate-900 border-slate-800 text-white shadow-lg overflow-hidden">
                <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300">
                    Weighed Loads on This Ticket ({lines.length})
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-0">
                  {lines.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      No loads weighed on this ticket yet. Capture weight from the scale gauge and tap "Add Line Item" — each line is a separate weighed load.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader className="bg-slate-950/80">
                        <TableRow className="border-slate-800 hover:bg-slate-950 text-xs">
                          <TableHead className="text-slate-400">Load #</TableHead>
                          <TableHead className="text-slate-400">Metal Grade</TableHead>
                          <TableHead className="text-slate-400 text-right">Net Weight</TableHead>
                          <TableHead className="text-slate-400 text-right">Deductions</TableHead>
                          <TableHead className="text-slate-400 text-right">Billable Lbs</TableHead>
                          <TableHead className="text-slate-400 text-right">Rate/lb</TableHead>
                          <TableHead className="text-slate-400 text-right">Total</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.map((line) => (
                          <TableRow key={line.id} className="border-slate-800 hover:bg-slate-800/40 font-mono text-xs">
                            <TableCell className="text-amber-300 font-bold">
                              #{line.loadNumber || lines.indexOf(line) + 1}
                            </TableCell>
                            <TableCell className="font-semibold text-white font-sans">
                              {line.metalName}
                              <span className="block text-[10px] text-slate-400">{line.metalCategory}</span>
                            </TableCell>
                            <TableCell className="text-right text-slate-300">{line.netWeight} lbs</TableCell>
                            <TableCell className="text-right text-red-400">
                              {line.deductionPercent > 0 ? `-${line.deductionLbs} lbs (${line.deductionPercent}%)` : '-'}
                            </TableCell>
                            <TableCell className="text-right font-bold text-emerald-300">{line.billableWeight} lbs</TableCell>
                            <TableCell className="text-right text-slate-300">${line.ratePerLb.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-extrabold text-emerald-400">
                              ${line.lineTotal.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveLine(line.id)}
                                className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-slate-800"
                              >
                                <Trash2 className="w-4 h-4" />
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

            {/* Right Column: Live Gauge & Statutory Payout Options */}
            <div className="space-y-6">
              <LiveScaleGauge onHoldWeight={weighingMode === 'SINGLE_ITEM' ? handleHoldWeightFromScale : undefined} compact />

              <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
                <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800">
                  <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" /> Payout Options & Statutory Limits
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  
                  {/* Summary Amount */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex justify-between text-xs text-slate-400 font-mono">
                      <span>Receipt / Ticket #:</span>
                      <span className="text-amber-400 font-bold">{customReceiptNumber}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 font-mono">
                      <span>Total Billable Weight:</span>
                      <span className="text-white font-bold">{totalBillableWeight.toLocaleString()} LBS</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 font-mono">
                      <span>Legal Cash Limit Allowed:</span>
                      <span className="text-amber-400 font-bold">${maxCashLimit.toFixed(2)} ({hasNonFerrous ? 'Non-Ferrous' : 'Ferrous'})</span>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex justify-between items-baseline">
                      <span className="font-bold text-sm text-slate-200">TOTAL PAYOUT:</span>
                      <span className="text-3xl font-black text-emerald-400 font-mono">
                        ${totalPayout.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* STATUTORY PAYOUT OPTIONS */}
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-300 font-bold block">
                      Select Payout Method *
                    </Label>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={exceedsCashLimit}
                        onClick={() => setPayoutMethod('Cash')}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          payoutMethod === 'Cash'
                            ? 'bg-emerald-950/80 border-emerald-500 text-white'
                            : exceedsCashLimit
                            ? 'bg-slate-950 border-slate-800 opacity-40 cursor-not-allowed text-slate-500'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs">1. CASH PAYOUT</span>
                          {payoutMethod === 'Cash' && <Check className="w-4 h-4 text-emerald-400" />}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          Max ${maxCashLimit.toFixed(0)} ({hasNonFerrous ? 'Non-Ferrous' : 'Ferrous'})
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPayoutMethod('Check')}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          payoutMethod === 'Check'
                            ? 'bg-emerald-950/80 border-emerald-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs">2. CHECK ISSUE</span>
                          {payoutMethod === 'Check' && <Check className="w-4 h-4 text-emerald-400" />}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          Any amount over limits
                        </span>
                      </button>
                    </div>

                    {exceedsCashLimit && (
                      <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-lg text-amber-200 text-xs space-y-1 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block">State Scrap Metal Theft Law Capping</span>
                          <p className="text-[11px] text-slate-300">
                            Cash is legally capped at <strong className="text-amber-300">$25.00 for Non-Ferrous</strong> and <strong className="text-amber-300">$100.00 for Ferrous</strong>. Total payout of ${totalPayout.toFixed(2)} automatically defaults to <strong className="text-emerald-400">CHECK ISSUE</strong>.
                          </p>
                        </div>
                      </div>
                    )}

                    {payoutMethod === 'Check' && (
                      <div className="p-3 bg-slate-950 border-2 border-emerald-500/40 rounded-xl space-y-2 mt-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                            <FileCheck className="w-4 h-4 text-emerald-400" /> Record Check Number *
                          </Label>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setCheckNumber('CHK-' + Math.floor(10000 + Math.random() * 90000))}
                            className="text-[10px] h-7 bg-slate-900 border-slate-700 text-slate-300 hover:text-white"
                          >
                            Auto-Generate Next #
                          </Button>
                        </div>
                        <div className="relative">
                          <Input
                            value={checkNumber}
                            onChange={(e) => setCheckNumber(e.target.value)}
                            placeholder="Enter Check Number (e.g. 9042)"
                            className="bg-slate-900 border-slate-800 text-amber-300 font-mono font-bold text-sm h-11"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400">
                          This check number will be printed on the official receipt vouchers for audit compliance.
                        </p>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={handleSubmitTicket}
                    disabled={lines.length === 0}
                    className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-extrabold shadow-lg shadow-emerald-950 text-sm tracking-wide disabled:from-slate-600 disabled:to-slate-600"
                  >
                    <CheckCircle2 className="w-5 h-5 mr-2" /> Complete Ticket #{customReceiptNumber} & Issue Voucher
                  </Button>
                </CardContent>
              </Card>

            </div>

          </div>
        </div>
      )}

      {/* PENDING SCRAP INTAKES GROUP MODAL DIALOG */}
      <Dialog open={isPendingModalOpen} onOpenChange={setIsPendingModalOpen}>
        <DialogContent className="sm:max-w-[680px] bg-slate-900 border-slate-800 text-white">
          <DialogHeader className="border-b border-slate-800 pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              <DialogTitle className="text-base font-bold font-mono">
                Active Loads Queue ({pendingTickets.length}/{MAX_ACTIVE_LOADS})
              </DialogTitle>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={refreshPendingTickets}
              className="text-slate-400 hover:text-white text-xs h-8"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh Queue
            </Button>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <Input
                placeholder="Filter active loads by seller name, phone, ID, or vehicle tag..."
                value={pendingSearch}
                onChange={(e) => setPendingSearch(e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs pl-8 h-9"
              />
            </div>

            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {filteredPendingTickets.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs space-y-2">
                  <Layers className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="font-bold text-slate-300">No Active Loads Right Now</p>
                  <p className="text-[11px] text-slate-500">
                    Start intake step 1 or press "New Active Load" — up to {MAX_ACTIVE_LOADS} loads can stay open at once while you weigh them one at a time.
                  </p>
                </div>
              ) : (
                filteredPendingTickets.map((ticket) => {
                  const modalLoads = ticket.scrapLines || [];
                  const modalWeight = modalLoads.reduce((sum, line) => sum + line.billableWeight, 0);
                  return (
                  <div
                    key={ticket.id}
                    className="bg-slate-950 border border-slate-800 hover:border-amber-500/50 p-4 rounded-xl space-y-3 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{ticket.customerName}</span>
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
                            #{ticket.id}
                          </Badge>
                          <Badge className={`${ticket.status === 'PENDING' ? 'bg-amber-500/20 text-amber-300' : 'bg-sky-500/20 text-sky-300'} border-0 text-[9px] font-mono`}>
                            {ticket.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                          Phone: <span className="text-emerald-400">{ticket.customerPhone || 'N/A'}</span> | ID #: {ticket.customerIdNumber || 'Not Entered'} | Vehicle Tag: {ticket.vehicleLicensePlate || 'Not Entered'}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Saved: {new Date(ticket.createdAt).toLocaleTimeString()} ({ticket.operatorName})
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">
                          Loads: <span className="text-white font-bold">{modalLoads.length}</span>
                          {modalWeight > 0 && <> · Weight: <span className="text-emerald-400 font-bold">{modalWeight.toLocaleString()} LBS</span></>}
                          {modalLoads.length > 0 && <> · {modalLoads.map((line) => line.metalName).filter((value, index, all) => all.indexOf(value) === index).join(', ')}</>}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleLoadPendingTicket(ticket)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-md shrink-0"
                      >
                        <Scale className="w-3.5 h-3.5" /> Switch to Load
                      </Button>
                    </div>

                    {ticket.complianceCaptures && (
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-900">
                        <span className="text-[10px] text-slate-500 uppercase font-mono">Photos:</span>
                        {[
                          ticket.complianceCaptures.idPhotoUrl,
                          ticket.complianceCaptures.personPhotoUrl,
                          ticket.complianceCaptures.vehiclePhotoUrl,
                        ].map((url, i) =>
                          url ? (
                            <div key={i} className="w-7 h-7 rounded bg-slate-800 overflow-hidden border border-slate-700">
                              <img src={url} alt="thumb" className="w-full h-full object-cover" />
                            </div>
                          ) : null
                        )}
                      </div>
                    )}
                  </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ComplianceCaptureModal
        isOpen={isComplianceModalOpen}
        onClose={() => setIsComplianceModalOpen(false)}
        initialCaptures={complianceCaptures}
        onSaveCaptures={handleApplyComplianceCaptures}
        intakeType="SCRAP_METAL"
      />
    </div>
  );
};
