import React, { useState, useRef } from 'react';
import { CarIntakeRecord, Ticket } from '@/types/scrap';
import { storageService } from '@/services/storageService';
import { analyzeDriverLicenseImage, analyzeLicensePlateImage } from '@/services/aiVisionService';
import { LprCapture, type LprCaptureResult } from '@/components/intake/LprCapture';
import { PhotoIntakeCard } from '@/components/photo-intake/PhotoIntakeCard';
import { uploadDataUrl } from '@/services/mediaService';

import { decodeVin, VinDecodeResult } from '@/services/vinService';
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
  FileCheck,
  Video,
  Hash,
  RefreshCw,
  Sparkles,
  CreditCard,
  User,
  Wand2,
  Ban,
} from 'lucide-react';
import { toast } from 'sonner';

interface CarIntakeFormProps {
  onBack: () => void;
}

const compressVehiclePhoto = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Unable to read the selected photo'));
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => reject(new Error('Unable to process the selected photo'));
    image.onload = () => {
      const maxDimension = 1280;
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Photo compression is unavailable'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.76));
    };
    image.src = reader.result as string;
  };
  reader.readAsDataURL(file);
});

export const CarIntakeForm: React.FC<CarIntakeFormProps> = ({ onBack }) => {
  // Vehicle Picture Capture State
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  
  // References for device camera / file capture
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dlInputRef = useRef<HTMLInputElement>(null);

  // Editable Receipt / Ticket Number
  const [customReceiptNumber, setCustomReceiptNumber] = useState<string>(
    `T-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  );

  // Seller Details (AI Auto-Filled)
  const [sellerName, setSellerName] = useState<string>('');
  const [sellerIdNumber, setSellerIdNumber] = useState<string>('');
  const [sellerPhone, setSellerPhone] = useState<string>('');
  const [sellerAddress, setSellerAddress] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isDlScanned, setIsDlScanned] = useState<boolean>(false);
  const [isLprOpen, setIsLprOpen] = useState(false);
  const [licensePlate, setLicensePlate] = useState('');
  const [licensePlatePhotoUrl, setLicensePlatePhotoUrl] = useState('');

  // Vehicle Details
  const [vin, setVin] = useState<string>('');

  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [make, setMake] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [trim, setTrim] = useState<string>('');
  const [color, setColor] = useState<string>('');
  const [mileage, setMileage] = useState<number>(0);
  const [engineSizeLiters, setEngineSizeLiters] = useState<string>('');
  const [engineCylinders, setEngineCylinders] = useState<string>('');
  const [engineModel, setEngineModel] = useState<string>('');
  const [fuelType, setFuelType] = useState<string>('');
  const [decodedVehicle, setDecodedVehicle] = useState<VinDecodeResult | null>(null);
  const [isDecodingVin, setIsDecodingVin] = useState(false);
  const [confirmedVisionScanIds, setConfirmedVisionScanIds] = useState<string[]>([]);
  
  const [titleStatus, setTitleStatus] = useState<CarIntakeRecord['titleStatus']>('Salvage Title');
  const [titleNumber, setTitleNumber] = useState<string>('');

  // Financial & Origin Logging
  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [originSource, setOriginSource] = useState<string>('');

  // Tow Driver Notes Section
  const [notes, setNotes] = useState<string>('');

  // Component Checklist
  const [hasCatalyticConverter, setHasCatalyticConverter] = useState<boolean>(true);
  const [catCondition, setCatCondition] = useState<CarIntakeRecord['catCondition']>('Original OEM');
  const [hasEngineAndTrans, setHasEngineAndTrans] = useState<boolean>(true);
  const [hasBattery, setHasBattery] = useState<boolean>(true);
  const [hasAluminumRims, setHasAluminumRims] = useState<boolean>(true);
  const [fluidsDrained, setFluidsDrained] = useState<boolean>(false);

  const [payoutMethod, setPayoutMethod] = useState<'Cash' | 'Check' | 'ACH Direct Transfer'>('Cash');
  const [checkNumber, setCheckNumber] = useState<string>('CHK-' + Math.floor(1000 + Math.random() * 9000));

  const handleAutoGenerateReceiptNumber = () => {
    const newNum = `T-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    setCustomReceiptNumber(newNum);
    toast.info(`Generated Receipt #${newNum}`);
  };

  // AI Driver License OCR Scanner for Vehicle Intake
  const handleDlPictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.info("AI Vision analyzing Driver's License photo...", { icon: "✨" });
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        try {
          const result = await analyzeDriverLicenseImage(dataUrl);
          if (result.fullName) setSellerName(result.fullName);
          if (result.idNumber) setSellerIdNumber(result.idNumber);
          setIsDlScanned(true);
          toast.success("AI OCR Extracted Seller Name & DL Number!", {
            description: `Seller: ${result.fullName} | ID: ${result.idNumber}`,
          });
        } catch (err) {
          console.warn("AI OCR Error:", err);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle local image file upload for vehicle photo
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await compressVehiclePhoto(file);
      const url = await uploadDataUrl(dataUrl, file.name);
      setPhotoUrl(url);
      toast.success('Vehicle photo saved to the server');
      try {
        const plateRes = await analyzeLicensePlateImage(dataUrl);
        if (plateRes.plateNumber && !plateRes.plateNumber.startsWith("TAG-")) {
          setLicensePlate(plateRes.plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, ''));
          toast.info(`AI Vision detected Tag: ${plateRes.plateNumber}`);
        }
      } catch (err) {
        console.warn("Plate OCR error:", err);
      }

    } catch (error) {
      toast.error('Could not save vehicle photo', {
        description: error instanceof Error ? error.message : 'Choose a different image and try again.',
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleSkipVin = () => {
    const noVinTag = `NO-VIN-${Math.floor(1000 + Math.random() * 9000)}`;
    setVin(noVinTag);
    setDecodedVehicle(null);
    toast.info(`Skipped VIN. Assigned: ${noVinTag}`);
  };

  const handleDecodeVinWithVin = async (vinString: string) => {
    const clean = vinString.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(clean)) {
      toast.error('Enter a complete 17-character VIN without I, O, or Q');
      return;
    }

    setVin(clean);
    setIsDecodingVin(true);
    try {
      const result = await decodeVin(clean);
      setDecodedVehicle(result);
      if (result.year) setYear(result.year);
      if (result.make) setMake(result.make);
      if (result.model) setModel(result.model);
      setTrim(result.trim || result.series || '');
      setEngineSizeLiters(result.engineSizeLiters?.toString() || '');
      setEngineCylinders(result.engineCylinders?.toString() || '');
      setEngineModel(result.engineModel || '');
      setFuelType(result.fuelType || result.electrificationLevel || '');

      const engine = [
        result.engineSizeLiters ? `${result.engineSizeLiters}L` : null,
        result.engineCylinders ? `${result.engineCylinders}-cylinder` : null,
      ].filter(Boolean).join(' ');
      toast.success(`${result.year || ''} ${result.make} ${result.model}`.trim(), {
        description: [result.trim || result.series, engine].filter(Boolean).join(' · ') || 'Vehicle specifications loaded from NHTSA.',
      });
    } catch (error) {
      setDecodedVehicle(null);
      toast.error('VIN could not be decoded', {
        description: error instanceof Error ? error.message : 'Check the VIN and try again.',
      });
    } finally {
      setIsDecodingVin(false);
    }
  };

  const handleDecodeVin = () => {
    void handleDecodeVinWithVin(vin);
  };

  const handleLprComplete = (result: LprCaptureResult) => {
    setLicensePlate(result.plate);
    setLicensePlatePhotoUrl(result.imageUrl);
    setConfirmedVisionScanIds((current) => current.includes(result.scanId) ? current : [...current, result.scanId]);
    if (result.customer) {
      setSelectedCustomerId(result.customer.id);
      setSellerName(result.customer.fullName);
      setSellerIdNumber(result.customer.idNumber);
      setSellerPhone(result.customer.phone);
      setSellerAddress(result.customer.address);
      setIsDlScanned(Boolean(result.customer.idPhotoUrl));
      toast.success(`Returning customer confirmed: ${result.customer.fullName}`, {
        description: `${result.plate} and seller details were added to this intake.`,
      });
    } else {
      setSelectedCustomerId('');
      toast.success(`New plate captured: ${result.plate}`, {
        description: 'No matching customer was found. Complete the remaining seller details.',
      });
    }
    setIsLprOpen(false);
  };

  const handleSubmitTicket = () => {
    if (isSaving) return;

    if (!customReceiptNumber.trim()) {
      toast.error('Please enter a Receipt / Ticket Number');
      return;
    }
    if (purchasePrice < 0 || isNaN(purchasePrice)) {
      toast.error('Please enter a valid Purchase Price ($)');
      return;
    }

    const currentOp = storageService.getSettings().operatorName;
    const finalCustomerName = sellerName.trim() || (originSource.trim() ? `Tow Origin: ${originSource}` : 'Tow Intake');
    const pendingVin = vin.trim() || `PENDING-${customReceiptNumber.trim()}`;

    const carRecord: CarIntakeRecord = {
      vin: pendingVin.toUpperCase(),
      year,
      make,
      model,
      trim: trim.trim() || undefined,
      series: decodedVehicle?.series || undefined,
      color,
      mileage,
      bodyClass: decodedVehicle?.bodyClass || undefined,
      vehicleType: decodedVehicle?.vehicleType || undefined,
      driveType: decodedVehicle?.driveType || undefined,
      doors: decodedVehicle?.doors || undefined,
      engineCylinders: Number.parseInt(engineCylinders, 10) || undefined,
      engineSizeLiters: Number.parseFloat(engineSizeLiters) || undefined,
      engineModel: engineModel.trim() || undefined,
      engineHorsepower: decodedVehicle?.engineHorsepower || undefined,
      fuelType: fuelType.trim() || undefined,
      secondaryFuelType: decodedVehicle?.secondaryFuelType || undefined,
      electrificationLevel: decodedVehicle?.electrificationLevel || undefined,
      transmissionStyle: decodedVehicle?.transmissionStyle || undefined,
      transmissionSpeeds: decodedVehicle?.transmissionSpeeds || undefined,
      manufacturer: decodedVehicle?.manufacturer || undefined,
      plantCountry: decodedVehicle?.plantCountry || undefined,
      plantCity: decodedVehicle?.plantCity || undefined,
      plantState: decodedVehicle?.plantState || undefined,
      vinDecodedAt: decodedVehicle ? new Date().toISOString() : undefined,
      vinDecoderSource: decodedVehicle?.source,
      confirmedVisionScanIds: confirmedVisionScanIds.length ? confirmedVisionScanIds : undefined,
      titleStatus,
      titleNumber,
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
      customerAddress: sellerAddress.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    const newTicket: Ticket = {
      id: customReceiptNumber.trim(),
      ticketType: 'CAR_SALVAGE',
      createdAt: new Date().toISOString(),
      status: 'PENDING',
      customerId: selectedCustomerId || undefined,
      customerName: finalCustomerName,
      customerPhone: sellerPhone.trim() || undefined,
      customerIdNumber: sellerIdNumber.trim() || undefined,
      vehicleLicensePlate: licensePlate.trim() || undefined,
      carRecord,
      complianceCaptures: {
        vehiclePhotoUrl: photoUrl,
        licensePlatePhotoUrl: licensePlatePhotoUrl || undefined,
      },

      grossTotal: purchasePrice,
      totalDeductions: 0,
      finalPayout: Math.round(purchasePrice * 100) / 100,
      payoutMethod,
      checkNumber: payoutMethod === 'Check' ? checkNumber : undefined,
      operatorName: currentOp,
      notes,
    };

    setIsSaving(true);
    try {
      storageService.saveTicket(newTicket);
      toast.success(`Vehicle saved to inventory`, {
        description: `${year} ${make} ${model} added as pending intake.`,
      });

      setVin('');
      setTrim('');
      setSellerName('');
      setSellerIdNumber('');
      setSellerPhone('');
      setSellerAddress('');
      setSelectedCustomerId('');
      setLicensePlate('');
      setLicensePlatePhotoUrl('');
      setIsDlScanned(false);
      setPhotoUrl('');
      setNotes('');

      setTitleNumber('');
      setDecodedVehicle(null);
      setEngineSizeLiters('');
      setEngineCylinders('');
      setEngineModel('');
      setFuelType('');
      setOriginSource('');
      handleAutoGenerateReceiptNumber();
    } catch (error) {
      const storageFull = error instanceof DOMException && error.name === 'QuotaExceededError';
      toast.error('Car intake could not be saved', {
        description: storageFull
          ? 'Browser storage is full. Remove older records or use a smaller vehicle photo, then try again.'
          : error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const decodedDetails = decodedVehicle ? [
    { label: 'Body', value: decodedVehicle.bodyClass },
    { label: 'Vehicle type', value: decodedVehicle.vehicleType },
    { label: 'Drive type', value: decodedVehicle.driveType },
    { label: 'Transmission', value: [decodedVehicle.transmissionStyle, decodedVehicle.transmissionSpeeds ? `${decodedVehicle.transmissionSpeeds}-speed` : null].filter(Boolean).join(' ') || null },
    { label: 'Horsepower', value: decodedVehicle.engineHorsepower ? `${decodedVehicle.engineHorsepower} hp` : null },
    { label: 'Doors', value: decodedVehicle.doors?.toString() || null },
    { label: 'Electrification', value: decodedVehicle.electrificationLevel },
    { label: 'Manufacturer', value: decodedVehicle.manufacturer },
    { label: 'Built in', value: [decodedVehicle.plantCity, decodedVehicle.plantState, decodedVehicle.plantCountry].filter(Boolean).join(', ') || null },
  ].filter((detail): detail is { label: string; value: string } => Boolean(detail.value)) : [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 font-sans">
      {isLprOpen && <LprCapture onCancel={() => setIsLprOpen(false)} onComplete={handleLprComplete} />}

      {/* Device Camera Native Input */}
      <input

        type="file"
        ref={cameraInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      {/* Regular Upload Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Driver's License Input */}
      <input
        type="file"
        ref={dlInputRef}
        onChange={handleDlPictureUpload}
        accept="image/*"
        className="hidden"
      />

      <PhotoIntakeCard onConfirmed={(scan) => {
        setConfirmedVisionScanIds((current) => current.includes(scan.id) ? current : [...current, scan.id]);
        if (scan.result.normalizedVin && scan.result.vinValid) void handleDecodeVinWithVin(scan.result.normalizedVin);
        if (scan.result.plateText) setLicensePlate(scan.result.plateText);
      }} />

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
                SAVES TO PENDING GROUP
              </Badge>
            </div>
            <p className="text-xs text-slate-400">
              Vehicle intake saves directly to the Pending Group for the scale computer operator to review and finalize.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-sky-500/40 text-sky-400 text-xs font-mono gap-1">
            <Clock className="w-3.5 h-3.5" /> FAST INTAKE MODE
          </Badge>
          <Button type="button" onClick={() => setIsLprOpen(true)} className="rounded-xl bg-sky-500 font-black text-slate-950 shadow-lg shadow-sky-500/20 hover:bg-sky-400">
            <Video className="mr-2 h-4 w-4" /> Scan plate
          </Button>
        </div>
      </div>

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
                Set a custom receipt # or use auto-generated voucher number
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={customReceiptNumber}
              onChange={(e) => setCustomReceiptNumber(e.target.value)}
              placeholder="e.g. T-2025-1001"
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

      {/* Main Intake Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Photo, Specs, Financial & Notes */}
        <div className="lg:col-span-2 space-y-6">

          {/* AI SELLER / DL SCAN CARD */}
          <Card className="bg-slate-900 border-blue-500/40 text-white shadow-xl overflow-hidden">
            <CardHeader className="py-3 px-4 bg-gradient-to-r from-blue-950/80 to-slate-950 border-b border-blue-500/30 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold tracking-wide uppercase text-blue-300 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-400" /> Seller Credentials (AI OCR Scan)
              </CardTitle>
              {isDlScanned && (
                <Badge className="bg-emerald-950 text-emerald-300 border-emerald-500/40 text-[10px] font-mono gap-1">
                  <Wand2 className="w-3 h-3 text-emerald-400" /> AI OCR AUTOFILLED
                </Badge>
              )}
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-300 flex items-center justify-between">
                    <span>Seller Full Name</span>
                    {isDlScanned && <span className="text-[10px] text-emerald-400 font-mono">AI AUTOFILLED</span>}
                  </Label>
                  <Input
                    value={sellerName}
                    onChange={(e) => setSellerName(e.target.value)}
                    placeholder="e.g. Marcus Vance"
                    className="bg-slate-950 border-slate-800 text-white text-xs mt-1 h-10 font-bold"
                  />
                </div>

                <div>
                  <Label className="text-xs text-slate-300 flex items-center justify-between">
                    <span>Driver License / State ID #</span>
                    {isDlScanned && <span className="text-[10px] text-emerald-400 font-mono">AI AUTOFILLED</span>}
                  </Label>
                  <Input
                    value={sellerIdNumber}
                    onChange={(e) => setSellerIdNumber(e.target.value)}
                    placeholder="e.g. DL-9823145-GA"
                    className="bg-slate-950 border-slate-800 text-amber-300 font-mono text-xs mt-1 h-10 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs text-slate-300">Phone</Label>
                  <Input value={sellerPhone} onChange={(e) => setSellerPhone(e.target.value)} placeholder="(555) 555-0123" className="mt-1 h-10 bg-slate-950 border-slate-800 text-white text-xs" />
                </div>
                <div>
                  <Label className="flex items-center justify-between text-xs text-slate-300"><span>License Plate</span>{licensePlate && <span className="font-mono text-[10px] text-sky-300">LPR CAPTURED</span>}</Label>
                  <div className="mt-1 flex gap-2"><Input value={licensePlate} onChange={(e) => setLicensePlate(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="ABC1234" className="h-10 bg-slate-950 border-slate-800 text-amber-300 font-mono font-bold uppercase" /><Button type="button" onClick={() => setIsLprOpen(true)} className="h-10 shrink-0 rounded-xl bg-sky-500 px-3 font-bold text-slate-950 hover:bg-sky-400"><Video className="mr-1.5 h-4 w-4" /> LPR</Button></div>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs text-slate-300">Seller Address</Label>
                  <Input value={sellerAddress} onChange={(e) => setSellerAddress(e.target.value)} placeholder="Street, city, state, ZIP" className="mt-1 h-10 bg-slate-950 border-slate-800 text-white text-xs" />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-800">
                <span className="text-[11px] text-slate-400">Scan DL photo with device camera to auto-fill seller fields:</span>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => dlInputRef.current?.click()}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-1.5 shrink-0"
                >
                  <CreditCard className="w-3.5 h-3.5 text-amber-300" /> AI Scan DL Photo
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 1. VEHICLE PICTURE CAPTURE */}
          <Card className="bg-slate-900 border-amber-500/40 text-white shadow-xl overflow-hidden">
            <CardHeader className="py-3 px-4 bg-gradient-to-r from-amber-950/80 to-slate-950 border-b border-amber-500/30 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold tracking-wide uppercase text-amber-300 flex items-center gap-2">
                <Camera className="w-4 h-4 text-amber-400" /> Vehicle Photo Capture
              </CardTitle>
              {photoUrl ? (
                <Badge className="bg-emerald-950 text-emerald-300 border-emerald-500/40 text-[10px]">
                  PHOTO CAPTURED
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/40 text-amber-300 text-[10px]">
                  RECOMMENDED
                </Badge>
              )}
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
                    {photoUrl && (
                      <div className="absolute top-2 right-2 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 border border-emerald-500/40">
                        VERIFIED
                      </div>
                    )}
                  </div>
                </div>

                {/* Camera Action Buttons */}
                <div className="sm:col-span-2 space-y-3">
                  <p className="text-xs text-slate-300">
                    Capture a 45-degree front angle image using your device camera or select a photo file.
                  </p>
                  
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs gap-1.5 shadow"
                    >
                      <Camera className="w-4 h-4" /> Device Camera
                    </Button>

                    <Button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      variant="outline"
                      className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200 text-xs font-semibold gap-1.5"
                    >
                      <Upload className="w-4 h-4 text-amber-400" /> Upload File
                    </Button>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>

          {/* 2. VEHICLE DETAILS & VIN OCR DECODER WITH NO-VIN SKIP */}
          <Card className="bg-slate-900 border-slate-800 text-white shadow-lg">
            <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300 flex items-center gap-2">
                <Car className="w-4 h-4 text-amber-400" /> Vehicle Identification Specs & VIN OCR
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-300 font-bold">17-Digit VIN Number *</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleSkipVin}
                    className="h-7 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 gap-1 font-semibold"
                  >
                    <Ban className="w-3.5 h-3.5" /> Skip / No VIN
                  </Button>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap gap-2">
                  <Input
                    value={vin}
                    maxLength={17}
                    onChange={(e) => {
                      setVin(e.target.value.toUpperCase());
                      setDecodedVehicle(null);
                    }}
                    placeholder="e.g. 1FTRF12W88KA10291"
                    className="bg-slate-950 border-slate-800 text-amber-300 font-mono tracking-wider font-bold text-sm uppercase flex-1"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDecodeVin}
                    disabled={isDecodingVin}
                    className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200 text-xs shrink-0 gap-1"
                  >
                    {isDecodingVin ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" /> : <Search className="w-3.5 h-3.5 text-amber-400" />}
                    {isDecodingVin ? 'Looking up…' : 'Decode'}
                  </Button>
                </div>
                <p className="text-[10px] text-slate-400">
                  Use the Vision Intake Scanner above for a reviewed VIN capture, or tap <strong>"Skip / No VIN"</strong>.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
                  <Label className="text-[11px] text-slate-400">Trim / Series</Label>
                  <Input
                    value={trim}
                    onChange={(e) => setTrim(e.target.value)}
                    placeholder="XLT"
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

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
                <div>
                  <Label className="text-[11px] text-amber-300">Engine size (L)</Label>
                  <Input value={engineSizeLiters} onChange={(e) => setEngineSizeLiters(e.target.value)} placeholder="5.0" className="bg-slate-950 border-slate-800 text-white text-xs mt-1" />
                </div>
                <div>
                  <Label className="text-[11px] text-amber-300">Cylinders</Label>
                  <Input value={engineCylinders} onChange={(e) => setEngineCylinders(e.target.value)} placeholder="8" className="bg-slate-950 border-slate-800 text-white text-xs mt-1" />
                </div>
                <div>
                  <Label className="text-[11px] text-amber-300">Engine model</Label>
                  <Input value={engineModel} onChange={(e) => setEngineModel(e.target.value)} placeholder="Coyote" className="bg-slate-950 border-slate-800 text-white text-xs mt-1" />
                </div>
                <div>
                  <Label className="text-[11px] text-amber-300">Fuel type</Label>
                  <Input value={fuelType} onChange={(e) => setFuelType(e.target.value)} placeholder="Gasoline" className="bg-slate-950 border-slate-800 text-white text-xs mt-1" />
                </div>
              </div>

              {decodedVehicle ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-emerald-200">NHTSA vehicle specifications</p>
                      <p className="text-[10px] text-emerald-300/70">Official vPIC result for {decodedVehicle.vin}</p>
                    </div>
                    <Badge className="rounded-full bg-emerald-500 text-slate-950 hover:bg-emerald-500">VIN decoded</Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {decodedDetails.map((detail) => (
                      <div key={detail.label} className="rounded-xl bg-slate-950/60 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{detail.label}</p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-200">{detail.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

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

              {/* Payout Method & Check Number Box */}
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-300">Select Payment Method</Label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPayoutMethod('Cash')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        payoutMethod === 'Cash'
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayoutMethod('Check')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        payoutMethod === 'Check'
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      Check Issue
                    </button>
                  </div>
                </div>

                {payoutMethod === 'Check' && (
                  <div className="p-3 bg-slate-950 border border-emerald-500/40 rounded-xl space-y-2">
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
                        Auto-Generate #
                      </Button>
                    </div>
                    <Input
                      value={checkNumber}
                      onChange={(e) => setCheckNumber(e.target.value)}
                      placeholder="Enter Check Number (e.g. 9042)"
                      className="bg-slate-900 border-slate-800 text-amber-300 font-mono font-bold text-sm h-10"
                    />
                  </div>
                )}
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

        {/* Right Column: Component Checklist & Auto-Pending Submit */}
        <div className="space-y-6">
          
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
                  <span className="text-xs text-slate-400 font-mono">Receipt #:</span>
                  <span className="text-amber-300 font-mono font-bold text-sm">{customReceiptNumber}</span>
                </div>
                <div className="flex justify-between items-baseline pt-1">
                  <span className="text-sm text-slate-300 font-medium">Purchase Payout:</span>
                  <span className="text-3xl font-black text-emerald-400 font-mono">
                    ${purchasePrice.toFixed(2)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Status will save as <span className="text-amber-300 font-bold">PENDING</span> in the Pending Group for finalization.
                </p>
              </div>

              <Button
                type="button"
                onClick={handleSubmitTicket}
                disabled={isSaving}
                className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-xl shadow-amber-950 text-sm tracking-wide rounded-xl"
              >
                {isSaving ? <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                {isSaving ? 'Saving Pending Intake…' : 'Save to Pending Group'}
              </Button>
            </CardContent>
          </Card>

        </div>

      </div>
    </div>
  );
};