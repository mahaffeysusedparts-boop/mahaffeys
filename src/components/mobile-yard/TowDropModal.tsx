"use client";

import React, { useState, useRef } from "react";
import { PullYardVehicle, Ticket } from "@/types/scrap";
import { storageService } from "@/services/storageService";
import { analyzeVinImage } from "@/services/aiVisionService";
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
  Scan,
  Camera,
  Ban,
  CheckCircle2,
  DollarSign,
  MapPin,
  Upload,
  Clock,
  Sparkles,
  Search,
  User,
  Hash,
} from "lucide-react";
import { toast } from "sonner";

interface TowDropModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newVehicle: PullYardVehicle) => void;
}

export const TowDropModal: React.FC<TowDropModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [towDriverName, setTowDriverName] = useState<string>("Sam Taylor (Tow Driver #1)");
  const [receiptNumber, setReceiptNumber] = useState<string>(
    `T-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  );
  
  const [vin, setVin] = useState<string>("");
  const [year, setYear] = useState<number>(2012);
  const [make, setMake] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [color, setColor] = useState<string>("White");
  const [section, setSection] = useState<PullYardVehicle["section"]>("Domestic Trucks & SUVs");
  const [rowNumber, setRowNumber] = useState<string>("Row 01 (Inbound Drop)");
  const [spaceNumber, setSpaceNumber] = useState<string>("Drop Bay 1");
  const [purchasePrice, setPurchasePrice] = useState<number>(450);
  const [originSource, setOriginSource] = useState<string>("Impound Tow Drop");
  const [notes, setNotes] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState<string>(generateSamplePhoto("vehicle"));

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const vinInputRef = useRef<HTMLInputElement>(null);

  const handleVinCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.info("AI Vision parsing VIN barcode tag...", { icon: "✨" });
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const dataUrl = evt.target?.result as string;
        try {
          const res = await analyzeVinImage(dataUrl);
          if (res.vin) {
            setVin(res.vin);
            toast.success(`AI Vision Extracted VIN: ${res.vin}`);
            decodeVin(res.vin);
          } else {
            toast.error("Could not read VIN barcode clearly. Please verify lighting.");
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

  const handleVehiclePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          setPhotoUrl(evt.target.result as string);
          toast.success("Vehicle drop photo attached");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSkipVin = () => {
    const noVinTag = `NO-VIN-${Math.floor(1000 + Math.random() * 9000)}`;
    setVin(noVinTag);
    toast.info(`Assigned VIN placeholder: ${noVinTag}`);
  };

  const handleSaveDrop = () => {
    if (!make.trim() || !model.trim()) {
      toast.error("Make and Model are required");
      return;
    }

    const currentOp = storageService.getSettings().operatorName;
    const stockNumber = `STK-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const newVehicle: PullYardVehicle = {
      id: `veh-tow-${Date.now()}`,
      stockNumber,
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
      partsRemaining: ["Engine Assembly", "Transmission", "Doors", "Wheels", "Fenders"],
      purchasePrice,
      originSource: originSource.trim() || "Tow Drop",
      notes: notes.trim() ? `Tow Driver: ${towDriverName} | ${notes.trim()}` : `Tow Driver: ${towDriverName}`,
      photoUrl,
      intakeOperator: currentOp,
      dismantlingLog: {
        catalyticConvertersRemoved: 0,
        wheelsRemoved: 0,
        gasDrained: false,
        oilDrained: false,
      },
    };

    // Save vehicle
    storageService.savePullYardVehicle(newVehicle);

    // Also save a pending intake ticket for scale operator
    const newTicket: Ticket = {
      id: receiptNumber.trim(),
      ticketType: 'CAR_SALVAGE',
      createdAt: new Date().toISOString(),
      status: 'PENDING',
      customerName: `Tow Drop: ${towDriverName}`,
      customerIdNumber: "TOW-DRIVER-ID",
      carRecord: {
        vin: newVehicle.vin,
        year: newVehicle.year,
        make: newVehicle.make,
        model: newVehicle.model,
        color: newVehicle.color,
        titleStatus: 'Salvage Title',
        hasCatalyticConverter: true,
        catCondition: 'Original OEM',
        hasEngineAndTrans: true,
        hasBattery: true,
        hasAluminumRims: true,
        fluidsDrained: false,
        pricingMode: 'FLAT_RATE',
        vehicleWeightLbs: 3500,
        ratePerTon: 0,
        flatRate: purchasePrice,
        catBonus: 0,
        engineBonus: 0,
        batteryBonus: 0,
        deductions: 0,
        totalPayout: purchasePrice,
        purchasePrice,
        originSource: originSource.trim() || 'Tow Inbound Drop',
        notes: newVehicle.notes,
        photoUrl,
      },
      complianceCaptures: {
        vehiclePhotoUrl: photoUrl,
      },
      grossTotal: purchasePrice,
      totalDeductions: 0,
      finalPayout: purchasePrice,
      payoutMethod: 'Cash',
      operatorName: currentOp,
      notes: newVehicle.notes,
    };

    storageService.saveTicket(newTicket);
    toast.success(`Tow Drop Logged! Ticket #${newTicket.id} saved to Pending Group.`);
    onSuccess(newVehicle);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[560px] max-h-[92vh] overflow-y-auto font-sans">
        
        <input
          type="file"
          ref={vinInputRef}
          onChange={handleVinCameraCapture}
          accept="image/*"
          capture="environment"
          className="hidden"
        />

        <input
          type="file"
          ref={cameraInputRef}
          onChange={handleVehiclePhotoUpload}
          accept="image/*"
          className="hidden"
        />

        <DialogHeader className="border-b border-slate-800 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-400" />
              <DialogTitle className="text-base font-bold text-white font-mono">
                Rapid Tow Driver Vehicle Drop Station
              </DialogTitle>
            </div>
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-mono">
              TOW INBOUND
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          
          {/* Tow Driver & Receipt Row */}
          <div className="grid grid-cols-2 gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div>
              <Label className="text-slate-300 flex items-center gap-1 text-[11px]">
                <User className="w-3.5 h-3.5 text-emerald-400" /> Tow Driver Name / Unit *
              </Label>
              <Input
                value={towDriverName}
                onChange={(e) => setTowDriverName(e.target.value)}
                placeholder="e.g. Sam Taylor (Unit #4)"
                className="bg-slate-950 border-slate-800 text-white font-bold text-xs mt-1 h-10"
              />
            </div>

            <div>
              <Label className="text-slate-300 flex items-center gap-1 text-[11px]">
                <Hash className="w-3.5 h-3.5 text-amber-400" /> Ticket / Voucher # *
              </Label>
              <Input
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                className="bg-slate-950 border-slate-800 text-amber-300 font-mono font-bold text-xs mt-1 h-10"
              />
            </div>
          </div>

          {/* VIN Barcode Camera OCR */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-slate-300 font-bold">17-Digit VIN Number</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleSkipVin}
                className="h-6 text-[11px] text-rose-400 hover:text-rose-300 gap-1 p-0"
              >
                <Ban className="w-3 h-3" /> Skip / No VIN
              </Button>
            </div>

            <div className="flex gap-2">
              <Input
                value={vin}
                onChange={(e) => {
                  setVin(e.target.value.toUpperCase());
                  decodeVin(e.target.value);
                }}
                placeholder="1FTRF12W88KA10291 or tap AI Scan"
                className="bg-slate-900 border-slate-800 text-amber-300 font-mono font-bold text-xs flex-1 h-10"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => vinInputRef.current?.click()}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs gap-1.5 shrink-0 h-10"
              >
                <Scan className="w-4 h-4 text-amber-300" /> AI Scan VIN Tag
              </Button>
            </div>
          </div>

          {/* Specs: Year, Make, Model, Color */}
          <div className="grid grid-cols-4 gap-2">
            <div>
              <Label className="text-slate-300 text-[11px]">Year</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value) || 2012)}
                className="bg-slate-900 border-slate-800 text-white font-mono text-xs mt-1 h-9"
              />
            </div>

            <div>
              <Label className="text-slate-300 text-[11px]">Make *</Label>
              <Input
                value={make}
                onChange={(e) => setMake(e.target.value)}
                placeholder="Ford"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1 h-9 font-bold"
              />
            </div>

            <div>
              <Label className="text-slate-300 text-[11px]">Model *</Label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="F-150"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1 h-9 font-bold"
              />
            </div>

            <div>
              <Label className="text-slate-300 text-[11px]">Color</Label>
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="White"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1 h-9"
              />
            </div>
          </div>

          {/* Drop Location Row */}
          <div className="grid grid-cols-3 gap-2 bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div>
              <Label className="text-slate-300 text-[11px]">Drop Section *</Label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value as any)}
                className="w-full h-9 bg-slate-950 border border-slate-800 rounded-md text-xs text-white px-2 mt-1"
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
              <Label className="text-slate-300 text-[11px]">Drop Row</Label>
              <Input
                value={rowNumber}
                onChange={(e) => setRowNumber(e.target.value)}
                placeholder="Row 01 (Inbound)"
                className="bg-slate-950 border-slate-800 text-white text-xs mt-1 h-9 font-mono"
              />
            </div>

            <div>
              <Label className="text-slate-300 text-[11px]">Drop Bay / Spot</Label>
              <Input
                value={spaceNumber}
                onChange={(e) => setSpaceNumber(e.target.value)}
                placeholder="Drop Bay 1"
                className="bg-slate-950 border-slate-800 text-white text-xs mt-1 h-9 font-mono"
              />
            </div>
          </div>

          {/* Purchase Price & Tow Address */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-300 text-[11px]">Agreed Purchase Price ($)</Label>
              <Input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
                className="bg-slate-900 border-slate-800 text-emerald-400 font-mono font-bold text-xs mt-1 h-10"
              />
            </div>

            <div>
              <Label className="text-slate-300 text-[11px]">Tow Origin Address</Label>
              <Input
                value={originSource}
                onChange={(e) => setOriginSource(e.target.value)}
                placeholder="1428 Industrial Pkwy / Impound"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1 h-10"
              />
            </div>
          </div>

          {/* Photo Snapshot preview */}
          <div className="flex items-center gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div className="w-16 h-12 rounded bg-slate-950 overflow-hidden border border-slate-800 shrink-0 flex items-center justify-center">
              <img src={photoUrl} alt="Vehicle drop preview" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 space-y-1">
              <span className="text-[11px] font-bold text-slate-200 block">Vehicle Condition Photo</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => cameraInputRef.current?.click()}
                className="border-slate-700 bg-slate-950 text-amber-400 hover:text-white text-xs h-8 gap-1"
              >
                <Camera className="w-3.5 h-3.5" /> Snap Photo
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-slate-300 text-[11px]">Condition Notes / Driver Comments</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Missing key, catalytic converter intact, front bumper smashed..."
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
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs gap-1.5 shadow-lg shadow-amber-950 h-11"
          >
            <CheckCircle2 className="w-4 h-4" /> Save Tow Drop to Pending Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};