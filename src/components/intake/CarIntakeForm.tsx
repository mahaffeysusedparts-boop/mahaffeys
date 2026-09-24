import React, { useState, useRef, useEffect } from 'react';
import { CarIntakeRecord, Customer, Ticket } from '@/types/scrap';
import { storageService } from '@/services/storageService';
import { apiRequest } from '@/services/apiClient';
import { customerService, type CustomerInput } from '@/services/customerService';
import { uploadDataUrl } from '@/services/mediaService';
import { PrintStickerModal } from '@/components/vehicle/PrintStickerModal';
import { VehicleStickerData } from '@/components/vehicle/VehicleSticker';
import { VinScannerModal } from '@/components/intake/VinScannerModal';
import { PlateScannerModal } from '@/components/intake/PlateScannerModal';
import { computeHoldUntilForIntake } from '@/utils/holdUtils';

import { decodeVin, VinDecodeResult } from '@/services/vinService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
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
  Hash,
  RefreshCw,
  ScanLine,
  User,
  Ban,
  ChevronsUpDown,
  CreditCard,
  Loader2,
  Printer,
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
  const [stickerVehicle, setStickerVehicle] = useState<VehicleStickerData | null>(null);
  const [isStickerOpen, setIsStickerOpen] = useState(false);

  // AI Door-Jamb VIN Scanner
  const [vinScannerOpen, setVinScannerOpen] = useState(false);
  const [doorJambPhotoUrl, setDoorJambPhotoUrl] = useState<string>('');

  // Phone plate scanner (rear camera) + LPR seller-history lookup
  const [plateScannerOpen, setPlateScannerOpen] = useState(false);
  const [lprLoading, setLprLoading] = useState(false);
  
  // References for device camera / file capture
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editable Receipt / Ticket Number
  const [customReceiptNumber, setCustomReceiptNumber] = useState<string>(
    `T-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  );

  // Who the vehicle came from (Seller)
  const [sellerName, setSellerName] = useState<string>('');
  const [sellerIdNumber, setSellerIdNumber] = useState<string>('');
  const [sellerPhone, setSellerPhone] = useState<string>('');
  const [sellerAddress, setSellerAddress] = useState<string>('');
  const [licensePlate, setLicensePlate] = useState('');

  // Registered-customer lookup on the seller name + saved ID photo
  const [sellerSearchOpen, setSellerSearchOpen] = useState(false);
  const [sellerSearch, setSellerSearch] = useState('');
  const [sellerResults, setSellerResults] = useState<Customer[]>([]);
  const [sellerSearchLoading, setSellerSearchLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [sellerIdPhotoUrl, setSellerIdPhotoUrl] = useState<string>('');
  const idPhotoInputRef = useRef<HTMLInputElement>(null);

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

  // Confirmed plate from the scanner: fill the field, then pull seller history via LPR.
  const handlePlateCaptured = async (plate: string) => {
    setLicensePlate(plate);
    setLprLoading(true);
    try {
      const result = await apiRequest<{ plate: string; customer: { fullName: string; phone: string; idNumber?: string; address?: string; vehicleLicensePlate?: string } | null }>(
        `/api/lpr/lookup?plate=${encodeURIComponent(plate)}`
      );
      if (result.customer) {
        setSellerName((prev) => prev || result.customer!.fullName);
        setSellerPhone((prev) => prev || result.customer!.phone || '');
        setSellerIdNumber((prev) => prev || result.customer!.idNumber || '');
        setSellerAddress((prev) => prev || result.customer!.address || '');
        toast.success(`Seller history found for plate ${plate}`, {
          description: `${result.customer.fullName}${result.customer.phone ? ` · ${result.customer.phone}` : ''} — fields pre-filled.`,
        });
      } else {
        toast.info(`No prior seller found for plate ${plate}`, {
          description: 'This plate is not on file yet — enter the seller details below.',
        });
      }
    } catch (error) {
      toast.warning('Seller lookup unavailable', {
        description: error instanceof Error ? error.message : 'The plate was kept — you can retry later.',
      });
    } finally {
      setLprLoading(false);
    }
  };

  // Debounced lookup of registered customers for the seller combobox
  useEffect(() => {
    if (!sellerSearchOpen) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setSellerSearchLoading(true);
      try {
        const result = await customerService.list({ search: sellerSearch.trim(), pageSize: 20 });
        if (active) setSellerResults(result.customers);
      } catch {
        if (active) setSellerResults([]);
      } finally {
        if (active) setSellerSearchLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [sellerSearch, sellerSearchOpen]);

  // Selecting a registered seller auto-fills their details AND their saved ID photo
  const handleSellerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSellerName(customer.fullName);
    setSellerIdNumber((prev) => prev || customer.idNumber);
    setSellerPhone((prev) => prev || customer.phone || '');
    setSellerAddress((prev) => prev || customer.address || '');
    setLicensePlate((prev) => prev || customer.vehicleLicensePlate || '');
    if (customer.idPhotoUrl) {
      setSellerIdPhotoUrl(customer.idPhotoUrl);
      toast.success('Seller found — ID photo pulled from their customer record');
    } else {
      toast.info(`Seller found — ${customer.fullName}'s details pre-filled`, {
        description: 'No ID photo on file yet. Capture one below to save it for next time.',
      });
    }
    setSellerSearchOpen(false);
  };

  // Capture / replace the seller ID photo and store it on the server
  const handleIdPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressVehiclePhoto(file);
      const url = await uploadDataUrl(dataUrl, `seller-id-${Date.now()}.jpg`);
      setSellerIdPhotoUrl(url);
      toast.success('ID photo captured', {
        description: selectedCustomer
          ? 'It will be saved to this seller\'s customer record.'
          : 'It will be saved with this seller\'s new customer record.',
      });
    } catch (error) {
      toast.error('Could not save the ID photo', {
        description: error instanceof Error ? error.message : 'Choose a different image and try again.',
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleAutoGenerateReceiptNumber = () => {
    const newNum = `T-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    setCustomReceiptNumber(newNum);
    toast.info(`Generated Receipt #${newNum}`);
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

  // AI scanner confirmed a VIN — fill it in; the auto-decode effect takes over.
  const handleVinCaptured = async (capturedVin: string, photoDataUrl?: string) => {
    setVin(capturedVin);
    toast.success(`VIN captured: ${capturedVin}`, {
      description: 'Decoding year, make, model, and engine specs from NHTSA…',
    });
    if (!photoDataUrl) return;
    try {
      const url = await uploadDataUrl(photoDataUrl, `door-jamb-${capturedVin}.jpg`);
      setDoorJambPhotoUrl(url);
    } catch {
      // The photo is a compliance bonus — a failed upload should never block intake.
    }
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

  // Automatically decode the VIN as soon as a complete 17-character VIN is typed
  useEffect(() => {
    const clean = vin.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (/^[A-HJ-NPR-Z0-9]{17}$/.test(clean)) {
      void handleDecodeVinWithVin(clean);
    }
  }, [vin]);

  const handleSubmitTicket = async () => {

    if (isSaving) return;

    if (!customReceiptNumber.trim()) {
      toast.error('Please enter a Receipt / Ticket Number');
      return;
    }
    if (!sellerName.trim()) {
      toast.error('Enter who the vehicle came from (seller name)');
      return;
    }
    if (purchasePrice < 0 || isNaN(purchasePrice)) {
      toast.error('Please enter a valid Purchase Price ($)');
      return;
    }

    const settings = storageService.getSettings();
    const currentOp = settings.operatorName;
    const finalCustomerName = sellerName.trim();
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
      titleStatus,
      titleNumber,
      // Title/crush hold — stamped at intake from the yard's hold settings.
      holdUntil:
        computeHoldUntilForIntake(new Date(), {
          enabled: settings.crushHoldEnabled !== false,
          crushHoldDays: settings.crushHoldDays ?? 30,
        }) ?? undefined,
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

    const intakeDate = new Date().toISOString();
    const newTicket: Ticket = {
      id: customReceiptNumber.trim(),
      ticketType: 'CAR_SALVAGE',
      createdAt: intakeDate,
      status: 'PENDING',
      customerName: finalCustomerName,
      customerPhone: sellerPhone.trim() || undefined,
      customerIdNumber: sellerIdNumber.trim() || undefined,
      vehicleLicensePlate: licensePlate.trim() || undefined,
      carRecord,
      complianceCaptures: {
        vehiclePhotoUrl: photoUrl,
        ...(doorJambPhotoUrl ? { doorJambVinPhotoUrl: doorJambPhotoUrl } : {}),
        ...(sellerIdPhotoUrl ? { idPhotoUrl: sellerIdPhotoUrl } : {}),
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
      // Keep the seller's registry record in sync: new sellers are created with
      // their ID photo, and returning sellers get any newly captured photo saved.
      try {
        const customerInput: CustomerInput = {
          fullName: finalCustomerName,
          phone: sellerPhone.trim(),
          idType: selectedCustomer?.idType ?? 'Driver License',
          idNumber: sellerIdNumber.trim(),
          idState: selectedCustomer?.idState ?? 'GA',
          address: sellerAddress.trim(),
          vehicleLicensePlate: licensePlate.trim().toUpperCase() || undefined,
          vehicleState: selectedCustomer?.vehicleState,
          notes: selectedCustomer?.notes,
          idPhotoUrl: sellerIdPhotoUrl || undefined,
          isCommercial: selectedCustomer?.isCommercial ?? false,
          companyName: selectedCustomer?.companyName,
          businessAddress: selectedCustomer?.businessAddress,
        };

        if (selectedCustomer) {
          await customerService.update(selectedCustomer.id, customerInput);
        } else if (sellerIdNumber.trim()) {
          const created = await customerService.create(customerInput);
          setSelectedCustomer(created);
        }
      } catch (error) {
        // The ticket still saves; only the registry sync failed.
        toast.warning('Seller registry could not be updated', {
          description: error instanceof Error ? error.message : 'The ID photo will not be on file for next time.',
        });
      }

      storageService.saveTicket(newTicket);
      setStickerVehicle({
        businessName: settings.yardName,
        make: carRecord.make || 'Unknown Make',
        model: carRecord.model || 'Unknown Model',
        year: carRecord.year,
        vin: carRecord.vin,
        intakeDate,
        publicUrl: `${window.location.origin}/inventory/vehicle/${encodeURIComponent(carRecord.vin)}`,
      });
      toast.success(`Vehicle saved to inventory`, {
        description: `${year} ${make} ${model} added as pending intake. Sticker is ready to print.`,
      });

      setVin('');
      setTrim('');
      setSellerName('');
      setSellerIdNumber('');
      setSellerPhone('');
      setSellerAddress('');
      setLicensePlate('');
      setPhotoUrl('');
      setDoorJambPhotoUrl('');
      setSelectedCustomer(null);
      setSellerIdPhotoUrl('');
      setSellerSearch('');

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
        
        {/* Left 2 Columns: Photo, Specs, Seller, Financial & Notes */}
        <div className="lg:col-span-2 space-y-6">

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
                <Car className="w-4 h-4 text-amber-400" /> Vehicle Identification Specs & VIN Decoder
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
                    className="bg-slate-950 border-slate-800 text-amber-300 font-mono tracking-wider font-bold text-sm uppercase flex-1 min-w-[220px]"
                  />

                  <Button
                    type="button"
                    onClick={() => setVinScannerOpen(true)}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 gap-1.5"
                  >
                    <ScanLine className="w-4 h-4" /> Scan Door Jamb
                  </Button>

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
                {doorJambPhotoUrl && (
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
                    <ScanLine className="w-3 h-3" /> Door-jamb VIN photo attached for compliance
                  </div>
                )}
                <p className="text-[10px] text-slate-400">
                  Snap the <strong>door-jamb sticker</strong> with the AI scanner — it reads the VIN, validates the check digit, and <strong>auto-fills everything</strong>. You can also type the 17 characters manually. No VIN on the vehicle? Tap <strong>"Skip / No VIN"</strong>.
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

          {/* 3. WHO IT CAME FROM (SELLER) CARD */}
          <Card className="bg-slate-900 border-blue-500/40 text-white shadow-xl overflow-hidden">
            <CardHeader className="py-3 px-4 bg-blue-950/40 border-b border-blue-500/30 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold tracking-wide uppercase text-blue-300 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-400" /> Who It Came From (Seller) *
              </CardTitle>
              {selectedCustomer && (
                <Badge className="bg-emerald-950 text-emerald-300 border-emerald-500/40 text-[10px] font-mono">
                  SELLER ON FILE
                </Badge>
              )}
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              <div>
                <Label className="text-xs text-slate-300">
                  <span>Find Returning Seller</span>
                </Label>
                <Popover open={sellerSearchOpen} onOpenChange={setSellerSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={sellerSearchOpen}
                      className="mt-1 h-10 w-full justify-between rounded-lg border-slate-800 bg-slate-950 px-3 text-xs font-normal text-white hover:bg-slate-900"
                    >
                      <span className="truncate text-slate-300">
                        {selectedCustomer ? selectedCustomer.fullName : 'Search name, phone, ID, or plate...'}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-500" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[min(420px,calc(100vw-2rem))] rounded-xl border-slate-700 bg-slate-900 p-0 text-white shadow-2xl">
                    <Command shouldFilter={false} className="rounded-xl bg-slate-900 text-white">
                      <CommandInput
                        value={sellerSearch}
                        onValueChange={setSellerSearch}
                        placeholder="Name, phone, ID, or plate..."
                        className="text-xs text-white placeholder:text-slate-500"
                      />
                      <CommandList>
                        {sellerSearchLoading ? (
                          <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-400">
                            <Loader2 className="h-4 w-4 animate-spin text-blue-400" /> Searching...
                          </div>
                        ) : (
                          <>
                            <CommandEmpty>No seller found — enter their details below to add them.</CommandEmpty>
                            <CommandGroup heading="Registered Sellers">
                              {sellerResults.map((customer) => (
                                <CommandItem
                                  key={customer.id}
                                  value={customer.id}
                                  onSelect={() => handleSellerSelect(customer)}
                                  className="items-start rounded-lg px-3 py-2.5 text-white data-[selected=true]:bg-blue-950"
                                >
                                  <div className="flex min-w-0 flex-1 items-center gap-2">
                                    {customer.idPhotoUrl ? (
                                      <img
                                        src={customer.idPhotoUrl}
                                        alt=""
                                        className="h-8 w-11 shrink-0 rounded border border-slate-700 object-cover"
                                      />
                                    ) : (
                                      <span className="flex h-8 w-11 shrink-0 items-center justify-center rounded border border-slate-700 bg-slate-950">
                                        <CreditCard className="h-3.5 w-3.5 text-slate-600" />
                                      </span>
                                    )}
                                    <div className="min-w-0">
                                      <div className="truncate text-xs font-bold">{customer.fullName}</div>
                                      <p className="truncate text-[10px] text-slate-400">
                                        {customer.idNumber || customer.phone || 'No ID on file'}
                                      </p>
                                    </div>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-300">
                    <span>Seller / Source Full Name</span>
                  </Label>
                  <Input
                    value={sellerName}
                    onChange={(e) => setSellerName(e.target.value)}
                    placeholder="e.g. Marcus Vance / Vance Repair Shop"
                    className="bg-slate-950 border-slate-800 text-white text-xs mt-1 h-10 font-bold"
                  />
                </div>

                <div>
                  <Label className="text-xs text-slate-300">
                    <span>Driver License / State ID # (Optional)</span>
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
                  <Label className="flex items-center justify-between text-xs text-slate-300">
                    <span>License Plate</span>
                    {licensePlate && <span className="font-mono text-[10px] text-sky-300">PLATE ON FILE</span>}
                  </Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={licensePlate}
                      onChange={(e) => setLicensePlate(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      placeholder="ABC1234"
                      className="h-10 bg-slate-950 border-slate-800 text-amber-300 font-mono font-bold uppercase"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPlateScannerOpen(true)}
                      disabled={lprLoading}
                      className="h-10 shrink-0 gap-1.5 border-sky-500/40 bg-sky-950/40 text-sky-300 hover:bg-sky-900/50 font-bold text-xs"
                      title="Scan plate with the phone camera"
                    >
                      {lprLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                      Scan
                    </Button>
                  </div>
                </div>
                <div className="sm:col-span-2">

                  <Label className="text-xs text-slate-300">Seller Address</Label>
                  <Input value={sellerAddress} onChange={(e) => setSellerAddress(e.target.value)} placeholder="Street, city, state, ZIP" className="mt-1 h-10 bg-slate-950 border-slate-800 text-white text-xs" />
                </div>
              </div>

              {/* Seller ID photo — auto-pulled from the registry, saved back on submit */}
              <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <input
                  ref={idPhotoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => void handleIdPhotoUpload(e)}
                />
                <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-800 bg-slate-950">
                  {sellerIdPhotoUrl ? (
                    <img src={sellerIdPhotoUrl} alt="Seller ID" className="h-full w-full object-cover" />
                  ) : (
                    <CreditCard className="h-5 w-5 text-slate-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-200">Seller ID Photo</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
                    {sellerIdPhotoUrl
                      ? selectedCustomer
                        ? 'Pulled from their customer record — retake only if the ID changed.'
                        : 'Saved to their new customer record when you submit this intake.'
                      : 'Capture the DL / State ID once — it is saved to the seller registry and auto-fills on future visits.'}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => idPhotoInputRef.current?.click()}
                    className="mt-1.5 h-8 gap-1.5 border-blue-500/40 bg-blue-950/40 text-[11px] font-bold text-blue-300 hover:bg-blue-900/50"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    {sellerIdPhotoUrl ? 'Retake ID Photo' : 'Capture ID Photo'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4. FINANCIAL & ORIGIN LOGGING */}
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
                    How Much We Paid ($) *
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
                    Purchase price paid to acquire the vehicle
                  </span>
                </div>

                <div>
                  <Label className="text-xs text-slate-300 font-bold block mb-1">
                    Where It Came From / Tow Source
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

          {/* 5. TOW DRIVER NOTES SECTION */}
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
                  <span className="text-sm text-slate-300 font-medium">We Paid:</span>
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
                onClick={() => void handleSubmitTicket()}
                disabled={isSaving}
                className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-xl shadow-amber-950 text-sm tracking-wide rounded-xl"
              >
                {isSaving ? <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                {isSaving ? 'Saving Pending Intake…' : 'Save to Pending Group'}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => setIsStickerOpen(true)}
                disabled={!stickerVehicle || isSaving}
                className="h-11 w-full rounded-xl border-amber-400/50 bg-slate-950 font-bold text-amber-300 hover:bg-amber-400 hover:text-slate-950 disabled:border-slate-700 disabled:text-slate-600"
              >
                <Printer className="mr-2 size-4" />
                {stickerVehicle ? 'Print Saved Vehicle Sticker' : 'Print Sticker After Saving'}
              </Button>
              <p className="text-center text-[10px] text-slate-500">
                Sticker printing unlocks after a successful vehicle save.
              </p>
            </CardContent>
          </Card>

        </div>

      </div>

      <VinScannerModal
        open={vinScannerOpen}
        onOpenChange={setVinScannerOpen}
        onConfirm={handleVinCaptured}
      />

      <PlateScannerModal
        open={plateScannerOpen}
        onOpenChange={setPlateScannerOpen}
        onConfirm={(plate) => void handlePlateCaptured(plate)}
      />

      <PrintStickerModal
        open={isStickerOpen}
        onOpenChange={setIsStickerOpen}
        vehicle={stickerVehicle}
      />
    </div>
  );
};