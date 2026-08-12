import React, { useState, useRef } from "react";
import { PullYardVehicle, PullYardVehicleStatus, Ticket } from "@/types/scrap";
import { storageService } from "@/services/storageService";
import { analyzeVinImage, analyzeLicensePlateImage, analyzeDriverLicenseImage } from "@/services/aiVisionService";
import { generateSamplePhoto } from "@/utils/complianceUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Truck,
  Camera,
  Scan,
  CheckCircle2,
  Car,
  Ban,
  Upload,
  User,
  MapPin,
  Clock,
  Sparkles,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";

interface TowDropModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const TowDropModal: React.FC<TowDropModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const vinCameraRef = useRef<HTMLInputElement>(null);
  const dlCameraRef = useRef<HTMLInputElement>(null);

  // Form State
  const [driverName, setDriverName] = useState<string>("Driver #1 (Sam Taylor)");
  const [originAddress, setOriginSource] = useState<string>("");
  const [sellerName, setSellerName] = useState<string>("");
  const [sellerId, setSellerId] = useState<string>("");

  const [vin, setVin] = useState<string>("");
  const [year, setYear] = useState<number>(new Date().getFullYear() - 10);
  const [make, setMake] = useState<string>("Ford");
  const [model, setModel] = useState<string>("F-150");
  const [color, setColor] = useState<string>("White");

  const [section, setSection] = useState<PullYardVehicle["section"]>("Domestic Trucks & SUVs");
  const [rowNumber, setRowNumber] = useState<string>("Inbound Staging");
  const [spaceNumber, setSpaceNumber] = useState<string>("Spot 01");
  const [purchasePrice, setPurchasePrice] = useState<number>(450);
  const [notes, setNotes] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState<string>(generateSamplePhoto("vehicle"));

  const handleSkipVin = () => {
    const fallbackVin = `NO-VIN-${Math.floor(1000 + Math.random() * 9000)}`;
    setVin(fallbackVin);
    toast.info(`Assigned temporary Tag: ${fallbackVin}`);
  };

  const handleVinPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.info("AI Vision analyzing VIN photo...", { icon: "✨" });
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const dataUrl = evt.target?.result as string;
        try {
          const res = await analyzeVinImage(dataUrl);
          if (res.vin) {
            setVin(res.vin);
            toast.success(`AI Extracted VIN: ${res.vin}`);
            decodeVin(res.vin);
          } else {
            toast.error("Could not find clear 17-character VIN string.");
          }
        } catch (err) {
          console.warn("VIN OCR error:", err);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const decodeVin = (vinStr: string) => {
    if (!vinStr || vinStr.length < 5) return;
    const clean = vinStr.toUpperCase().trim();
    setVin(clean);

    if (clean.startsWith("1G")) {
      setMake("Chevrolet");
      setModel("Impala");
      setSection("GM & Chevrolet");
    } else if (clean.startsWith("1F")) {
      setMake("Ford");
      setModel("F-150");
      setSection("Ford & Lincoln");
    } else if (clean.startsWith("4S") || clean.startsWith("J")) {
      setMake("Toyota");
      setModel("Camry");
      setSection("Asian Imports");
    } else {
      setMake("Dodge");
      setModel("Ram 1500");
      setSection("Chrysler & Dodge");
    }
  };

  const handleDlPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.info("AI Vision analyzing Driver License photo...", { icon: "✨" });
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const dataUrl = evt.target?.result as string;
        try {
          const res = await analyzeDriverLicenseImage(dataUrl);
          if (res.fullName) setSellerName(res.fullName);
          if (res.idNumber) setSellerId(res.idNumber);
          toast.success(`AI Extracted DL: ${res.fullName} (${res.idNumber})`);
        } catch (err) {
          console.warn("DL OCR error:", err);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVehiclePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          const url = evt.target.result as string;
          setPhotoUrl(url);
          toast.success("Vehicle photo captured");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveDrop = () => {
    if (!make.trim() || !model.trim()) {
      toast.error("Vehicle Make and Model are required");
      return;
    }

    const operatorName = storageService.getSettings().operatorName;
    const ticketId = `T-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newVehicle: PullYardVehicle = {
      id: `veh-${Date.now()}`,
      stockNumber: `STK-${new Date().getFullYear()}-${Math.floor(10 + Math.random() * 90)}`,
      section,
      rowNumber,
      spaceNumber,
      year,
      make: make.trim(),
      model: model.trim(),
      color: color.trim() || "White",
      vin: vin.toUpperCase().trim() || `NO-VIN-${Math.floor(1000 + Math.random() * 9000)}`,
      dateSetInYard: new Date().toISOString(),
      status: "PENDING",
      partsRemaining: ["Engine", "Transmission", "Doors", "Wheels", "Fenders"],
      purchasePrice,
      originSource: originAddress.trim() || "Tow Drop-Off",
      notes: notes.trim() ? `[Tow Driver: ${driverName}] ${notes}` : `Tow drop by ${driverName}`,
      photoUrl,
      intakeOperator: operatorName,
      dismantlingLog: {
        catalyticConvertersRemoved: 0,
        wheelsRemoved: 0,
        gasDrained: false,
        oilDrained: false,
      },
    };

    // Save vehicle to yard inventory
    storageService.savePullYardVehicle(newVehicle);

    // Also create pending intake ticket in ticket ledger
    const newTicket: Ticket = {
      id: ticketId,
      ticketType: "CAR_SALVAGE",
      createdAt: new Date().toISOString(),
      status: "PENDING",
      customerName: sellerName.trim() || `Tow Drop: ${originAddress || driverName}`,
      customerIdNumber: sellerId.trim() || undefined,
      vehicleLicensePlate: "",
      carRecord: {
        vin: newVehicle.vin,
        year: newVehicle.year,
        make: newVehicle.make,
        model: newVehicle.model,
        color: newVehicle.color,
        titleStatus: "Salvage Title",
        hasCatalyticConverter: true,
        catCondition: "Original OEM",
        hasEngineAndTrans: true,
        hasBattery: true,
        hasAluminumRims: true,
        fluidsDrained: false,
        pricingMode: "FLAT_RATE",
        vehicleWeightLbs: 3500,
        ratePerTon: 0,
        flatRate: purchasePrice,
        catBonus: 0,
        engineBonus: 0,
        batteryBonus: 0,
        deductions: 0,
        totalPayout: purchasePrice,
        purchasePrice,
        originSource: originAddress.trim() || driverName,
        notes: newVehicle.notes,
        photoUrl,
      },
      complianceCaptures: {
        vehiclePhotoUrl: photoUrl,
      },
      grossTotal: purchasePrice,
      totalDeductions: 0,
      finalPayout: purchasePrice,
      payoutMethod: "Cash",
      operatorName,
      notes: newVehicle.notes,
    };

    storageService.saveTicket(newTicket);

    toast.success(`Tow Drop Completed & Saved! Ticket #${ticketId}`, {
      description: `${newVehicle.year} ${newVehicle.make} ${newVehicle.model} placed in ${rowNumber}`,
    });

    if (onSuccess) onSuccess();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[560px] max-h-[92vh] overflow-y-auto font-sans">
        
        <input
          type="file"
          ref={cameraInputRef}
          onChange={handleVehiclePhotoUpload}
          accept="image/*"
          capture="environment"
          className="hidden"
        />
        <input
          type="file"
          ref={vinCameraRef}
          onChange={handleVinPhotoUpload}
          accept="image/*"
          capture="environment"
          className="hidden"
        />
        <input
          type="file"
          ref={dlCameraRef}
          onChange={handleDlPhotoUpload}
          accept="image/*"
          className="hidden"
        />

        <DialogHeader className="border-b border-slate-800 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-400" />
              <DialogTitle className="text-base font-bold text-white font-mono">
                Tow Truck Driver Field Drop-Off
              </DialogTitle>
            </div>
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-mono">
              MOBILE INTAKE
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          
          {/* Driver & Origin Header */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div>
              <Label className="text-slate-300 flex items-center gap-1 font-bold">
                <Truck className="w-3.5 h-3.5 text-amber-400" /> Tow Driver Name *
              </Label>
              <Input
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="e.g. Sam Taylor"
                className="bg-slate-950 border-slate-800 text-amber-300 font-bold text-xs mt-1 h-10"
              />
            </div>

            <div>
              <Label className="text-slate-300 flex items-center gap-1 font-bold">
                <MapPin className="w-3.5 h-3.5 text-rose-400" /> Origin Address / Shop
              </Label>
              <Input
                value={originAddress}
                onChange={(e) => setOriginSource(e.target.value)}
                placeholder="e.g. 1428 Industrial Pkwy"
                className="bg-slate-950 border-slate-800 text-white text-xs mt-1 h-10"
              />
            </div>
          </div>

          {/* Camera VIN Scan & Specs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-slate-300 font-bold">VIN Tag OCR Scan *</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleSkipVin}
                className="h-6 text-[11px] text-rose-400 hover:text-rose-300 p-0 font-semibold gap-1"
              >
                <Ban className="w-3.5 h-3.5" /> Skip VIN
              </Button>
            </div>

            <div className="flex gap-2">
              <Input
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase())}
                placeholder="1FTRF12W88KA10291"
                className="bg-slate-900 border-slate-800 text-amber-300 font-mono font-bold text-xs h-11 flex-1 tracking-wider"
              />
              <Button
                type="button"
                onClick={() => vinCameraRef.current?.click()}
                className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs gap-1.5 h-11 shrink-0"
              >
                <Scan className="w-4 h-4 text-amber-300" /> Camera VIN Scan
              </Button>
            </div>
          </div>

          {/* Vehicle Year, Make, Model, Color */}
          <div className="grid grid-cols-4 gap-2">
            <div>
              <Label className="text-slate-300 text-[11px]">Year</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value) || 2012)}
                className="bg-slate-900 border-slate-800 text-white font-mono text-xs mt-1 h-10"
              />
            </div>

            <div>
              <Label className="text-slate-300 text-[11px]">Make *</Label>
              <Input
                value={make}
                onChange={(e) => setMake(e.target.value)}
                placeholder="Ford"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1 h-10 font-bold"
              />
            </div>

            <div>
              <Label className="text-slate-300 text-[11px]">Model *</Label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="F-150"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1 h-10 font-bold"
              />
            </div>

            <div>
              <Label className="text-slate-300 text-[11px]">Color</Label>
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="White"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1 h-10"
              />
            </div>
          </div>

          {/* Staging Drop Location & Section */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-slate-900 rounded-xl border border-slate-800">
            <div>
              <Label className="text-slate-300 text-[11px]">Yard Section</Label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value as any)}
                className="w-full h-10 bg-slate-950 border border-slate-800 rounded-md text-xs text-white px-2 mt-1"
              >
                <option value="Domestic Trucks & SUVs">Domestic Trucks & SUVs</option>
                <option value="Ford & Lincoln">Ford & Lincoln</option>
                <option value="GM & Chevrolet">GM & Chevrolet</option>
                <option value="Chrysler & Dodge">Chrysler & Dodge</option>
                <option value="Asian Imports">Asian Imports</option>
                <option value="European">European</option>
              </select>
            </div>

            <div>
              <Label className="text-slate-300 text-[11px]">Drop Row *</Label>
              <Input
                value={rowNumber}
                onChange={(e) => setRowNumber(e.target.value)}
                placeholder="Inbound Staging"
                className="bg-slate-950 border-slate-800 text-amber-300 font-bold text-xs mt-1 h-10"
              />
            </div>

            <div>
              <Label className="text-slate-300 text-[11px]">Spot #</Label>
              <Input
                value={spaceNumber}
                onChange={(e) => setSpaceNumber(e.target.value)}
                placeholder="Spot 01"
                className="bg-slate-950 border-slate-800 text-white text-xs mt-1 h-10"
              />
            </div>
          </div>

          {/* Seller / Driver DL Photo OCR */}
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-slate-300 font-bold flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-400" /> Seller Name & DL OCR (Optional)
              </Label>
              <Button
                type="button"
                size="sm"
                onClick={() => dlCameraRef.current?.click()}
                className="h-7 text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-bold gap-1 px-2"
              >
                <CreditCard className="w-3 h-3 text-amber-300" /> Scan DL
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Input
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                placeholder="Seller Name"
                className="bg-slate-950 border-slate-800 text-white text-xs h-9"
              />
              <Input
                value={sellerId}
                onChange={(e) => setSellerId(e.target.value)}
                placeholder="DL / ID Number"
                className="bg-slate-950 border-slate-800 text-amber-300 font-mono text-xs h-9"
              />
            </div>
          </div>

          {/* Vehicle Photo Snap */}
          <div className="space-y-1.5">
            <Label className="text-slate-300">Vehicle Photo (45° Angle)</Label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-12 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                <img src={photoUrl} alt="Vehicle preview" className="w-full h-full object-cover" />
              </div>
              <Button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs gap-1.5 h-10"
              >
                <Camera className="w-4 h-4" /> Snap Vehicle Photo
              </Button>
            </div>
          </div>

          {/* Condition Notes */}
          <div>
            <Label className="text-slate-300">Tow Driver Condition Notes</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Front bumper crushed, key in ignition, catalytic converter intact..."
              className="bg-slate-900 border-slate-800 text-slate-200 text-xs mt-1"
            />
          </div>

        </div>

        <DialogFooter className="pt-2 border-t border-slate-800">
          <Button variant="ghost" onClick={onClose} className="text-slate-400">
            Cancel
          </Button>
          <Button
            onClick={handleSaveDrop}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs gap-2 h-11 px-6 shadow-lg shadow-emerald-950"
          >
            <CheckCircle2 className="w-4 h-4" /> Confirm Tow Drop-Off
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};