import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  CreditCard,
  DollarSign,
  FileCheck,
  PackagePlus,
  Scale,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { ComplianceCaptureModal } from '@/components/compliance/ComplianceCaptureModal';
import { LiveScaleGauge } from '@/components/scale/LiveScaleGauge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { analyzeDriverLicenseImage } from '@/services/aiVisionService';
import { optimizeImageDataUrl, uploadDataUrl } from '@/services/mediaService';
import { storageService } from '@/services/storageService';
import { ComplianceCaptures, Customer, MetalGrade, ScrapTicketLine, Ticket, WeightUnit } from '@/types/scrap';
import { calculateComplianceScore, DLScanResult } from '@/utils/complianceUtils';

interface MobileScrapTicketProps {
  onBack: () => void;
  onTicketCreated: (ticket: Ticket) => void;
}

const emptyCaptures: ComplianceCaptures = {
  personPhotoUrl: undefined,
  idPhotoUrl: undefined,
  vehiclePhotoUrl: undefined,
  licensePlatePhotoUrl: undefined,
  loadPhotoUrl: undefined,
};

const makeTicketNumber = () => storageService.generateScrapReceiptNumber();

export const MobileScrapTicket: React.FC<MobileScrapTicketProps> = ({ onBack, onTicketCreated }) => {
  const [metals] = useState<MetalGrade[]>(() => storageService.getMetals());
  const [customers] = useState<Customer[]>(() => storageService.getCustomers());
  const [ticketNumber] = useState(makeTicketNumber);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerIdNumber, setCustomerIdNumber] = useState('');
  const [vehicleLicensePlate, setVehicleLicensePlate] = useState('');
  const [isDlScanned, setIsDlScanned] = useState(false);
  const [captures, setCaptures] = useState<ComplianceCaptures>(emptyCaptures);
  const [captureOpen, setCaptureOpen] = useState(false);

  const popularMetals = useMemo(() => {
    const popular = metals.filter((metal) => metal.isPopular);
    return (popular.length ? popular : metals).slice(0, 8);
  }, [metals]);
  const [selectedMetalId, setSelectedMetalId] = useState(metals[0]?.id ?? '');
  const [grossWeight, setGrossWeight] = useState('');
  const [tareWeight, setTareWeight] = useState('0');
  const [deductionPercent, setDeductionPercent] = useState('0');
  const [lines, setLines] = useState<ScrapTicketLine[]>([]);

  const [payoutMethod, setPayoutMethod] = useState<'Cash' | 'Check'>('Cash');
  const [checkNumber, setCheckNumber] = useState(`CHK-${Math.floor(1000 + Math.random() * 9000)}`);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedMetal = metals.find((metal) => metal.id === selectedMetalId);
  const compliance = calculateComplianceScore(captures, 'SCRAP_METAL');
  const totalBillableWeight = lines.reduce((sum, line) => sum + line.billableWeight, 0);
  const totalPayout = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const hasNonFerrous = lines.some((line) =>
    ['Non-Ferrous', 'Precious', 'E-Waste', 'Batteries & Auto'].includes(line.metalCategory)
  );
  const maxCashLimit = hasNonFerrous ? 25 : 100;
  const exceedsCashLimit = totalPayout > maxCashLimit;

  useEffect(() => {
    if (exceedsCashLimit) setPayoutMethod('Check');
  }, [exceedsCashLimit]);

  const applyCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const customer = customers.find((item) => item.id === customerId);
    if (!customer) return;
    setCustomerName(customer.fullName);
    setCustomerPhone(customer.phone);
    setCustomerIdNumber(customer.idNumber);
    setVehicleLicensePlate(customer.vehicleLicensePlate ?? '');
    setIsDlScanned(Boolean(customer.idPhotoUrl));
    if (customer.idPhotoUrl) {
      setCaptures((current) => ({ ...current, idPhotoUrl: customer.idPhotoUrl }));
    }
  };

  const applyScan = (profile: DLScanResult, idPhotoUrl?: string) => {
    if (profile.fullName) setCustomerName(profile.fullName);
    if (profile.idNumber) setCustomerIdNumber(profile.idNumber);
    if (profile.vehicleLicensePlate) setVehicleLicensePlate(profile.vehicleLicensePlate);
    if (idPhotoUrl) setCaptures((current) => ({ ...current, idPhotoUrl }));
    setIsDlScanned(Boolean(profile.fullName || profile.idNumber));

    const existing = customers.find(
      (customer) =>
        (profile.idNumber && customer.idNumber.toLowerCase() === profile.idNumber.toLowerCase()) ||
        (profile.fullName && customer.fullName.toLowerCase() === profile.fullName.toLowerCase())
    );
    if (existing) {
      setSelectedCustomerId(existing.id);
      setCustomerPhone(existing.phone);
    }
  };

  const handleDlUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      toast.info('Reading driver license…');
      const optimizedImage = await optimizeImageDataUrl(file);
      const [profile, savedUrl] = await Promise.all([
        analyzeDriverLicenseImage(optimizedImage),
        uploadDataUrl(optimizedImage, file.name),
      ]);
      applyScan(profile, savedUrl);
      if (profile.fullName || profile.idNumber) {
        toast.success('Driver license read and customer fields filled', {
          description: `${profile.fullName || 'Name needs review'} · ${profile.idNumber || 'ID number needs review'}`,
        });
      } else {
        toast.warning('ID photo saved, but the text could not be read', {
          description: 'Retake in bright, even light with all four corners visible, or enter the fields manually.',
        });
      }
    } catch (error) {
      toast.error('Could not process the driver license image', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  const handleComplianceSave = (nextCaptures: ComplianceCaptures, profile?: DLScanResult) => {
    setCaptures(nextCaptures);
    if (profile) applyScan(profile, nextCaptures.idPhotoUrl);
  };

  const handleScaleWeight = (weight: number, unit: WeightUnit) => {
    const pounds = unit === 'KG' ? weight * 2.20462 : weight;
    setGrossWeight(Math.max(0, Math.round(pounds * 10) / 10).toString());
  };

  const handleAddLine = () => {
    if (!selectedMetal) return;
    const gross = Number(grossWeight);
    const tare = Number(tareWeight) || 0;
    const deduction = Number(deductionPercent) || 0;
    if (!Number.isFinite(gross) || gross <= 0) {
      toast.error('Enter or capture a weight greater than zero');
      return;
    }
    if (tare < 0 || tare >= gross) {
      toast.error('Tare must be zero or less than the gross weight');
      return;
    }
    if (deduction < 0 || deduction > 100) {
      toast.error('Deduction must be between 0 and 100 percent');
      return;
    }

    const netWeight = Math.round((gross - tare) * 10) / 10;
    const deductionLbs = Math.round(netWeight * (deduction / 100) * 10) / 10;
    const billableWeight = Math.max(0, Math.round((netWeight - deductionLbs) * 10) / 10);
    const lineTotal = Math.round(billableWeight * selectedMetal.ratePerLb * 100) / 100;
    const line: ScrapTicketLine = {
      id: `line-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      metalGradeId: selectedMetal.id,
      metalName: selectedMetal.name,
      metalCategory: selectedMetal.category,
      grossWeight: gross,
      tareWeight: tare,
      netWeight,
      deductionPercent: deduction,
      deductionLbs,
      billableWeight,
      ratePerLb: selectedMetal.ratePerLb,
      lineTotal,
    };
    setLines((current) => [...current, line]);
    setGrossWeight('');
    setTareWeight('0');
    setDeductionPercent('0');
    toast.success(`${selectedMetal.name} added to ticket`);
  };

  const handleSubmit = () => {
    if (!customerName.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (!customerIdNumber.trim()) {
      toast.error('Driver license or ID number is required');
      return;
    }
    if (lines.length === 0) {
      toast.error('Add at least one material before completing the ticket');
      return;
    }
    if (payoutMethod === 'Cash' && exceedsCashLimit) {
      toast.error(`Cash is limited to $${maxCashLimit.toFixed(2)} for this ticket`);
      return;
    }
    if (payoutMethod === 'Check' && !checkNumber.trim()) {
      toast.error('Check number is required');
      return;
    }

    setIsSubmitting(true);
    // If another device took this sequential number while the form was open, grab the next one
    const finalTicketNumber = storageService.getTickets().some((existing) => existing.id === ticketNumber)
      ? storageService.generateScrapReceiptNumber()
      : ticketNumber;
    const ticket: Ticket = {
      id: finalTicketNumber,
      ticketType: 'SCRAP_METAL',
      createdAt: new Date().toISOString(),
      status: 'COMPLETED',
      customerId: selectedCustomerId || undefined,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      customerIdNumber: customerIdNumber.trim(),
      vehicleLicensePlate: vehicleLicensePlate.trim() || undefined,
      scrapLines: lines,
      complianceCaptures: captures,
      grossTotal: Math.round(totalPayout * 100) / 100,
      totalDeductions: 0,
      finalPayout: Math.round(totalPayout * 100) / 100,
      payoutMethod,
      checkNumber: payoutMethod === 'Check' ? checkNumber.trim() : undefined,
      operatorName: storageService.getSettings().operatorName,
      notes: notes.trim() || undefined,
    };
    storageService.saveTicket(ticket);
    toast.success(`Ticket ${ticket.id} completed`);
    onTicketCreated(ticket);
    setIsSubmitting(false);
  };

  const sectionHeader = (number: string, title: string, icon: React.ReactNode) => (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-950/40">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-400">Step {number}</p>
        <h2 className="text-lg font-black tracking-tight text-white">{title}</h2>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-28">
      <header className="sticky top-0 z-20 -mx-4 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-11 w-11 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-black text-white">Mobile Scrap Ticket</h1>
              <Badge className="border border-emerald-500/30 bg-emerald-950 text-[9px] text-emerald-300">FAST INTAKE</Badge>
            </div>
            <p className="font-mono text-[11px] text-slate-400">#{ticketNumber}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-right">
            <p className="text-[9px] font-bold uppercase text-slate-500">Payout</p>
            <p className="font-mono text-base font-black text-emerald-400">${totalPayout.toFixed(2)}</p>
          </div>
        </div>
      </header>

      <Card className="overflow-hidden rounded-3xl border-slate-800 bg-slate-900 text-white shadow-2xl">
        <CardHeader className="border-b border-slate-800 bg-slate-950/60 p-5">
          <CardTitle>{sectionHeader('1', 'Customer & compliance', <ShieldCheck className="h-5 w-5" />)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-blue-600 p-3 text-center font-bold text-white shadow-lg shadow-blue-950/40 transition active:scale-[0.98] hover:bg-blue-500">
              <CreditCard className="h-7 w-7" />
              <span className="text-sm">Scan Driver License</span>
              <input type="file" accept="image/*" capture="environment" onChange={handleDlUpload} className="hidden" />
            </label>
            <button type="button" onClick={() => setCaptureOpen(true)} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-emerald-500/50 bg-emerald-950/60 p-3 text-center font-bold text-emerald-200 transition active:scale-[0.98] hover:bg-emerald-900/60">
              <Camera className="h-7 w-7" />
              <span className="text-sm">Capture All Photos</span>
            </button>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 p-3">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${compliance.score === 100 ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500/15 text-amber-400'}`}>
                {compliance.score === 100 ? <CheckCircle2 className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-sm font-bold">Compliance capture</p>
                <p className="text-[11px] text-slate-400">{compliance.score}% complete · {compliance.missingItems.length} remaining</p>
              </div>
            </div>
            <Badge className={compliance.score === 100 ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500/15 text-amber-300'}>{compliance.status}</Badge>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-bold text-slate-300">Existing customer</Label>
            <Select value={selectedCustomerId} onValueChange={applyCustomer}>
              <SelectTrigger className="h-12 rounded-xl border-slate-700 bg-slate-950 text-white"><SelectValue placeholder="Select a returning customer" /></SelectTrigger>
              <SelectContent className="border-slate-700 bg-slate-900 text-white">
                {customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.fullName} · {customer.phone || customer.idNumber}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isDlScanned && <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3 py-2 text-xs font-bold text-emerald-300"><Check className="h-4 w-4" /> ID scanned and fields auto-filled</div>}

          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label className="mb-1.5 block text-xs text-slate-300">Customer name *</Label><Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} className="h-12 rounded-xl border-slate-700 bg-slate-950 text-white" placeholder="Full legal name" /></div>
            <div><Label className="mb-1.5 block text-xs text-slate-300">Phone</Label><Input type="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} className="h-12 rounded-xl border-slate-700 bg-slate-950 text-white" placeholder="(555) 000-0000" /></div>
            <div><Label className="mb-1.5 block text-xs text-slate-300">Driver license / ID *</Label><Input value={customerIdNumber} onChange={(event) => setCustomerIdNumber(event.target.value)} className="h-12 rounded-xl border-slate-700 bg-slate-950 font-mono text-amber-300" placeholder="ID number" /></div>
            <div><Label className="mb-1.5 block text-xs text-slate-300">License plate</Label><Input value={vehicleLicensePlate} onChange={(event) => setVehicleLicensePlate(event.target.value.toUpperCase())} className="h-12 rounded-xl border-slate-700 bg-slate-950 font-mono uppercase text-white" placeholder="Plate tag" /></div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-3xl border-slate-800 bg-slate-900 text-white shadow-2xl">
        <CardHeader className="border-b border-slate-800 bg-slate-950/60 p-5">
          <CardTitle>{sectionHeader('2', 'Materials & weight', <Scale className="h-5 w-5" />)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          <div>
            <Label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Popular grades</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {popularMetals.map((metal) => (
                <button key={metal.id} type="button" onClick={() => setSelectedMetalId(metal.id)} className={`min-h-20 rounded-2xl border p-3 text-left transition active:scale-[0.98] ${selectedMetalId === metal.id ? 'border-emerald-400 bg-emerald-950 text-white ring-1 ring-emerald-400' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600'}`}>
                  <span className="block text-xs font-black leading-tight">{metal.name}</span>
                  <span className="mt-1 block font-mono text-[11px] text-emerald-400">${metal.ratePerLb.toFixed(2)}/lb</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-bold text-slate-300">All metal grades</Label>
            <Select value={selectedMetalId} onValueChange={setSelectedMetalId}>
              <SelectTrigger className="h-12 rounded-xl border-slate-700 bg-slate-950 text-white"><SelectValue placeholder="Choose a material" /></SelectTrigger>
              <SelectContent className="border-slate-700 bg-slate-900 text-white">{metals.map((metal) => <SelectItem key={metal.id} value={metal.id}>{metal.name} · ${metal.ratePerLb.toFixed(2)}/lb</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <LiveScaleGauge onHoldWeight={handleScaleWeight} compact />

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3 sm:col-span-1"><Label className="mb-1.5 block text-xs text-slate-300">Gross weight *</Label><Input type="number" inputMode="decimal" min="0" value={grossWeight} onChange={(event) => setGrossWeight(event.target.value)} className="h-14 rounded-xl border-emerald-500/40 bg-slate-950 text-center font-mono text-xl font-black text-emerald-400" placeholder="0.0" /></div>
            <div><Label className="mb-1.5 block text-xs text-slate-300">Tare lbs</Label><Input type="number" inputMode="decimal" min="0" value={tareWeight} onChange={(event) => setTareWeight(event.target.value)} className="h-14 rounded-xl border-slate-700 bg-slate-950 text-center font-mono text-white" /></div>
            <div className="col-span-2 sm:col-span-1"><Label className="mb-1.5 block text-xs text-slate-300">Deduction %</Label><Input type="number" inputMode="decimal" min="0" max="100" value={deductionPercent} onChange={(event) => setDeductionPercent(event.target.value)} className="h-14 rounded-xl border-slate-700 bg-slate-950 text-center font-mono text-white" /></div>
          </div>

          <Button onClick={handleAddLine} className="h-14 w-full rounded-2xl bg-emerald-500 text-base font-black text-slate-950 shadow-lg shadow-emerald-950/50 hover:bg-emerald-400"><PackagePlus className="mr-2 h-5 w-5" /> Add Material</Button>

          <div className="space-y-2">
            <div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Ticket items</p><Badge className="bg-slate-800 text-slate-300">{lines.length}</Badge></div>
            {lines.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-6 text-center text-sm text-slate-500">Choose a grade, enter weight, and add the first material.</div>
            ) : lines.map((line) => (
              <div key={line.id} className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-3">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-white">{line.metalName}</p><p className="font-mono text-[11px] text-slate-400">{line.billableWeight.toLocaleString()} lb × ${line.ratePerLb.toFixed(2)}</p></div>
                <p className="font-mono text-base font-black text-emerald-400">${line.lineTotal.toFixed(2)}</p>
                <Button variant="ghost" size="icon" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))} className="h-11 w-11 rounded-xl text-slate-500 hover:bg-red-950 hover:text-red-400"><Trash2 className="h-5 w-5" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-3xl border-emerald-500/30 bg-slate-900 text-white shadow-2xl">
        <CardHeader className="border-b border-slate-800 bg-slate-950/60 p-5"><CardTitle>{sectionHeader('3', 'Payout & completion', <DollarSign className="h-5 w-5" />)}</CardTitle></CardHeader>
        <CardContent className="space-y-5 p-5">
          <div className="rounded-3xl border border-emerald-500/30 bg-emerald-950/50 p-5 text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Total payout</p>
            <p className="mt-1 font-mono text-5xl font-black tracking-tight text-white">${totalPayout.toFixed(2)}</p>
            <p className="mt-2 text-xs text-emerald-200/70">{totalBillableWeight.toLocaleString()} billable lbs · {lines.length} item{lines.length === 1 ? '' : 's'}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button type="button" disabled={exceedsCashLimit} onClick={() => setPayoutMethod('Cash')} className={`min-h-24 rounded-2xl border p-4 text-left transition ${payoutMethod === 'Cash' ? 'border-emerald-400 bg-emerald-950 ring-1 ring-emerald-400' : exceedsCashLimit ? 'cursor-not-allowed border-slate-800 bg-slate-950 opacity-40' : 'border-slate-700 bg-slate-950'}`}>
              <div className="flex items-center justify-between"><DollarSign className="h-6 w-6 text-emerald-400" />{payoutMethod === 'Cash' && <Check className="h-5 w-5 text-emerald-400" />}</div><p className="mt-2 text-sm font-black">Cash</p><p className="text-[10px] text-slate-400">Limit ${maxCashLimit.toFixed(0)}</p>
            </button>
            <button type="button" onClick={() => setPayoutMethod('Check')} className={`min-h-24 rounded-2xl border p-4 text-left transition ${payoutMethod === 'Check' ? 'border-blue-400 bg-blue-950/70 ring-1 ring-blue-400' : 'border-slate-700 bg-slate-950'}`}>
              <div className="flex items-center justify-between"><FileCheck className="h-6 w-6 text-blue-400" />{payoutMethod === 'Check' && <Check className="h-5 w-5 text-blue-400" />}</div><p className="mt-2 text-sm font-black">Check</p><p className="text-[10px] text-slate-400">Any payout amount</p>
            </button>
          </div>

          {exceedsCashLimit && <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-950/40 p-3 text-xs text-amber-100"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" /><p><strong>Check required.</strong> This ${totalPayout.toFixed(2)} payout exceeds the ${maxCashLimit.toFixed(2)} statutory cash limit.</p></div>}
          {payoutMethod === 'Check' && <div><Label className="mb-1.5 block text-xs font-bold text-slate-300">Check number *</Label><Input value={checkNumber} onChange={(event) => setCheckNumber(event.target.value)} className="h-12 rounded-xl border-blue-500/40 bg-slate-950 font-mono text-amber-300" /></div>}
          <div><Label className="mb-1.5 block text-xs text-slate-300">Ticket notes</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-20 rounded-xl border-slate-700 bg-slate-950 text-white" placeholder="Optional material or transaction notes" /></div>

          <Button onClick={handleSubmit} disabled={isSubmitting || lines.length === 0} className="h-16 w-full rounded-2xl bg-emerald-500 text-lg font-black text-slate-950 shadow-xl shadow-emerald-950/60 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400"><CheckCircle2 className="mr-2 h-6 w-6" /> {isSubmitting ? 'Completing…' : 'Complete Ticket'}</Button>
          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500"><UserRound className="h-3.5 w-3.5" /> Saved under {storageService.getSettings().operatorName}</div>
        </CardContent>
      </Card>

      <ComplianceCaptureModal isOpen={captureOpen} onClose={() => setCaptureOpen(false)} initialCaptures={captures} onSaveCaptures={handleComplianceSave} intakeType="SCRAP_METAL" />
    </div>
  );
};
