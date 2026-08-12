import React, { useState, useRef } from 'react';
import { PullYardVehicle, PullYardVehicleStatus, VehicleArrivalSubscription } from '@/types/scrap';
import { storageService } from '@/services/storageService';
import { generateSamplePhoto } from '@/utils/complianceUtils';
import { analyzeVinImage } from '@/services/aiVisionService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Car,
  Camera,
  Upload,
  Scan,
  Ban,
  Search,
  CheckCircle2,
  Bell,
  Clock,
  MapPin,
  DollarSign,
  Truck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';

interface VehicleIntakeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVehicleAdded: (vehicle: PullYardVehicle) => void;
}

export const VehicleIntakeModal: React.FC<VehicleIntakeModalProps> = ({
  open,
  onOpenChange,
  onVehicleAdded,
}) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [arrivalTimestamp, setArrivalTimestamp] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [stockNumber, setStockNumber] = useState<string>(
    `STK-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
  );
  const [vin, setVin] = useState<string>('');
  const [year, setYear] = useState<number>(new Date().getFullYear() - 10);
  const [make, setMake] = useState<string>('Ford');
  const [model, setModel] = useState<string>('F-150');
  const [color, setColor] = useState<string>('White');
  const [section, setSection] = useState<PullYardVehicle['section']>('Domestic Trucks & SUVs');
  const [rowNumber, setRowNumber] = useState<string>('Row 1');
  const [spaceNumber, setSpaceNumber] = useState<string>('Space 01');
  const [status, setStatus] = useState<PullYardVehicleStatus>('AVAILABLE');
  const [purchasePrice, setPurchasePrice] = useState<number>(450);
  const [originSource, setOriginSource] = useState<string>('Tow Origin / Auction');
  const [notes, setNotes] = useState<string>('');
  const [parts, setParts] = useState<string>('Engine, Transmission, Doors, Wheels, Fenders');
  const [photoUrl, setPhotoUrl] = useState<string>(generateSamplePhoto('vehicle'));

  // Subscriber Matching Alerts
  const [matchedSubscriptions, setMatchedSubscriptions] = useState<VehicleArrivalSubscription[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          setPhotoUrl(evt.target.result as string);
          toast.success('Vehicle photo captured');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVinPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.info("AI Vision decoding VIN plate photo...", { icon: "✨" });
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const dataUrl = evt.target?.result as string;
        try {
          const res = await analyzeVinImage(dataUrl);
          if (res.vin) {
            setVin(res.vin);
            toast.success(`AI Extracted VIN: ${res.vin}`);
            handleDecodeVinWithVin(res.vin);
          } else {
            toast.error("Could not extract VIN. Please check photo clarity.");
          }
        } catch (err) {
          console.warn("VIN OCR error:", err);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDecodeVinWithVin = (vinString: string) => {
    if (!vinString || vinString.length < 5) return;
    const clean = vinString.toUpperCase().trim();
    setVin(clean);

    let decodedMake = 'Dodge';
    let decodedModel = 'Ram 1500';

    if (clean.startsWith('1G')) {
      decodedMake = 'Chevrolet';
      decodedModel = 'Impala';
      setSection('GM & Chevrolet');
    } else if (clean.startsWith('1F')) {
      decodedMake = 'Ford';
      decodedModel = 'F-150';
      setSection('Ford & Lincoln');
    } else if (clean.startsWith('4T') || clean.startsWith('J')) {
      decodedMake = 'Toyota';
      decodedModel = 'Camry';
      setSection('Asian Imports');
    } else if (clean.startsWith('1N') || clean.startsWith('5N')) {
      decodedMake = 'Nissan';
      decodedModel = 'Altima';
      setSection('Asian Imports');
    }

    setMake(decodedMake);
    setModel(decodedModel);
    checkSubscriberMatches(decodedMake, decodedModel, year);
  };

  const checkSubscriberMatches = (targetMake: string, targetModel: string, targetYear: number) => {
    const matches = storageService.matchVehicleSubscriptions(targetMake, targetModel, targetYear);
    setMatchedSubscriptions(matches);
    if (matches.length > 0) {
      toast.info(`Match Alert: ${matches.length} customer(s) requested notification for ${targetMake} ${targetModel}!`, {
        icon: '🔔',
      });
    }
  };

  const handleMakeModelChange = (mMake: string, mModel: string) => {
    setMake(mMake);
    setModel(mModel);
    checkSubscriberMatches(mMake, mModel, year);
  };

  const handleSkipVin = () => {
    const noVin = `NO-VIN-${Math.floor(1000 + Math.random() * 9000)}`;
    setVin(noVin);
    toast.info(`Bypassed VIN. Assigned: ${noVin}`);
  };

  const handleSaveIntake = () => {
    if (!make.trim() || !model.trim()) {
      toast.error('Vehicle Make and Model are required');
      return;
    }

    const dateSetIso = arrivalTimestamp ? new Date(arrivalTimestamp).toISOString() : new Date().toISOString();
    const partsList = parts.split(',').map((p) => p.trim()).filter(Boolean);

    const currentOp = storageService.getSettings().operatorName;

    const newVehicle: PullYardVehicle = {
      id: `veh-intake-${Date.now()}`,
      section,
      year,
      make: make.trim(),
      model: model.trim(),
      color: color.trim() || 'White',
      vin: vin.toUpperCase().trim() || `NO-VIN-${Math.floor(1000 + Math.random() * 9000)}`,
      dateSetInYard: dateSetIso,
      status,
      partsRemaining: partsList.length > 0 ? partsList : ['Body Shell'],
      purchasePrice,
      originSource: originSource.trim() || undefined,
      notes: notes.trim() || undefined,
      photoUrl,
      stockNumber,
      rowNumber,
      spaceNumber,
      operatorName: currentOp,
      dismantlingLog: {
        catalyticConvertersRemoved: 0,
        wheelsRemoved: 0,
        gasDrained: false,
        oilDrained: false,
      },
    };

    storageService.savePullYardVehicle(newVehicle);
    onVehicleAdded(newVehicle);
    onOpenChange(false);

    toast.success(`Vehicle Entry Logged! Stock #${stockNumber}`, {
      description: `${year} ${make} ${model} placed in ${section} (${rowNumber})`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        
        <input
          type="file"
          ref={cameraInputRef}
          onChange={handleFileUpload}
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
                Log New Vehicle Arrival & Yard Staging
              </DialogTitle>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-mono">
              INTAKE WORKSTATION
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          
          {/* Subscriber Alert Callout */}
          {matchedSubscriptions.length > 0 && (
            <div className="p-3 bg-amber-950/60 border-2 border-amber-500/50 rounded-xl space-y-1 text-amber-200">
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5 text-xs text-amber-300">
                  <Bell className="w-4 h-4 text-amber-400 animate-bounce" />
                  {matchedSubscriptions.length} Customer Arrival Alert Match(es) Found!
                </span>
                <Badge className="bg-amber-500 text-slate-950 font-black text-[9px]">MATCH</Badge>
              </div>
              <div className="text-[11px] text-slate-300 space-y-1">
                {matchedSubscriptions.map((s) => (
                  <div key={s.id} className="flex justify-between font-mono bg-slate-950/60 p-1.5 rounded border border-amber-500/30">
                    <span>{s.contactName} ({s.contactPhoneOrEmail})</span>
                    <span className="font-bold text-amber-400">Req: {s.make} {s.model}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamp & Stock Number Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div>
              <Label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" /> Arrival Timestamp *
              </Label>
              <Input
                type="datetime-local"
                value={arrivalTimestamp}
                onChange={(e) => setArrivalTimestamp(e.target.value)}
                className="bg-slate-950 border-slate-800 text-amber-300 font-mono font-bold text-xs mt-1 h-10"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-300">Yard Stock Tag # *</Label>
              <Input
                value={stockNumber}
                onChange={(e) => setStockNumber(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white font-mono font-bold text-xs mt-1 h-10"
              />
            </div>
          </div>

          {/* VIN Code & OCR Scan */}
          <div className="space-y-1 bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-300">17-Digit VIN Number</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleSkipVin}
                className="h-6 text-[11px] text-rose-400 hover:text-rose-300 p-0 font-bold"
              >
                <Ban className="w-3 h-3 mr-1" /> Skip / No VIN
              </Button>
            </div>

            <div className="flex gap-2">
              <Input
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase())}
                placeholder="1FTRF12W88KA10291 or NO-VIN"
                className="bg-slate-950 border-slate-800 text-amber-300 font-mono font-bold text-xs h-10 uppercase flex-1"
              />

              <label className="cursor-pointer inline-flex items-center gap-1 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-3 rounded-md h-10 transition-colors shrink-0">
                <Scan className="w-3.5 h-3.5 text-amber-300" /> Scan VIN Photo
                <input
                  type="file"
                  onChange={handleVinPhotoUpload}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                />
              </label>

              <Button
                type="button"
                variant="outline"
                onClick={() => handleDecodeVinWithVin(vin)}
                className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs h-10 shrink-0"
              >
                <Search className="w-3.5 h-3.5 text-amber-400" /> Decode
              </Button>
            </div>
          </div>

          {/* Vehicle Year Make Model Specs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-slate-300">Year *</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => {
                  const y = parseInt(e.target.value) || 2010;
                  setYear(y);
                  checkSubscriberMatches(make, model, y);
                }}
                className="bg-slate-900 border-slate-800 text-white font-mono text-xs mt-1 h-10"
              />
            </div>

            <div>
              <Label className="text-slate-300">Make *</Label>
              <Input
                value={make}
                onChange={(e) => handleMakeModelChange(e.target.value, model)}
                placeholder="Ford"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1 h-10"
              />
            </div>

            <div>
              <Label className="text-slate-300">Model *</Label>
              <Input
                value={model}
                onChange={(e) => handleMakeModelChange(make, e.target.value)}
                placeholder="F-150"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1 h-10"
              />
            </div>

            <div>
              <Label className="text-slate-300">Color</Label>
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="White"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1 h-10"
              />
            </div>
          </div>

          {/* Section & Yard Row Placement */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-slate-300">Yard Section *</Label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value as any)}
                className="w-full h-10 bg-slate-900 border border-slate-800 rounded-md text-xs text-white px-2 mt-1"
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
              <Label className="text-slate-300">Row Number *</Label>
              <Input
                value={rowNumber}
                onChange={(e) => setRowNumber(e.target.value)}
                placeholder="Row 1"
                className="bg-slate-900 border-slate-800 text-amber-300 font-bold text-xs mt-1 h-10"
              />
            </div>

            <div>
              <Label className="text-slate-300">Space / Spot #</Label>
              <Input
                value={spaceNumber}
                onChange={(e) => setSpaceNumber(e.target.value)}
                placeholder="Space 04"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1 h-10"
              />
            </div>
          </div>

          {/* Photo Capture Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div className="aspect-video bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
              {photoUrl ? (
                <img src={photoUrl} alt="Intake preview" className="w-full h-full object-cover" />
              ) : (
                <Car className="w-8 h-8 text-slate-600" />
              )}
            </div>

            <div className="sm:col-span-2 space-y-2">
              <Label className="text-slate-300">Vehicle Photo (45° Angle Shot)</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => cameraInputRef.current?.click()}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs gap-1"
                >
                  <Camera className="w-3.5 h-3.5" /> Camera
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="border-slate-700 bg-slate-800 text-slate-200 text-xs gap-1"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-400" /> Upload File
                </Button>
              </div>
            </div>
          </div>

          {/* Internal Details (Private / Staff Only) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
            <div>
              <Label className="text-slate-300">Purchase / Scrap Payout ($) [Private Staff Only]</Label>
              <Input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
                className="bg-slate-900 border-slate-800 text-emerald-400 font-mono font-bold text-xs mt-1 h-10"
              />
            </div>

            <div>
              <Label className="text-slate-300">Origin / Tow Source [Private]</Label>
              <Input
                value={originSource}
                onChange={(e) => setOriginSource(e.target.value)}
                placeholder="Tow Drop / Address"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1 h-10"
              />
            </div>
          </div>

          <div>
            <Label className="text-slate-300">Available Intact Parts (Comma Separated)</Label>
            <Input
              value={parts}
              onChange={(e) => setParts(e.target.value)}
              placeholder="Engine, Transmission, Doors, Wheels, Fenders"
              className="bg-slate-900 border-slate-800 text-white text-xs mt-1 h-10"
            />
          </div>

          <div>
            <Label className="text-slate-300">Condition Notes</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Runs and drives, minor dent on left fender..."
              className="bg-slate-900 border-slate-800 text-white text-xs"
            />
          </div>

        </div>

        <DialogFooter className="pt-2 border-t border-slate-800">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-400">
            Cancel
          </Button>
          <Button onClick={handleSaveIntake} className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-950">
            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Log Vehicle Entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};