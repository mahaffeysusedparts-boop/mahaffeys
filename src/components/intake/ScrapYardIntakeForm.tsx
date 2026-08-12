import React, { useState, useEffect } from 'react';
import { Customer, MetalGrade, ScrapTicketLine, Ticket, WeightUnit, ComplianceCaptures } from '@/types/scrap';
import { storageService } from '@/services/storageService';
import { LiveScaleGauge } from '../scale/LiveScaleGauge';
import { ComplianceCaptureModal } from '../compliance/ComplianceCaptureModal';
import { calculateComplianceScore, generateSamplePhoto, DLScanResult, extractDataFromDLPhoto } from '@/utils/complianceUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  CreditCard,
  Scan,
  Package,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  FileCheck,
  Check,
  Tablet,
  Laptop,
  Clock,
  ListFilter,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface ScrapYardIntakeFormProps {
  onBack: () => void;
  onTicketCreated: (ticket: Ticket) => void;
}

export const ScrapYardIntakeForm: React.FC<ScrapYardIntakeFormProps> = ({ onBack, onTicketCreated }) => {
  // Step 1: iPad / Field Intake (Customer & Compliance Studio)
  // Step 2: Office PC Scale (Weight Entry, Metal Lines & Statutory Payout)
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Loaded or active ticket ID (if completing a pending ticket created on iPad)
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  const [metals] = useState<MetalGrade[]>(storageService.getMetals());
  const [customers] = useState<Customer[]>(storageService.getCustomers());

  // Pending Tickets Queue from iPad Intakes
  const [pendingTickets, setPendingTickets] = useState<Ticket[]>([]);
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);

  // Customer Credentials
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerIdNumber, setCustomerIdNumber] = useState<string>('');
  const [vehicleLicensePlate, setVehicleLicensePlate] = useState<string>('');

  // Compliance Captures
  const [complianceCaptures, setComplianceCaptures] = useState<ComplianceCaptures>({
    personPhotoUrl: generateSamplePhoto('person'),
    idPhotoUrl: generateSamplePhoto('id'),
    vehiclePhotoUrl: generateSamplePhoto('vehicle'),
    licensePlatePhotoUrl: generateSamplePhoto('plate'),
    loadPhotoUrl: generateSamplePhoto('load'),
  });
  const [isComplianceModalOpen, setIsComplianceModalOpen] = useState(false);

  // Weighed Scrap Lines
  const [lines, setLines] = useState<ScrapTicketLine[]>([]);

  // Scale & Item Entry
  const [selectedMetalId, setSelectedMetalId] = useState<string>(metals[0]?.id || '');
  const [grossWeight, setGrossWeight] = useState<number>(120);
  const [tareWeight, setTareWeight] = useState<number>(0);
  const [deductionPercent, setDeductionPercent] = useState<number>(0);

  const [weighingMode, setWeighingMode] = useState<'SINGLE_ITEM' | 'VEHICLE_DOUBLE'>('SINGLE_ITEM');
  const [vehicleGrossIn, setVehicleGrossIn] = useState<number>(0);
  const [vehicleTareOut, setVehicleTareOut] = useState<number>(0);

  // Payout Method State
  const [payoutMethod, setPayoutMethod] = useState<'Cash' | 'Check'>('Cash');
  const [checkNumber, setCheckNumber] = useState<string>('CHK-' + Math.floor(1000 + Math.random() * 9000));
  const [notes, setNotes] = useState<string>('');

  const complianceStats = calculateComplianceScore(complianceCaptures);

  // Load pending tickets on mount and whenever modal opens
  const refreshPendingTickets = () => {
    const allTickets = storageService.getTickets();
    const pendings = allTickets.filter((t) => t.status === 'PENDING' && t.ticketType === 'SCRAP_METAL');
    setPendingTickets(pendings);
  };

  useEffect(() => {
    refreshPendingTickets();
  }, []);

  const handleCustomerSelect = (custId: string) => {
    setSelectedCustomerId(custId);
    const cust = customers.find((c) => c.id === custId);
    if (cust) {
      setCustomerName(cust.fullName);
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

  const handleApplyComplianceCaptures = (captures: ComplianceCaptures, scannedProfile?: DLScanResult) => {
    setComplianceCaptures(captures);
    if (scannedProfile) {
      setCustomerName(scannedProfile.fullName);
      setCustomerIdNumber(scannedProfile.idNumber);
      if (scannedProfile.vehicleLicensePlate) {
        setVehicleLicensePlate(scannedProfile.vehicleLicensePlate);
      }
    }
  };

  const handleDlPictureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const profile = extractDataFromDLPhoto(dataUrl);
        setCustomerName(profile.fullName);
        setCustomerIdNumber(profile.idNumber);
        if (profile.vehicleLicensePlate) {
          setVehicleLicensePlate(profile.vehicleLicensePlate);
        }
        setComplianceCaptures((prev) => ({
          ...prev,
          idPhotoUrl: dataUrl,
        }));
        toast.success(`Extracted Data from Driver License Picture!`, {
          description: `Name: ${profile.fullName} | ID #: ${profile.idNumber} | Tag: ${profile.vehicleLicensePlate || 'N/A'}`,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Load a pending ticket from iPad queue into Office PC Scale workstation
  const handleLoadPendingTicket = (pending: Ticket) => {
    setActiveTicketId(pending.id);
    setSelectedCustomerId(pending.customerId || '');
    setCustomerName(pending.customerName);
    setCustomerIdNumber(pending.customerIdNumber || '');
    setVehicleLicensePlate(pending.vehicleLicensePlate || '');
    if (pending.complianceCaptures) {
      setComplianceCaptures(pending.complianceCaptures);
    }
    if (pending.scrapLines && pending.scrapLines.length > 0) {
      setLines(pending.scrapLines);
    } else {
      setLines([]);
    }
    setNotes(pending.notes || '');

    setCurrentStep(2);
    setIsPendingModalOpen(false);
    toast.success(`Loaded Pending Ticket #${pending.id} onto Office PC Scale!`, {
      description: `Customer: ${pending.customerName} | Ready for scale weighing & payout.`,
    });
  };

  // SAVE AS PENDING ON IPAD (Part 1 complete, waiting for Office PC Scale)
  const handleSaveAsPendingFromIpad = () => {
    if (!customerName.trim()) {
      toast.error('Please enter customer/seller name before saving');
      return;
    }

    const currentOp = storageService.getSettings().operatorName;
    const ticketId = activeTicketId || `T-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const pendingTicket: Ticket = {
      id: ticketId,
      ticketType: 'SCRAP_METAL',
      createdAt: new Date().toISOString(),
      status: 'PENDING',
      customerId: selectedCustomerId || undefined,
      customerName,
      customerIdNumber,
      vehicleLicensePlate,
      scrapLines: lines,
      complianceCaptures,
      grossTotal: 0,
      totalDeductions: 0,
      finalPayout: 0,
      payoutMethod: 'Cash',
      operatorName: `${currentOp} (iPad Field Intake)`,
      notes: notes || 'Scanned on iPad. Waiting for scale weighing at Office PC.',
    };

    storageService.saveTicket(pendingTicket);
    refreshPendingTickets();

    toast.success(`Saved Part 1 Intake #${pendingTicket.id} as PENDING!`, {
      description: `Customer ${customerName} can now proceed to the Office PC scale house.`,
    });

    // Reset iPad form for next customer
    resetForm();
  };

  const resetForm = () => {
    setActiveTicketId(null);
    setSelectedCustomerId('');
    setCustomerName('');
    setCustomerIdNumber('');
    setVehicleLicensePlate('');
    setLines([]);
    setNotes('');
    setComplianceCaptures({
      personPhotoUrl: generateSamplePhoto('person'),
      idPhotoUrl: generateSamplePhoto('id'),
      vehiclePhotoUrl: generateSamplePhoto('vehicle'),
      licensePlatePhotoUrl: generateSamplePhoto('plate'),
      loadPhotoUrl: generateSamplePhoto('load'),
    });
    setCurrentStep(1);
  };

  const selectedMetal = metals.find((m) => m.id === selectedMetalId) || metals[0];

  const handleHoldWeightFromScale = (weight: number, unit: WeightUnit) => {
    const lbs = unit === 'KG' ? Math.round(weight * 2.20462) : Math.round(weight);
    
    if (weighingMode === 'VEHICLE_DOUBLE') {
      if (vehicleGrossIn === 0) {
        setVehicleGrossIn(lbs);
        toast.success(`Vehicle Gross In recorded: ${lbs.toLocaleString()} LBS`);
      } else {
        setVehicleTareOut(lbs);
        const net = Math.max(0, vehicleGrossIn - lbs);
        setGrossWeight(net);
        toast.success(`Vehicle Tare Out recorded: ${lbs.toLocaleString()} LBS. Net scrap weight: ${net.toLocaleString()} LBS`);
      }
    } else {
      setGrossWeight(lbs);
      toast.success(`Scale weight captured: ${lbs.toLocaleString()} LBS`);
    }
  };

  const handleAddLine = () => {
    if (!selectedMetal) return;

    const net = Math.max(0, grossWeight - tareWeight);
    const deductionLbs = Math.round((net * (deductionPercent / 100)) * 10) / 10;
    const billableWeight = Math.max(0, net - deductionLbs);
    const lineTotal = Math.round(billableWeight * selectedMetal.ratePerLb * 100) / 100;

    const newLine: ScrapTicketLine = {
      id: `line-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      metalGradeId: selectedMetal.id,
      metalName: selectedMetal.name,
      metalCategory: selectedMetal.category,
      grossWeight,
      tareWeight,
      netWeight: net,
      deductionPercent,
      deductionLbs,
      billableWeight,
      ratePerLb: selectedMetal.ratePerLb,
      lineTotal,
    };

    setLines([...lines, newLine]);
    toast.success(`Added ${newLine.billableWeight} LBS of ${newLine.metalName}`);

    setGrossWeight(0);
    setTareWeight(0);
    setDeductionPercent(0);
    setVehicleGrossIn(0);
    setVehicleTareOut(0);
  };

  const handleRemoveLine = (id: string) => {
    setLines(lines.filter((l) => l.id !== id));
  };

  const totalBillableWeight = lines.reduce((acc, l) => acc + l.billableWeight, 0);
  const totalPayout = lines.reduce((acc, l) => acc + l.lineTotal, 0);

  // Statutory Cash Limit Calculation:
  // Non-Ferrous (including Precious, E-Waste, Batteries): Max $25.00 Cash
  // Ferrous only: Max $100.00 Cash
  const hasNonFerrous = lines.some(
    (l) => l.metalCategory === 'Non-Ferrous' || l.metalCategory === 'Precious' || l.metalCategory === 'E-Waste' || l.metalCategory === 'Batteries & Auto'
  );
  const maxCashLimit = hasNonFerrous ? 25.00 : 100.00;
  const exceedsCashLimit = totalPayout > maxCashLimit;

  // Auto-switch to Check if total payout exceeds allowed cash capping limit
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
    toast.success('Part 1 Details Transferred! Ready for Office PC Scale Weighing.');
  };

  // Complete ticket on Office PC
  const handleSubmitTicket = () => {
    if (lines.length === 0) {
      toast.error('Add at least one scrap line item to complete ticket');
      return;
    }
    if (!customerName.trim()) {
      toast.error('Please enter customer name for state compliance record');
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
    const finalTicketId = activeTicketId || `T-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const completedTicket: Ticket = {
      id: finalTicketId,
      ticketType: 'SCRAP_METAL',
      createdAt: new Date().toISOString(),
      status: 'COMPLETED',
      customerId: selectedCustomerId || undefined,
      customerName,
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
    toast.success(`Scrap Ticket #${completedTicket.id} Completed on Office PC! Voucher Issued.`);
    onTicketCreated(completedTicket);
  };

  const popularMetals = metals.filter((m) => m.isPopular).slice(0, 6);

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
                {currentStep === 1 ? 'STEP 1: IPAD FIELD INTAKE' : 'STEP 2: OFFICE PC SCALE'}
              </Badge>
            </div>
            <p className="text-xs text-slate-400">
              {currentStep === 1
                ? 'Part 1 (iPad): Customer profile, DL scan & 5-point photo studio'
                : 'Part 2 (Office PC): Scale weight entry & statutory payout voucher'}
            </p>
          </div>
        </div>

        {/* Action Controls & Pending Queue Indicator */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Pending iPad Tickets Queue Drawer Trigger */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => { refreshPendingTickets(); setIsPendingModalOpen(true); }}
            className="relative bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/20 text-amber-300 font-bold text-xs gap-1.5"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Pending iPad Queue</span>
            {pendingTickets.length > 0 && (
              <Badge className="ml-1 bg-amber-500 text-slate-950 font-black text-[10px] px-1.5 py-0">
                {pendingTickets.length}
              </Badge>
            )}
          </Button>

          {/* Step Selector Pills */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <Button
              size="sm"
              variant={currentStep === 1 ? 'default' : 'ghost'}
              onClick={() => setCurrentStep(1)}
              className={`text-xs font-bold gap-1 ${
                currentStep === 1 ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Tablet className="w-3.5 h-3.5" /> 1. iPad Intake
            </Button>
            <Button
              size="sm"
              variant={currentStep === 2 ? 'default' : 'ghost'}
              onClick={handleProceedToStep2}
              className={`text-xs font-bold gap-1 ${
                currentStep === 2 ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" /> 2. Office PC
            </Button>
          </div>
        </div>
      </div>

      {/* STEP 1: INITIAL INTAKE & CUSTOMER COMPLIANCE PAGE (IPAD FIELD MODE) */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="lg:col-span-2 space-y-6">

              {/* 1. CUSTOMER / SELLER PROFILE CARD */}
              <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
                <CardHeader className="py-3.5 px-4 bg-slate-950/80 border-b border-slate-800 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300 flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-400" /> Customer / Seller Profile (iPad Field Input)
                  </CardTitle>

                  <label className="cursor-pointer inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-2 rounded-lg transition-colors shadow-md">
                    <CreditCard className="w-4 h-4" /> Scan Data from DL Picture
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleDlPictureUpload}
                      className="hidden"
                    />
                  </label>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs text-slate-300">Select Registered Customer</Label>
                      <Select value={selectedCustomerId} onValueChange={handleCustomerSelect}>
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs mt-1 h-11">
                          <SelectValue placeholder="-- Select existing --" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                          {customers.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="text-xs">
                              {c.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs text-slate-300">Seller Name *</Label>
                      <Input
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="e.g. Marcus Vance"
                        className="bg-slate-950 border-slate-800 text-white font-bold text-xs mt-1 h-11"
                      />
                    </div>

                    <div>
                      <Label className="text-xs text-slate-300">Driver License / ID #</Label>
                      <Input
                        value={customerIdNumber}
                        onChange={(e) => setCustomerIdNumber(e.target.value)}
                        placeholder="e.g. DL-4481029-GA"
                        className="bg-slate-950 border-slate-800 text-amber-300 font-mono text-xs mt-1 h-11"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-300">Vehicle License Plate Tag</Label>
                    <Input
                      value={vehicleLicensePlate}
                      onChange={(e) => setVehicleLicensePlate(e.target.value)}
                      placeholder="e.g. TOW-912 (GA)"
                      className="bg-slate-950 border-slate-800 text-slate-200 font-mono uppercase text-xs mt-1 h-11 max-w-sm"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 2. LEGAL COMPLIANCE & PHOTO CAPTURE STUDIO */}
              <Card className="bg-slate-900 border-blue-500/40 text-white shadow-xl overflow-hidden">
                <CardHeader className="py-3 px-4 bg-gradient-to-r from-blue-950/80 to-slate-950 border-b border-blue-500/30 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-blue-400" />
                    <CardTitle className="text-sm font-bold tracking-wide uppercase text-white">
                      State Legal Compliance & iPad Camera Studio
                    </CardTitle>
                  </div>

                  <Badge
                    className={`text-xs ${
                      complianceStats.score === 100
                        ? "bg-emerald-950 text-emerald-400 border-emerald-500/40"
                        : "bg-amber-950 text-amber-400 border-amber-500/40"
                    }`}
                  >
                    {complianceStats.score}% Studio Audit Verified
                  </Badge>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { title: "DL Scan", icon: CreditCard, val: complianceCaptures.idPhotoUrl },
                      { title: "Seller Face", icon: UserCheck, val: complianceCaptures.personPhotoUrl },
                      { title: "Vehicle 45°", icon: Truck, val: complianceCaptures.vehiclePhotoUrl },
                      { title: "License Plate", icon: Scan, val: complianceCaptures.licensePlatePhotoUrl },
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
                      5-point photo verification & ID OCR scan sealed.
                    </p>
                    <Button
                      onClick={() => setIsComplianceModalOpen(true)}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs gap-2 min-h-[44px]"
                    >
                      <Camera className="w-4 h-4" /> Launch iPad Camera Studio
                    </Button>
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* Right Column: Step 1 Confirmation & Save as Pending Options */}
            <div className="space-y-6">
              <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
                <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800">
                  <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300 flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-400" /> Part 1 iPad Dispatch Options
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Seller Name:</span>
                      <span className="text-white font-bold">{customerName || 'Not Entered'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">License / ID #:</span>
                      <span className="text-amber-300 font-mono font-bold">{customerIdNumber || 'Pending DL Photo'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Compliance Audit:</span>
                      <span className="text-emerald-400 font-bold">{complianceStats.score}% Studio Audit</span>
                    </div>
                  </div>

                  {/* SAVE AS PENDING ON IPAD BUTTON */}
                  <Button
                    onClick={handleSaveAsPendingFromIpad}
                    className="w-full h-12 bg-amber-600 hover:bg-amber-500 text-slate-950 font-extrabold text-xs sm:text-sm gap-2 shadow-lg"
                  >
                    <Clock className="w-4 h-4 text-slate-950" /> Save as Pending (Send to Office PC)
                  </Button>

                  <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800" /></div>
                    <div className="relative flex justify-center text-[10px] uppercase text-slate-500"><span className="bg-slate-900 px-2">OR</span></div>
                  </div>

                  {/* PROCEED DIRECTLY TO STEP 2 */}
                  <Button
                    onClick={handleProceedToStep2}
                    variant="outline"
                    className="w-full h-11 border-emerald-500/50 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/50 font-bold text-xs gap-2"
                  >
                    Proceed Directly to Scale Weight <ArrowRight className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>

          </div>
        </div>
      )}

      {/* STEP 2: WEIGHING, SCRAP LINES & PAYOUT PAGE (OFFICE PC WORKSTATION) */}
      {currentStep === 2 && (
        <div className="space-y-6">
          
          {/* Summary Banner from Step 1 */}
          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center gap-1.5">
                <Laptop className="w-4 h-4" /> OFFICE PC WORKSTATION
              </div>
              <div>
                <span className="font-bold text-white">{customerName}</span>
                <span className="text-slate-400 ml-2 font-mono">({customerIdNumber || 'DL On File'})</span>
                <span className="text-emerald-400 ml-2">| Tag: {vehicleLicensePlate || 'Verified'}</span>
                {activeTicketId && (
                  <Badge className="ml-2 bg-amber-500/20 text-amber-300 border-amber-500/30 font-mono text-[10px]">
                    Pending Ticket #{activeTicketId}
                  </Badge>
                )}
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
                    <Scale className="w-4 h-4 text-emerald-400" /> Office Scale Entry
                  </CardTitle>

                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setWeighingMode('SINGLE_ITEM')}
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

                  {weighingMode === 'VEHICLE_DOUBLE' && (
                    <div className="p-3 bg-slate-950 border border-emerald-500/30 rounded-lg space-y-2 text-xs">
                      <div className="flex items-center justify-between text-emerald-400 font-bold">
                        <span>Vehicle Drive-On / Drive-Off Calculation</span>
                        <span>Gross - Tare = Net</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Gross In</span>
                          <span className="font-mono font-bold text-white text-sm">{vehicleGrossIn} lbs</span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Tare Out</span>
                          <span className="font-mono font-bold text-amber-300 text-sm">{vehicleTareOut} lbs</span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Net Scrap</span>
                          <span className="font-mono font-bold text-emerald-400 text-sm">
                            {Math.max(0, vehicleGrossIn - vehicleTareOut)} lbs
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Weight Entry */}
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

                    {/* Touch weight quick adjustments */}
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

                  <Button
                    onClick={handleAddLine}
                    disabled={grossWeight <= 0}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-md"
                  >
                    <Plus className="w-5 h-5 mr-1" /> Add Line Item To Voucher
                  </Button>

                </CardContent>
              </Card>

              {/* Itemized Table */}
              <Card className="bg-slate-900 border-slate-800 text-white shadow-lg overflow-hidden">
                <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300">
                    Ticket Itemized Lines ({lines.length})
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-0">
                  {lines.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      No scrap line items added yet. Capture weight from the scale gauge and tap "Add Line Item".
                    </div>
                  ) : (
                    <Table>
                      <TableHeader className="bg-slate-950/80">
                        <TableRow className="border-slate-800 hover:bg-slate-950 text-xs">
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
              <LiveScaleGauge onHoldWeight={handleHoldWeightFromScale} compact />

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

                  {/* STATUTORY PAYOUT OPTIONS (Cash Capped vs Check Issue) */}
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-300 font-bold block">
                      Select Payout Method *
                    </Label>

                    <div className="grid grid-cols-2 gap-2">
                      {/* Cash Option */}
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

                      {/* Check Option */}
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

                    {/* Exceeds Cash Limit Statutory Notice */}
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

                    {/* CHECK NUMBER RECORDING SECTION */}
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
                    className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-extrabold shadow-lg shadow-emerald-950 text-sm tracking-wide"
                  >
                    <CheckCircle2 className="w-5 h-5 mr-2" /> Complete Ticket & Issue Voucher
                  </Button>
                </CardContent>
              </Card>

            </div>

          </div>
        </div>
      )}

      {/* PENDING IPAD TICKETS QUEUE DIALOG */}
      <Dialog open={isPendingModalOpen} onOpenChange={setIsPendingModalOpen}>
        <DialogContent className="sm:max-w-[620px] bg-slate-900 border-slate-800 text-white">
          <DialogHeader className="border-b border-slate-800 pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              <DialogTitle className="text-base font-bold font-mono">
                Pending iPad Intakes ({pendingTickets.length})
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

          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
            {pendingTickets.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs space-y-2">
                <Tablet className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="font-bold text-slate-300">No Pending iPad Intakes</p>
                <p className="text-[11px] text-slate-500">
                  When field yard employees save Step 1 on an iPad, the ticket appears here ready for the Office PC scale operator.
                </p>
              </div>
            ) : (
              pendingTickets.map((ticket) => (
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
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        ID #: {ticket.customerIdNumber || 'On File'} | Vehicle Tag: {ticket.vehicleLicensePlate || 'N/A'}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Saved: {new Date(ticket.createdAt).toLocaleTimeString()} ({ticket.operatorName})
                      </p>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleLoadPendingTicket(ticket)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1 shadow-md shrink-0"
                    >
                      Load on Office Scale <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  {/* Thumbnail Preview */}
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
              ))
            )}
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