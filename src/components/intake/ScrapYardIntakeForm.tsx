import React, { useState } from 'react';
import { Customer, MetalGrade, ScrapTicketLine, Ticket, WeightUnit, ComplianceCaptures } from '@/types/scrap';
import { storageService } from '@/services/storageService';
import { LiveScaleGauge } from '../scale/LiveScaleGauge';
import { ComplianceCaptureModal } from '../compliance/ComplianceCaptureModal';
import { calculateComplianceScore, generateSamplePhoto, DLScanResult } from '@/utils/complianceUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Scale,
  Plus,
  Trash2,
  User,
  DollarSign,
  ArrowLeft,
  Truck,
  CheckCircle2,
  Camera,
  CreditCard,
  Scan,
  Package,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';

interface ScrapYardIntakeFormProps {
  onBack: () => void;
  onTicketCreated: (ticket: Ticket) => void;
}

export const ScrapYardIntakeForm: React.FC<ScrapYardIntakeFormProps> = ({ onBack, onTicketCreated }) => {
  const [metals] = useState<MetalGrade[]>(storageService.getMetals());
  const [customers] = useState<Customer[]>(storageService.getCustomers());

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerIdNumber, setCustomerIdNumber] = useState<string>('');
  const [vehicleLicensePlate, setVehicleLicensePlate] = useState<string>('');

  const [complianceCaptures, setComplianceCaptures] = useState<ComplianceCaptures>({
    personPhotoUrl: generateSamplePhoto('person'),
    idPhotoUrl: generateSamplePhoto('id'),
    vehiclePhotoUrl: generateSamplePhoto('vehicle'),
    licensePlatePhotoUrl: generateSamplePhoto('plate'),
    loadPhotoUrl: generateSamplePhoto('load'),
  });
  const [isComplianceModalOpen, setIsComplianceModalOpen] = useState(false);

  const [lines, setLines] = useState<ScrapTicketLine[]>([]);

  const [selectedMetalId, setSelectedMetalId] = useState<string>(metals[0]?.id || '');
  const [grossWeight, setGrossWeight] = useState<number>(120);
  const [tareWeight, setTareWeight] = useState<number>(0);
  const [deductionPercent, setDeductionPercent] = useState<number>(0);

  const [weighingMode, setWeighingMode] = useState<'SINGLE_ITEM' | 'VEHICLE_DOUBLE'>('SINGLE_ITEM');
  const [vehicleGrossIn, setVehicleGrossIn] = useState<number>(0);
  const [vehicleTareOut, setVehicleTareOut] = useState<number>(0);

  const [payoutMethod, setPayoutMethod] = useState<'Cash' | 'Check' | 'ACH Direct Transfer'>('Cash');
  const [notes] = useState<string>('');

  const complianceStats = calculateComplianceScore(complianceCaptures);

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

  const handleSubmitTicket = () => {
    if (lines.length === 0) {
      toast.error('Add at least one scrap line item to complete ticket');
      return;
    }
    if (!customerName.trim()) {
      toast.error('Please enter customer name for state compliance record');
      return;
    }

    const currentOp = storageService.getSettings().operatorName;

    const newTicket: Ticket = {
      id: `T-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
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
      operatorName: currentOp,
      notes,
    };

    storageService.saveTicket(newTicket);
    toast.success(`Scrap Ticket #${newTicket.id} Saved with Compliance Photos!`);
    onTicketCreated(newTicket);
  };

  const popularMetals = metals.filter((m) => m.isPopular).slice(0, 6);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 sm:pb-12">
      
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
                Scrap Yard Metal Recycling Desk
              </h1>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs">
                SCALE DESK
              </Badge>
            </div>
            <p className="text-xs text-slate-400">
              Live scale weighing, metal classification, ID photo capture & cash vouchers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-xs font-mono">
            {lines.length} Line Items | {totalBillableWeight.toLocaleString()} LBS
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 space-y-6">

          {/* LEGAL COMPLIANCE & PHOTO CAPTURE STUDIO */}
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
                  <Camera className="w-4 h-4" /> Launch iPad Camera Studio & ID Scan
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-900 border-slate-800 text-white shadow-lg">
            <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300 flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-400" /> Customer / Seller Profile
              </CardTitle>
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
                    className="bg-slate-950 border-slate-800 text-white text-xs mt-1 h-11"
                  />
                </div>

                <div>
                  <Label className="text-xs text-slate-300">Driver License / ID #</Label>
                  <Input
                    value={customerIdNumber}
                    onChange={(e) => setCustomerIdNumber(e.target.value)}
                    placeholder="e.g. DL-4481029-GA"
                    className="bg-slate-950 border-slate-800 text-white text-xs mt-1 h-11"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-white shadow-lg">
            <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300 flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-400" /> Live Scale Item Entry
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
                <Label className="text-xs text-slate-400 font-semibold block">Quick Select Popular Metals (1-Tap):</Label>
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

        <div className="space-y-6">
          <LiveScaleGauge onHoldWeight={handleHoldWeightFromScale} compact />

          <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
            <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800">
              <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" /> Ticket Cash Payout
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between text-xs text-slate-400 font-mono">
                  <span>Total Billable Weight:</span>
                  <span className="text-white font-bold">{totalBillableWeight.toLocaleString()} LBS</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400 font-mono">
                  <span>Total Line Items:</span>
                  <span className="text-white font-bold">{lines.length}</span>
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-between items-baseline">
                  <span className="font-bold text-sm text-slate-200">TOTAL CASH PAYOUT:</span>
                  <span className="text-3xl font-black text-emerald-400 font-mono">
                    ${totalPayout.toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <Label className="text-xs text-slate-300">Payout Method</Label>
                <Select value={payoutMethod} onValueChange={(v) => setPayoutMethod(v as any)}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs mt-1 h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                    <SelectItem value="Cash">Cash Payout Voucher</SelectItem>
                    <SelectItem value="Check">Check Issue</SelectItem>
                    <SelectItem value="ACH Direct Transfer">ACH Direct Transfer</SelectItem>
                  </SelectContent>
                </Select>
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

      {/* Sticky Bottom Bar for iPad */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 border-t border-slate-800 p-3 shadow-2xl z-30 sm:hidden flex items-center justify-between backdrop-blur">
        <div>
          <span className="text-[10px] text-slate-400 block font-mono">BILLABLE TOTAL:</span>
          <span className="text-xl font-black text-emerald-400 font-mono">${totalPayout.toFixed(2)}</span>
        </div>
        <Button
          onClick={handleSubmitTicket}
          disabled={lines.length === 0}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs h-11 px-5"
        >
          <CheckCircle2 className="w-4 h-4 mr-1.5" /> Issue Voucher (${totalPayout.toFixed(0)})
        </Button>
      </div>

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