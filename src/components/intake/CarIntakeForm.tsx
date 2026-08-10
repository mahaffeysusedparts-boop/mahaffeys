import React, { useState, useEffect } from 'react';
import { CarIntakeRecord, Customer, Ticket, WeightUnit, ComplianceCaptures } from '@/types/scrap';
import { storageService } from '@/services/storageService';
import { scaleService } from '@/services/scaleService';
import { LiveScaleGauge } from '../scale/LiveScaleGauge';
import { ComplianceCaptureModal } from '../compliance/ComplianceCaptureModal';
import { calculateComplianceScore, generateSamplePhoto, generateSampleThumbprint, DLScanResult } from '@/utils/complianceUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Car,
  CheckCircle2,
  AlertCircle,
  Search,
  User,
  DollarSign,
  Printer,
  Sparkles,
  ArrowLeft,
  FileCheck,
  ShieldAlert,
  Scale,
  Camera,
  CreditCard,
  Scan,
  Package,
  Fingerprint,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';

interface CarIntakeFormProps {
  onBack: () => void;
  onTicketCreated: (ticket: Ticket) => void;
}

export const CarIntakeForm: React.FC<CarIntakeFormProps> = ({ onBack, onTicketCreated }) => {
  const [customers, setCustomers] = useState<Customer[]>(storageService.getCustomers());
  const [carRates] = useState(storageService.getCarRates());
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(carRates[0]?.id || '');
  
  // Selected Customer
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerIdNumber, setCustomerIdNumber] = useState<string>('');
  const [vehicleLicensePlate, setVehicleLicensePlate] = useState<string>('');

  // Compliance Captures state
  const [complianceCaptures, setComplianceCaptures] = useState<ComplianceCaptures>({
    personPhotoUrl: generateSamplePhoto('person'),
    idPhotoUrl: generateSamplePhoto('id'),
    vehiclePhotoUrl: generateSamplePhoto('vehicle'),
    licensePlatePhotoUrl: generateSamplePhoto('plate'),
    loadPhotoUrl: generateSamplePhoto('load'),
    thumbprintCaptured: true,
    thumbprintDataUrl: generateSampleThumbprint(),
  });
  const [isComplianceModalOpen, setIsComplianceModalOpen] = useState(false);

  // Car Record State
  const [vin, setVin] = useState<string>('');
  const [year, setYear] = useState<number>(2012);
  const [make, setMake] = useState<string>('Ford');
  const [model, setModel] = useState<string>('F-150');
  const [color, setColor] = useState<string>('White');
  const [mileage, setMileage] = useState<number>(175000);
  
  const [titleStatus, setTitleStatus] = useState<CarIntakeRecord['titleStatus']>('Clean Title');
  const [titleNumber, setTitleNumber] = useState<string>('');

  // Features Checklist
  const [hasCatalyticConverter, setHasCatalyticConverter] = useState<boolean>(true);
  const [catCondition, setCatCondition] = useState<CarIntakeRecord['catCondition']>('Original OEM');
  const [hasEngineAndTrans, setHasEngineAndTrans] = useState<boolean>(true);
  const [hasBattery, setHasBattery] = useState<boolean>(true);
  const [hasAluminumRims, setHasAluminumRims] = useState<boolean>(true);
  const [fluidsDrained, setFluidsDrained] = useState<boolean>(true);

  // Weight & Pricing State
  const [pricingMode, setPricingMode] = useState<'TONNAGE' | 'FLAT_RATE'>('TONNAGE');
  const [vehicleWeightLbs, setVehicleWeightLbs] = useState<number>(3650);
  const [ratePerTon, setRatePerTon] = useState<number>(220);
  const [flatRate, setFlatRate] = useState<number>(300);
  const [manualDeductions, setManualDeductions] = useState<number>(0);
  const [payoutMethod, setPayoutMethod] = useState<'Cash' | 'Check' | 'ACH Direct Transfer'>('Cash');
  const [notes, setNotes] = useState<string>('');

  const complianceStats = calculateComplianceScore(complianceCaptures);

  // Sync selected customer details
  const handleCustomerSelect = (custId: string) => {
    setSelectedCustomerId(custId);
    const cust = customers.find((c) => c.id === custId);
    if (cust) {
      setCustomerName(cust.fullName);
      setCustomerIdNumber(cust.idNumber);
      if (cust.vehicleLicensePlate) setVehicleLicensePlate(cust.vehicleLicensePlate);
      if (cust.idPhotoUrl || cust.thumbprintData) {
        setComplianceCaptures((prev) => ({
          ...prev,
          idPhotoUrl: cust.idPhotoUrl || prev.idPhotoUrl,
          thumbprintDataUrl: cust.thumbprintData || prev.thumbprintDataUrl,
          thumbprintCaptured: !!cust.thumbprintData || prev.thumbprintCaptured,
        }));
      }
    }
  };

  // Callback from ComplianceCaptureModal
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

  // Sync category rates when user picks vehicle category preset
  useEffect(() => {
    const rateObj = carRates.find((r) => r.id === selectedCategoryId);
    if (rateObj) {
      setRatePerTon(rateObj.ratePerTon);
    }
  }, [selectedCategoryId, carRates]);

  // VIN Decoder Mock Tool
  const handleDecodeVin = () => {
    if (!vin || vin.length < 5) {
      toast.error('Enter a valid VIN string to decode');
      return;
    }
    const clean = vin.toUpperCase().trim();
    setVin(clean);
    
    if (clean.startsWith('1G')) {
      setMake('Chevrolet');
      setModel('Impala');
    } else if (clean.startsWith('1F')) {
      setMake('Ford');
      setModel('F-150');
    } else if (clean.startsWith('4S')) {
      setMake('Subaru');
      setModel('Outback');
    } else if (clean.startsWith('J')) {
      setMake('Toyota');
      setModel('Camry');
    } else {
      setMake('Dodge');
      setModel('Ram 1500');
    }
    toast.success('VIN decoded successfully');
  };

  // Calculate bonuses
  const catBonus = hasCatalyticConverter
    ? catCondition === 'Original OEM'
      ? 80
      : 30
    : 0;
  const engineBonus = hasEngineAndTrans ? 50 : 0;
  const batteryBonus = hasBattery ? 15 : 0;

  // Base weight payout
  const weightTons = vehicleWeightLbs / 2000;
  const baseTonnagePayout = Math.round(weightTons * ratePerTon * 100) / 100;
  const grossCalculatedPayout =
    pricingMode === 'TONNAGE'
      ? baseTonnagePayout + catBonus + engineBonus + batteryBonus
      : flatRate + catBonus + engineBonus + batteryBonus;

  const finalPayout = Math.max(0, grossCalculatedPayout - manualDeductions);

  // Capture live weight from scale gauge
  const handleHoldWeightFromScale = (weight: number, unit: WeightUnit) => {
    const lbs = unit === 'KG' ? Math.round(weight * 2.20462) : Math.round(weight);
    setVehicleWeightLbs(lbs);
    toast.success(`Vehicle weight set to ${lbs.toLocaleString()} LBS`);
  };

  // Submit Ticket
  const handleSubmitTicket = () => {
    if (!customerName.trim()) {
      toast.error('Please enter or select a customer name for compliance');
      return;
    }
    if (!vin.trim()) {
      toast.error('Please enter the vehicle VIN number');
      return;
    }

    const currentOp = storageService.getSettings().operatorName;

    const carRecord: CarIntakeRecord = {
      vin: vin.toUpperCase().trim(),
      year,
      make,
      model,
      color,
      mileage,
      titleStatus,
      titleNumber,
      hasCatalyticConverter,
      catCondition,
      hasEngineAndTrans,
      hasBattery,
      hasAluminumRims,
      fluidsDrained,
      pricingMode,
      vehicleWeightLbs,
      ratePerTon,
      flatRate,
      catBonus,
      engineBonus,
      batteryBonus,
      deductions: manualDeductions,
      totalPayout: Math.round(finalPayout * 100) / 100,
      complianceCaptures,
    };

    const newTicket: Ticket = {
      id: `T-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      ticketType: 'CAR_SALVAGE',
      createdAt: new Date().toISOString(),
      status: 'COMPLETED',
      customerId: selectedCustomerId || undefined,
      customerName,
      customerIdNumber,
      vehicleLicensePlate,
      carRecord,
      complianceCaptures,
      grossTotal: grossCalculatedPayout,
      totalDeductions: manualDeductions,
      finalPayout: Math.round(finalPayout * 100) / 100,
      payoutMethod,
      operatorName: currentOp,
      notes,
    };

    storageService.saveTicket(newTicket);
    toast.success(`Car Salvage Ticket #${newTicket.id} Saved with Legal Compliance Photo Records!`);
    onTicketCreated(newTicket);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white font-mono">
                Car Salvage & Pull-a-Part Intake
              </h1>
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs">
                VEHICLE STATION
              </Badge>
            </div>
            <p className="text-xs text-slate-400">
              Capture vehicle spec, VIN title compliance, NMVTIS audit, and 4-point photo identification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-slate-700 text-slate-300 text-xs font-mono">
            {vehicleWeightLbs.toLocaleString()} LBS Vehicle Weight
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Form Controls */}
        <div className="lg:col-span-2 space-y-6">

          {/* CARD 0: LEGAL COMPLIANCE & PHOTO CAPTURE STUDIO */}
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
                {complianceStats.score}% Studio Audit Verified
              </Badge>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* Photo Live Thumbnails Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { title: "DL Scan", icon: CreditCard, val: complianceCaptures.idPhotoUrl },
                  { title: "Seller Face", icon: UserCheck, val: complianceCaptures.personPhotoUrl },
                  { title: "Vehicle 45°", icon: Car, val: complianceCaptures.vehiclePhotoUrl },
                  { title: "License Plate", icon: Scan, val: complianceCaptures.licensePlatePhotoUrl },
                  { title: "Cargo Load", icon: Package, val: complianceCaptures.loadPhotoUrl },
                  { title: "Thumbprint", icon: Fingerprint, val: complianceCaptures.thumbprintCaptured ? (complianceCaptures.thumbprintDataUrl || generateSampleThumbprint()) : undefined },
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
                  4-angle high-resolution photo verification, ID OCR scan & digital thumbprint sealed.
                </p>
                <Button
                  onClick={() => setIsComplianceModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs gap-2"
                >
                  <Camera className="w-4 h-4" /> Launch Compliance Studio & ID Scan
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Card 1: Customer & Seller Info */}
          <Card className="bg-slate-900 border-slate-800 text-white shadow-lg">
            <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300 flex items-center gap-2">
                <User className="w-4 h-4 text-amber-400" /> Customer / Seller Compliance Info
              </CardTitle>
              <Badge variant="outline" className="border-amber-500/40 text-amber-400 text-[10px]">
                STATE REGISTRY
              </Badge>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-300">Select Registered Customer</Label>
                  <Select value={selectedCustomerId} onValueChange={handleCustomerSelect}>
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs mt-1">
                      <SelectValue placeholder="-- Select or enter new --" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.fullName} ({c.idNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-slate-300">Seller Full Name *</Label>
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs text-slate-300">Driver License / Photo ID #</Label>
                  <Input
                    value={customerIdNumber}
                    onChange={(e) => setCustomerIdNumber(e.target.value)}
                    placeholder="e.g. DL-98210-GA"
                    className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs text-slate-300">Tow / Transport License Plate</Label>
                  <Input
                    value={vehicleLicensePlate}
                    onChange={(e) => setVehicleLicensePlate(e.target.value)}
                    placeholder="e.g. GA 7ABC89"
                    className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Vehicle Specs & VIN Title Checklist */}
          <Card className="bg-slate-900 border-slate-800 text-white shadow-lg">
            <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300 flex items-center gap-2">
                <Car className="w-4 h-4 text-amber-400" /> Vehicle Identification & Title Record
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              
              {/* VIN Entry with decoder button */}
              <div className="space-y-1">
                <Label className="text-xs text-slate-300">17-Digit Vehicle Identification Number (VIN) *</Label>
                <div className="flex gap-2">
                  <Input
                    value={vin}
                    onChange={(e) => setVin(e.target.value.toUpperCase())}
                    placeholder="e.g. 1G1JC524317109281"
                    className="bg-slate-950 border-slate-800 text-amber-300 font-mono tracking-wider font-bold text-sm uppercase flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDecodeVin}
                    className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200 text-xs shrink-0"
                  >
                    <Search className="w-3.5 h-3.5 mr-1 text-amber-400" /> Auto Decode VIN
                  </Button>
                </div>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="text-[11px] text-slate-400">Year</Label>
                  <Input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value) || 2010)}
                    className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-[11px] text-slate-400">Make</Label>
                  <Input
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-[11px] text-slate-400">Model</Label>
                  <Input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-[11px] text-slate-400">Color</Label>
                  <Input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                  />
                </div>
              </div>

              {/* Title Ownership Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                <div>
                  <Label className="text-xs text-slate-300">Title / Ownership Document Status</Label>
                  <Select
                    value={titleStatus}
                    onValueChange={(val) => setTitleStatus(val as CarIntakeRecord['titleStatus'])}
                  >
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                      <SelectItem value="Clean Title">Clean Title (Verified)</SelectItem>
                      <SelectItem value="Salvage Title">Salvage Title</SelectItem>
                      <SelectItem value="Bill of Sale">Bill of Sale</SelectItem>
                      <SelectItem value="Missing Title (Affidavit)">Missing Title (State Affidavit)</SelectItem>
                      <SelectItem value="Junk / Scrap Certificate">Junk / Scrap Certificate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-slate-300">Title Certificate #</Label>
                  <Input
                    value={titleNumber}
                    onChange={(e) => setTitleNumber(e.target.value)}
                    placeholder="e.g. GA-TL-99120"
                    className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                  />
                </div>
              </div>

              {/* Vehicle Checklist & Components */}
              <div className="pt-3 border-t border-slate-800/80 space-y-3">
                <Label className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                  Component Checklist & Environmental Compliance
                </Label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  
                  {/* Catalytic Converter */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-200">Catalytic Converter</span>
                      <Switch
                        checked={hasCatalyticConverter}
                        onCheckedChange={setHasCatalyticConverter}
                      />
                    </div>
                    {hasCatalyticConverter && (
                      <Select
                        value={catCondition}
                        onValueChange={(v) => setCatCondition(v as CarIntakeRecord['catCondition'])}
                      >
                        <SelectTrigger className="h-7 bg-slate-900 border-slate-800 text-xs text-amber-300">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                          <SelectItem value="Original OEM">Original OEM (+$80 Bonus)</SelectItem>
                          <SelectItem value="Aftermarket">Aftermarket (+$30 Bonus)</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Engine & Transmission */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-200 block">Engine & Transmission</span>
                      <span className="text-[10px] text-slate-400">Intact driveline (+$50)</span>
                    </div>
                    <Switch
                      checked={hasEngineAndTrans}
                      onCheckedChange={setHasEngineAndTrans}
                    />
                  </div>

                  {/* Battery */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-200 block">12V Battery Included</span>
                      <span className="text-[10px] text-slate-400">Wet lead battery (+$15)</span>
                    </div>
                    <Switch
                      checked={hasBattery}
                      onCheckedChange={setHasBattery}
                    />
                  </div>

                  {/* Fluids Drained */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-200 block">Fluids Drained</span>
                      <span className="text-[10px] text-slate-400">EPA compliance requirement</span>
                    </div>
                    <Switch
                      checked={fluidsDrained}
                      onCheckedChange={setFluidsDrained}
                    />
                  </div>

                </div>
              </div>

            </CardContent>
          </Card>

        </div>

        {/* Right Column: Scale Weight & Payout Summary */}
        <div className="space-y-6">
          
          {/* Live Scale Monitor Gauge */}
          <LiveScaleGauge onHoldWeight={handleHoldWeightFromScale} compact />

          {/* Vehicle Weight & Rates Card */}
          <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
            <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800">
              <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" /> Payout Calculation
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              
              {/* Category Preset */}
              <div>
                <Label className="text-xs text-slate-300">Vehicle Category Rate</Label>
                <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                    {carRates.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.categoryName} (${r.ratePerTon}/ton)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Pricing Mode Toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                <Button
                  type="button"
                  variant={pricingMode === 'TONNAGE' ? 'default' : 'ghost'}
                  onClick={() => setPricingMode('TONNAGE')}
                  className={`h-8 font-semibold text-xs ${
                    pricingMode === 'TONNAGE' ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'text-slate-400'
                  }`}
                >
                  Tonnage Weight
                </Button>
                <Button
                  type="button"
                  variant={pricingMode === 'FLAT_RATE' ? 'default' : 'ghost'}
                  onClick={() => setPricingMode('FLAT_RATE')}
                  className={`h-8 font-semibold text-xs ${
                    pricingMode === 'FLAT_RATE' ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'text-slate-400'
                  }`}
                >
                  Flat Car Rate
                </Button>
              </div>

              {/* Weight / Rate inputs */}
              {pricingMode === 'TONNAGE' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-slate-400">Scale Weight (LBS)</Label>
                    <Input
                      type="number"
                      value={vehicleWeightLbs}
                      onChange={(e) => setVehicleWeightLbs(parseFloat(e.target.value) || 0)}
                      className="bg-slate-950 border-slate-800 text-amber-300 font-mono font-bold text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-400">Rate ($ / Ton)</Label>
                    <Input
                      type="number"
                      value={ratePerTon}
                      onChange={(e) => setRatePerTon(parseFloat(e.target.value) || 0)}
                      className="bg-slate-950 border-slate-800 text-emerald-400 font-mono font-bold text-xs mt-1"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <Label className="text-[11px] text-slate-400">Agreed Flat Vehicle Rate ($)</Label>
                  <Input
                    type="number"
                    value={flatRate}
                    onChange={(e) => setFlatRate(parseFloat(e.target.value) || 0)}
                    className="bg-slate-950 border-slate-800 text-amber-300 font-mono font-bold text-sm mt-1"
                  />
                </div>
              )}

              {/* Deductions input */}
              <div>
                <Label className="text-[11px] text-slate-400">Deductions / Missing Parts ($)</Label>
                <Input
                  type="number"
                  value={manualDeductions}
                  onChange={(e) => setManualDeductions(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="bg-slate-950 border-slate-800 text-red-400 font-mono text-xs mt-1"
                />
              </div>

              {/* Itemized Payout Breakdown Box */}
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5 font-mono text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Base {pricingMode === 'TONNAGE' ? `(${weightTons.toFixed(2)} tons)` : 'Flat'}:</span>
                  <span>${pricingMode === 'TONNAGE' ? baseTonnagePayout.toFixed(2) : flatRate.toFixed(2)}</span>
                </div>
                {catBonus > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>Cat Converter Bonus:</span>
                    <span>+${catBonus.toFixed(2)}</span>
                  </div>
                )}
                {engineBonus > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>Engine & Trans Bonus:</span>
                    <span>+${engineBonus.toFixed(2)}</span>
                  </div>
                )}
                {batteryBonus > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>12V Battery Bonus:</span>
                    <span>+${batteryBonus.toFixed(2)}</span>
                  </div>
                )}
                {manualDeductions > 0 && (
                  <div className="flex justify-between text-red-400">
                    <span>Deductions:</span>
                    <span>-${manualDeductions.toFixed(2)}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline text-white">
                  <span className="font-sans font-bold text-sm text-amber-400">TOTAL PAYOUT:</span>
                  <span className="text-2xl font-black text-emerald-400 font-mono">
                    ${finalPayout.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Payout Method */}
              <div>
                <Label className="text-xs text-slate-300">Payout Method</Label>
                <Select value={payoutMethod} onValueChange={(v) => setPayoutMethod(v as any)}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                    <SelectItem value="Cash">Cash Payout Voucher</SelectItem>
                    <SelectItem value="Check">Check Issue</SelectItem>
                    <SelectItem value="ACH Direct Transfer">ACH Direct Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Complete Ticket Action */}
              <Button
                onClick={handleSubmitTicket}
                className="w-full h-11 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold shadow-lg shadow-amber-950 text-sm tracking-wide"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" /> Complete Ticket & Issue Voucher
              </Button>

            </CardContent>
          </Card>

        </div>

      </div>

      {/* Compliance Studio Modal */}
      <ComplianceCaptureModal
        isOpen={isComplianceModalOpen}
        onClose={() => setIsComplianceModalOpen(false)}
        initialCaptures={complianceCaptures}
        onSaveCaptures={handleApplyComplianceCaptures}
        intakeType="CAR_SALVAGE"
      />
    </div>
  );
};
