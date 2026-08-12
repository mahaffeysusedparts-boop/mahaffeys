import React, { useState, useRef } from "react";
import { PullYardVehicle, PullYardVehicleStatus, VehicleArrivalSubscription } from "@/types/scrap";
import { storageService } from "@/services/storageService";
import { generateSamplePhoto } from "@/utils/complianceUtils";
import { analyzeVinImage } from "@/services/aiVisionService";
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
  Car,
  Clock,
  Scan,
  Search,
  Plus,
  Ban,
  CheckCircle2,
  DollarSign,
  MapPin,
  Camera,
  Upload,
  AlertTriangle,
  Bell,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface VehicleIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newVehicle: PullYardVehicle) => void;
}

export const VehicleIntakeModal: React.FC<VehicleIntakeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().slice(0, 16));
  const [stockNumber, setStockNumber] = useState<string>(`STK-${new Date().getFullYear()}-${Math.floor(10 + Math.random() * 90)}`);
  const [section, setSection] = useState<PullYardVehicle["section"]>("Domestic Trucks & SUVs");
  const [rowNumber, setRowNumber] = useState<string>("Row 05");
  const [spaceNumber, setSpaceNumber] = useState<string>("Space 12");
  
  const [year, setYear] = useState<number>(new Date().getFullYear() - 10);
  const [make, setMake] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [color, setColor] = useState<string>("Silver");
  const [vin, setVin] = useState<string>("");
  const [status, setStatus] = useState<PullYardVehicleStatus>("AVAILABLE");
  
  const [parts, setParts] = useState<string>("Engine Assembly, Transmission, Doors, Wheels, Fenders");
  const [purchasePrice, setPurchasePrice] = useState<number>(450);
  const [originSource, setOriginSource] = useState<string>("Tow Drop / Impound Intake");
  const [notes, setNotes] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState<string>(generateSamplePhoto("vehicle"));

  // Subscriptions Alerts match
  const [matchingSubs, setMatchingSubs] = useState<VehicleArrivalSubscription[]>([]);

  const vinCameraRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
            handleDecodeVinWithVal(res.vin);
          } else {
            toast.error("Could not read 17-character VIN string.");
          }
        } catch (err) {
          console.warn("VIN OCR error:", err);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          setPhotoUrl(evt.target.result as string);
          toast.success("Vehicle photo attached");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSkipVin = () => {
    const noVinTag = `NO-VIN-${Math.floor(1000 + Math.random() * 9000)}`;
    setVin(noVinTag);
    toast.info(`Assigned placeholder tag: ${noVinTag}`);
  };

  const handleDecodeVinWithVal = (vinStr: string) => {
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

    checkSubscriptions(make || "Ford", model || "F-150");
  };

  const checkSubscriptions = (checkMake: string, checkModel: string) => {
    if (!checkMake.trim() || !checkModel.trim()) return;
    const matches = storageService.checkSubscriptionsForVehicle(checkMake, checkModel);
    setMatchingSubs(matches);
    if (matches.length > 0) {
      toast.info(`🔔 Vehicle Alert Match! ${matches.length} customer request(s) waiting for ${checkMake} ${checkModel}.`, {
        duration: 5000,
      });
    }
  };

  const handleMakeModelBlur = () => {
    if (make.trim() && model.trim()) {
      checkSubscriptions(make, model);
    }
  };

  const handleSaveEntry = () => {
    if (!make.trim() || !model.trim()) {
      toast.error("Vehicle Make and Model are required");
      return;
    }

    const currentOp = storageService.getSettings().operatorName;
    const partsList = parts.split(",").map((s) => s.trim()).filter(Boolean);
    const entryIso = entryDate ? new Date(entryDate).toISOString() : new Date().toISOString();

    const newVehicle: PullYardVehicle = {
      id: `veh-${Date.now()}`,
      stockNumber,
      section,
      rowNumber,
      spaceNumber,
      year,
      make: make.trim(),
      model: model.trim(),
      color: color.trim() || "White",
      vin: vin.toUpperCase().trim() || `NO-VIN-${Math.floor(1000 + Math.random() * 9000)}`,
      dateSetInYard: entryIso,
      status,
      partsRemaining: partsList.length > 0 ? partsList : ["Body Shell"],
      purchasePrice,
      originSource: originSource.trim() || undefined,
      notes: notes.trim() || undefined,
      photoUrl,
      intakeOperator: currentOp,
      dismantlingLog: {
        catalyticConvertersRemoved: 0,
        wheelsRemoved: 0,
        gasDrained: false,
        oilDrained: false,
      },
    };

    storageService.savePullYardVehicle(newVehicle);
    toast.success(`Vehicle Logged! ${newVehicle.year} ${newVehicle.make} ${newVehicle.model} recorded in ${section}`);
    onSuccess(newVehicle);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[620px] max-h-[92vh] overflow-y-auto">
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
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          className="hidden"
        />

        <DialogHeader className="border-b border-slate-800 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Car className="w-5 h-5 text-amber-400" />
              <DialogTitle className="text-base font-bold text-white font-mono">
                Record New Vehicle Arrival Entry
              </DialogTitle>
            </div>
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-mono">
              YARD INTAKE
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          
          {/* Notification Alert Banner if match found */}
          {matchingSubs.length > 0 && (
            <div className="p-3 bg-amber-950/70 border-2 border-amber-500 rounded-xl space-y-1 text-amber-200">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <Bell className="w-4 h-4 text-amber-400 animate-bounce" />
                <span>Customer Arrival Request Alert Match ({matchingSubs.length})</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Customers requested notifications for <strong>{make} {model}</strong>:
              </p>
              <div className="space-y-0.5 pt-1">
                {matchingSubs.map((sub) => (
                  <div key={sub.id} className="text-[11px] font-mono font-bold text-amber-200">
                    • {sub.contactPhoneOrEmail} {sub.contactName ? `(${sub.contactName})` : ""}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Date / Time & Stock Number Row */}
          <div className="grid grid-cols-2 gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div>
              <Label className="text-slate-300 flex items-center gap-1 text-[11px]">
                <Clock className="w-3.5 h-3.5 text-emerald-400" /> Exact Arrival Date & Time *
              </Label>
              <Input
                type="datetime-local"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white font-mono text-xs mt-1 h-9"
              />
            </div>

            <div>
              <Label className="text-slate-300 text-[11px]">Stock Number *</Label>
              <Input
                value={stockNumber}
                onChange={(e) => setStockNumber(e.target.value)}
                className="bg-slate-950 border-slate-800 text-amber-300 font-mono font-bold text-xs mt-1 h-9"
              />
            </div>
          </div>

          {/* Location Assignment */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-slate-300 text-[11px]">Yard Section *</Label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value as any)}
                className="w-full h-9 bg-slate-900 border border-slate-800 rounded-md text-xs text-white px-2 mt-1"
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
              <Label className="text-slate-300 text-[11px]">Yard Row</Label>
              <Input
                value={rowNumber}
                onChange={(e) => setRowNumber(e.target.value)}
                placeholder="Row 05"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1 h-9"
              />
            </div>

            <div>
              <Label className="text-slate-300 text-[11px]">Space #</Label>
              <Input
                value={spaceNumber}
                onChange={(e) => setSpaceNumber(e.target.value)}
                placeholder="Space 12"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1 h-9"
              />
            </div>
          </div>

          {/* VIN & AI OCR */}
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
                <Ban className="w-3 h-3" /> Skip VIN
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase())}
                placeholder="1FTRF12W88KA10291"
                className="bg-slate-900 border-slate-800 text-amber-300 font-mono font-bold text-xs flex-1 h-10"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => vinCameraRef.current?.click()}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs gap-1 shrink-0"
              >
                <Scan className="w-3.5 h-3.5 text-amber-300" /> AI Scan VIN
              </Button>
            </div>
          </div>

          {/* Specs: Year, Make, Model, Color */}
          <div className="grid grid-cols-4 gap-2">
            <div>
              <Label className="text-slate-300 text-[11px]">Year *</Label>
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
                onBlur={handleMakeModelBlur}
                placeholder="Ford"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1 h-9"
              />
            </div>

            <div>
              <Label className="text-slate-300 text-[11px]">Model *</Label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                onBlur={handleMakeModelBlur}
                placeholder="F-150"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1 h-9"
              />
            </div>

            <div>
              <Label className="text-slate-300 text-[11px]">Color</Label>
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="Silver"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1 h-9"
              />
            </div>
          </div>

          {/* Internal Purchase Price & Source */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
            <div>
              <Label className="text-slate-300 text-[11px]">Internal Scrap Purchase ($)</Label>
              <Input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
                className="bg-slate-900 border-slate-800 text-emerald-400 font-mono font-bold text-xs mt-1 h-9"
              />
              <span className="text-[10px] text-slate-500 block mt-0.5">Hidden from public portal</span>
            </div>

            <div>
              <Label className="text-slate-300 text-[11px]">Tow Source Origin</Label>
              <Input
                value={originSource}
                onChange={(e) => setOriginSource(e.target.value)}
                placeholder="Tow Drop / Impound"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1 h-9"
              />
            </div>
          </div>

          {/* Photo upload preview */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-[11px]">Vehicle Photo</Label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-12 rounded bg-slate-900 overflow-hidden border border-slate-800 shrink-0 flex items-center justify-center">
                <img src={photoUrl} alt="Vehicle preview" className="w-full h-full object-cover" />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="border-slate-700 bg-slate-900 text-slate-200 hover:text-white text-xs gap-1.5 h-9"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" /> Upload Photo
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-slate-300 text-[11px]">Remaining Key Parts List (Comma Separated)</Label>
            <Input
              value={parts}
              onChange={(e) => setParts(e.target.value)}
              placeholder="Engine Assembly, Transmission, Doors, Wheels"
              className="bg-slate-900 border-slate-800 text-white text-xs mt-1 h-9"
            />
          </div>

        </div>

        <DialogFooter className="pt-2 border-t border-slate-800">
          <Button variant="ghost" onClick={onClose} className="text-slate-400">
            Cancel
          </Button>
          <Button
            onClick={handleSaveEntry}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs gap-1.5 shadow"
          >
            <CheckCircle2 className="w-4 h-4" /> Record Vehicle Arrival Entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};