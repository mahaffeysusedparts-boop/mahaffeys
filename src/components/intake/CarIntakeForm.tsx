import React, { useState } from 'react';
import { CarIntakeRecord, Ticket } from '@/types/scrap';
import { storageService } from '@/services/storageService';
import { generateSamplePhoto } from '@/utils/complianceUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Car,
  CheckCircle2,
  Search,
  DollarSign,
  ArrowLeft,
  Camera,
  MapPin,
  FileText,
  Upload,
  Clock,
  Truck,
} from 'lucide-react';
import { toast } from 'sonner';

interface CarIntakeFormProps {
  onBack: () => void;
  onTicketCreated: (ticket: Ticket) => void;
}

export const CarIntakeForm: React.FC<CarIntakeFormProps> = ({ onBack, onTicketCreated }) => {
  // Vehicle Picture Capture State
  const [photoUrl, setPhotoUrl] = useState<string>(generateSamplePhoto('vehicle'));
  
  // Vehicle Details
  const [vin, setVin] = useState<string>('');
  const [year, setYear] = useState<number>(new Date().getFullYear() - 12);
  const [make, setMake] = useState<string>('Ford');
  const [model, setModel] = useState<string>('F-150');
  const [color, setColor] = useState<string>('White');
  const [mileage, setMileage] = useState<number>(150000);
  
  const [titleStatus, setTitleStatus] = useState<CarIntakeRecord['titleStatus']>('Salvage Title');
  const [titleNumber, setTitleNumber] = useState<string>('');

  // Financial & Origin Logging
  const [purchasePrice, setPurchasePrice] = useState<number>(450);
  const [originSource, setOriginSource] = useState<string>('Tow Origin / Address / Shop Name');

  // Tow Driver Notes Section
  const [notes, setNotes] = useState<string>('');

  // Row Staging (Optional)
  const [assignedRow, setAssignedRow] = useState<string>('Row 104');
  const [assignedSpace, setAssignedSpace] = useState<string>('Space 15');

  // Component Checklist
  const [hasCatalyticConverter, setHasCatalyticConverter] = useState<boolean>(true);
  const [catCondition, setCatCondition] = useState<CarIntakeRecord['catCondition']>('Original OEM');
  const [hasEngineAndTrans, setHasEngineAndTrans] = useState<boolean>(true);
  const [hasBattery, setHasBattery] = useState<boolean>(true);
  const [hasAluminumRims, setHasAluminumRims] = useState<boolean>(true);
  const [fluidsDrained, setFluidsDrained] = useState<boolean>(false);

  const [payoutMethod, setPayoutMethod] = useState<'Cash' | 'Check' | 'ACH Direct Transfer'>('Cash');

  // Handle local image file upload for vehicle photo
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotoUrl(event.target.result as string);
          toast.success('Vehicle photo captured successfully');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Quick Camera Snapshot simulation / canvas render
  const handleTakeSnapshot = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 640, 480);
      
      // Draw gridlines
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 40, 560, 400);

      // Draw car body outline
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(120, 200, 400, 140);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(180, 120, 280, 90);

      // Draw wheels
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(200, 340, 40, 0, Math.PI * 2);
      ctx.arc(440, 340, 40, 0, Math.PI * 2);
      ctx.fill();

      // Timestamp watermark
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(`TOW SNAPSHOT: ${new Date().toLocaleString()}`, 60, 80);
      ctx.fillText(`VIN: ${vin || 'PENDING'}`, 60, 105);

      const snapUrl = canvas.toDataURL('image/jpeg');
      setPhotoUrl(snapUrl);
      toast.success('Snapshot captured from intake camera');
    }
  };

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

  const handleSubmitTicket = () => {
    if (!vin.trim()) {
      toast.error('Please enter the vehicle VIN number');
      return;
    }
    if (purchasePrice < 0 || isNaN(purchasePrice)) {
      toast.error('Please enter a valid Purchase Price ($)');
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
      assignedRow: assignedRow.trim() || 'Pending Row',
      assignedSpace: assignedSpace.trim() || 'Space 01',
      yardStatus: 'PENDING',
      hasCatalyticConverter,
      catCondition,
      hasEngineAndTrans,
      hasBattery,
      hasAluminumRims,
      fluidsDrained,
      pricingMode: 'FLAT_RATE',
      vehicleWeightLbs: 3500,
      ratePerTon: 0,
      flatRate: purchasePrice,
      catBonus: 0,
      engineBonus: 0,
      batteryBonus: 0,
      deductions: 0,
      totalPayout: Math.round(purchasePrice * 100) / 100,
      purchasePrice: Math.round(purchasePrice * 100) / 100,
      originSource: originSource.trim() || 'Tow Origin',
      notes: notes.trim() || undefined,
      photoUrl,
    };

    const newTicket: Ticket = {
      id: `T-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      ticketType: 'CAR_SALVAGE',
      createdAt: new Date().toISOString(),
      status: 'COMPLETED',
      customerName: originSource.trim() ? `Tow Origin: ${originSource}` : 'Tow Intake',
      vehicleLicensePlate: '',
      carRecord,
      complianceCaptures: {
        vehiclePhotoUrl: photoUrl,
      },
      grossTotal: purchasePrice,
      totalDeductions: 0,
      finalPayout: Math.round(purchasePrice * 100) / 100,
      payoutMethod,
      operatorName: currentOp,
      notes,
    };

    storageService.saveTicket(newTicket);
    toast.success(`Tow Intake Complete! Ticket #${newTicket.id} created as PENDING state.`);
    onTicketCreated(newTicket);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 font-sans">
      
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl">
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
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-400" /> Fast Tow Driver Vehicle Intake
              </h1>
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-mono">
                AUTO-PENDING STAGING
              </Badge>
            </div>
            <p className="text-xs text-slate-400">
              Streamlined tow drop intake: photo, purchase price, tow origin & driver notes. No driver license scan required.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-sky-500/40 text-sky-400 text-xs font-mono gap-1">
            <Clock className="w-3.5 h-3.5" /> FAST INTAKE MODE
          </Badge>
        </div>
      </div>

      {/* Main Intake Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Photo, Specs, Financial & Notes */}
        <div className="lg:col-span-2 space-y-6">

          {/* 1. VEHICLE PICTURE CAPTURE */}
          <Card className="bg-slate-900 border-amber-500/40 text-white shadow-xl overflow-hidden">
            <CardHeader className="py-3 px-4 bg-gradient-to-r from-amber-950/80 to-slate-950 border-b border-amber-500/30 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold tracking-wide uppercase text-amber-300 flex items-center gap-2">
                <Camera className="w-4 h-4 text-amber-400" /> Vehicle Picture Capture (Upload or Snapshot)
              </CardTitle>
              <Badge variant="outline" className="border-amber-500/40 text-amber-300 text-[10px]">
                REQUIRED FOR INTAKE
              </Badge>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                
                {/* Photo Preview Thumbnail */}
                <div className="sm:col-span-1">
                  <div className="aspect-video bg-slate-950 rounded-xl border-2 border-slate-800 overflow-hidden relative group shadow-inner flex items-center justify-center">
                    {photoUrl ? (
                      <img src={photoUrl} alt="Vehicle intake preview" className="w-full h-full object-cover" />
                    ) : (
                      <Car className="w-10 h-10 text-slate-600" />
                    )}
                    <div className="absolute top-2 right-2 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 border border-emerald-500/40">
                      CAPTURED
                    </div>
                  </div>
                </div>

                {/* Upload & Snapshot Action Buttons */}
                <div className="sm:col-span-2 space-y-3">
                  <p className="text-xs text-slate-300">
                    Capture a clear 45-degree front angle image of the vehicle being delivered by the tow truck.
                  </p>
                  
                  <div className="flex flex-wrap gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-lg transition-colors shadow">
                      <Upload className="w-4 h-4" /> Upload Photo File
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>

                    <Button
                      type="button"
                      onClick={handleTakeSnapshot}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold gap-1.5"
                    >
                      <Camera className="w-4 h-4 text-amber-400" /> Take Snapshot
                    </Button>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>

          {/* 2. VEHICLE DETAILS & VIN DECODER */}
          <Card className="bg-slate-900 border-slate-800 text-white shadow-lg">
            <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300 flex items-center gap-2">
                <Car className="w-4 h-4 text-amber-400" /> Vehicle Identification Specs
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              
              <div className="space-y-1">
                <Label className="text-xs text-slate-300">17-Digit VIN Number *</Label>
                <div className="flex gap-2">
                  <Input
                    value={vin}
                    onChange={(e) => setVin(e.target.value.toUpperCase())}
                    placeholder="e.g. 1FTRF12W88KA10291"
                    className="bg-slate-950 border-slate-800 text-amber-300 font-mono tracking-wider font-bold text-sm uppercase flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDecodeVin}
                    className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200 text-xs shrink-0 gap-1"
                  >
                    <Search className="w-3.5 h-3.5 text-amber-400" /> Decode VIN
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="text-[11px] text-slate-400">Year</Label>
                  <Input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value) || 2010)}
                    className="bg-slate-950 border-slate-800 text-white text-xs mt-1 font-mono"
                  />
                </div>

                <div>
                  <Label className="text-[11px] text-slate-400">Make</Label>
                  <Input
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    placeholder="Ford"
                    className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-[11px] text-slate-400">Model</Label>
                  <Input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="F-150"
                    className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-[11px] text-slate-400">Color</Label>
                  <Input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="White"
                    className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                <div>
                  <Label className="text-xs text-slate-300">Title / Document Status</Label>
                  <Select
                    value={titleStatus}
                    onValueChange={(val) => setTitleStatus(val as CarIntakeRecord['titleStatus'])}
                  >
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                      <SelectItem value="Salvage Title">Salvage Title</SelectItem>
                      <SelectItem value="Clean Title">Clean Title</SelectItem>
                      <SelectItem value="Bill of Sale">Bill of Sale</SelectItem>
                      <SelectItem value="Missing Title (Affidavit)">Missing Title Affidavit</SelectItem>
                      <SelectItem value="Junk / Scrap Certificate">Junk / Scrap Certificate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-slate-300">Title / Document Number (Optional)</Label>
                  <Input
                    value={titleNumber}
                    onChange={(e) => setTitleNumber(e.target.value)}
                    placeholder="e.g. GA-TL-9012"
                    className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                  />
                </div>
              </div>

            </CardContent>
          </Card>

          {/* 3. FINANCIAL & ORIGIN LOGGING */}
          <Card className="bg-slate-900 border-slate-800 text-white shadow-lg">
            <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800">
              <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" /> Financial & Tow Source Origin Logging
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-emerald-400 font-bold block mb-1">
                    Payout / Purchase Price ($) *
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-500 font-bold">$</span>
                    <Input
                      type="number"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="bg-slate-950 border-slate-800 text-emerald-400 font-mono font-bold text-base pl-7"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Amount paid to acquire vehicle
                  </span>
                </div>

                <div>
                  <Label className="text-xs text-slate-300 font-bold block mb-1">
                    Vehicle Origin / Tow Source *
                  </Label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3 top-3 text-amber-400" />
                    <Input
                      value={originSource}
                      onChange={(e) => setOriginSource(e.target.value)}
                      placeholder="e.g. 1428 Industrial Pkwy / Vance Repair Shop"
                      className="bg-slate-950 border-slate-800 text-white text-xs pl-9"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Where the vehicle was picked up from
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4. TOW DRIVER NOTES SECTION */}
          <Card className="bg-slate-900 border-slate-800 text-white shadow-lg">
            <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800">
              <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" /> Tow Driver Notes Section
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 space-y-2">
              <Label className="text-xs text-slate-300">
                Tow Driver Notes (Condition, Key Status, Missing Parts, Special Instructions)
              </Label>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Key in ignition, front bumper smashed, catalytic converter intact, flat right tire..."
                className="bg-slate-950 border-slate-800 text-slate-200 text-xs"
              />
            </CardContent>
          </Card>

        </div>

        {/* Right Column: Row Staging, Checklist & Auto-Pending Submit */}
        <div className="space-y-6">
          
          {/* YARD ROW STAGING */}
          <Card className="bg-slate-900 border-amber-500/30 text-white shadow-xl">
            <CardHeader className="py-3 px-4 bg-amber-950/30 border-b border-amber-500/30">
              <CardTitle className="text-sm font-bold tracking-wide uppercase text-amber-300 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-400" /> Yard Row Staging (Optional)
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              <div>
                <Label className="text-xs text-amber-300">Staging Row</Label>
                <Input
                  value={assignedRow}
                  onChange={(e) => setAssignedRow(e.target.value)}
                  placeholder="Row 104"
                  className="bg-slate-950 border-amber-500/40 text-amber-300 font-mono font-bold text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-amber-300">Space Number</Label>
                <Input
                  value={assignedSpace}
                  onChange={(e) => setAssignedSpace(e.target.value)}
                  placeholder="Space 15"
                  className="bg-slate-950 border-amber-500/40 text-amber-300 font-mono font-bold text-xs mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* QUICK COMPONENT CHECKLIST */}
          <Card className="bg-slate-900 border-slate-800 text-white shadow-lg">
            <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800">
              <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300">
                Quick Component Checklist
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-200 font-medium">Catalytic Converter</span>
                <Switch
                  checked={hasCatalyticConverter}
                  onCheckedChange={setHasCatalyticConverter}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-200 font-medium">Engine & Transmission</span>
                <Switch
                  checked={hasEngineAndTrans}
                  onCheckedChange={setHasEngineAndTrans}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-200 font-medium">12V Battery</span>
                <Switch
                  checked={hasBattery}
                  onCheckedChange={setHasBattery}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-200 font-medium">Fluids Drained</span>
                <Switch
                  checked={fluidsDrained}
                  onCheckedChange={setFluidsDrained}
                />
              </div>
            </CardContent>
          </Card>

          {/* SUBMIT AS PENDING */}
          <Card className="bg-gradient-to-b from-slate-900 to-amber-950/40 border-amber-500/50 text-white shadow-2xl">
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1">
                <span className="text-xs font-mono text-amber-400 font-bold uppercase tracking-wider block">
                  INTAKE SUMMARY
                </span>
                <div className="flex justify-between items-baseline pt-1">
                  <span className="text-sm text-slate-300 font-medium">Purchase Payout:</span>
                  <span className="text-3xl font-black text-emerald-400 font-mono">
                    ${purchasePrice.toFixed(2)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Status will automatically save as <span className="text-amber-300 font-bold">PENDING</span> until parts processor inspection.
                </p>
              </div>

              <Button
                onClick={handleSubmitTicket}
                className="w-full h-12 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black shadow-xl shadow-amber-950 text-sm tracking-wide"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" /> Complete Tow Intake (Save as PENDING)
              </Button>
            </CardContent>
          </Card>

        </div>

      </div>
    </div>
  );
};