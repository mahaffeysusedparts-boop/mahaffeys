import React, { useState } from "react";
import { PullYardVehicle, PullYardVehicleStatus } from "@/types/scrap";
import { storageService } from "@/services/storageService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Wrench,
  Droplets,
  CheckCircle2,
  Flame,
  Minus,
  Plus,
  Car,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

interface DismantleChecklistModalProps {
  vehicle: PullYardVehicle | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const DismantleChecklistModal: React.FC<DismantleChecklistModalProps> = ({
  vehicle,
  isOpen,
  onClose,
  onSuccess,
}) => {
  if (!vehicle) return null;

  const [catsRemoved, setCatsRemoved] = useState<number>(
    vehicle.dismantlingLog?.catalyticConvertersRemoved || 0
  );
  const [wheelsRemoved, setWheelsRemoved] = useState<number>(
    vehicle.dismantlingLog?.wheelsRemoved || 0
  );
  const [gasDrained, setGasDrained] = useState<boolean>(
    vehicle.dismantlingLog?.gasDrained || false
  );
  const [oilDrained, setOilDrained] = useState<boolean>(
    vehicle.dismantlingLog?.oilDrained || false
  );
  const [processorNotes, setProcessorNotes] = useState<string>(
    vehicle.dismantlingLog?.notes || ""
  );

  const [autoAdvanceStatus, setAutoAdvanceStatus] = useState<boolean>(true);

  const handleSaveChecklist = () => {
    const operatorName = storageService.getSettings().operatorName;
    const isFullyPrepped = gasDrained && oilDrained;

    let targetStatus: PullYardVehicleStatus = vehicle.status;
    if (autoAdvanceStatus && isFullyPrepped && vehicle.status === "PENDING") {
      targetStatus = "AVAILABLE";
    }

    const updated: PullYardVehicle = {
      ...vehicle,
      status: targetStatus,
      dismantlingLog: {
        catalyticConvertersRemoved: Math.max(0, catsRemoved),
        wheelsRemoved: Math.min(8, Math.max(0, wheelsRemoved)),
        gasDrained,
        oilDrained,
        notes: processorNotes.trim() ? `[Dismantler: ${operatorName}] ${processorNotes}` : undefined,
        updatedAt: new Date().toISOString(),
      },
    };

    storageService.savePullYardVehicle(updated);
    toast.success(`Dismantling Checklist Saved for ${vehicle.year} ${vehicle.make} ${vehicle.model}!`, {
      description: targetStatus === "AVAILABLE" && vehicle.status === "PENDING"
        ? "Environmental prep verified! Vehicle status advanced to AVAILABLE on yard."
        : `Cats: ${catsRemoved} | Gas Drained: ${gasDrained ? 'YES' : 'NO'}`,
    });

    if (onSuccess) onSuccess();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[480px] font-sans">
        <DialogHeader className="border-b border-slate-800 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplets className="w-5 h-5 text-emerald-400" />
              <DialogTitle className="text-base font-bold text-white font-mono">
                Field Environmental Prep & Dismantling Checklist
              </DialogTitle>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-mono">
              EPA PREP
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          
          {/* Target Vehicle Specs Banner */}
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="font-extrabold text-white text-sm">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </span>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Location: <span className="text-amber-300 font-bold">{vehicle.rowNumber || "Row 12"} ({vehicle.spaceNumber || "Spot 01"})</span>
              </p>
            </div>
            <Badge variant="outline" className="border-slate-700 text-slate-300 text-[10px]">
              {vehicle.status}
            </Badge>
          </div>

          {/* Environmental Fluids Checklist Switches */}
          <div className="space-y-3 p-3.5 bg-slate-900 rounded-xl border border-slate-800">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block border-b border-slate-800 pb-1.5">
              1. Environmental Fluid Depollution
            </span>

            <div className="flex items-center justify-between py-1">
              <div>
                <span className="text-xs font-bold text-white block">Gasoline / Diesel Tank Drained</span>
                <span className="text-[10px] text-slate-400">Fuel evacuated to safe holding vault</span>
              </div>
              <Switch checked={gasDrained} onCheckedChange={setGasDrained} />
            </div>

            <div className="flex items-center justify-between py-1 border-t border-slate-800/80">
              <div>
                <span className="text-xs font-bold text-white block">Engine & Transmission Oil Drained</span>
                <span className="text-[10px] text-slate-400">Crankcase and oil pan drained</span>
              </div>
              <Switch checked={oilDrained} onCheckedChange={setOilDrained} />
            </div>
          </div>

          {/* Component Removal Counters */}
          <div className="space-y-3 p-3.5 bg-slate-900 rounded-xl border border-slate-800">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block border-b border-slate-800 pb-1.5">
              2. High-Value Component Removals
            </span>

            {/* Cats counter */}
            <div className="flex items-center justify-between py-1">
              <div>
                <span className="text-xs font-bold text-white block">Catalytic Converters Removed</span>
                <span className="text-[10px] text-slate-400">Logged to precious metal vault</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setCatsRemoved((c) => Math.max(0, c - 1))}
                  className="h-7 w-7 text-slate-300 hover:text-white"
                >
                  <Minus className="w-3.5 h-3.5" />
                </Button>
                <span className="font-mono font-bold text-amber-300 text-sm w-6 text-center">{catsRemoved}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setCatsRemoved((c) => c + 1)}
                  className="h-7 w-7 text-slate-300 hover:text-white"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Wheels counter */}
            <div className="flex items-center justify-between py-1 border-t border-slate-800/80">
              <div>
                <span className="text-xs font-bold text-white block">Alloy / Steel Wheels Removed</span>
                <span className="text-[10px] text-slate-400">Tires & rims unbolted</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setWheelsRemoved((w) => Math.max(0, w - 1))}
                  className="h-7 w-7 text-slate-300 hover:text-white"
                >
                  <Minus className="w-3.5 h-3.5" />
                </Button>
                <span className="font-mono font-bold text-sky-300 text-sm w-6 text-center">{wheelsRemoved}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setWheelsRemoved((w) => Math.min(8, w + 1))}
                  className="h-7 w-7 text-slate-300 hover:text-white"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Dismantler Notes */}
          <div>
            <Label className="text-slate-300 font-bold">Processor / Dismantler Notes</Label>
            <Textarea
              rows={2}
              value={processorNotes}
              onChange={(e) => setProcessorNotes(e.target.value)}
              placeholder="e.g. Fluids drained clean, radiator removed, engine in good shape for pullers..."
              className="bg-slate-900 border-slate-800 text-slate-200 text-xs mt-1"
            />
          </div>

        </div>

        <DialogFooter className="pt-2 border-t border-slate-800">
          <Button variant="ghost" onClick={onClose} className="text-slate-400">
            Cancel
          </Button>
          <Button
            onClick={handleSaveChecklist}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs gap-1.5 h-11 px-6 shadow-lg shadow-emerald-950"
          >
            <CheckCircle2 className="w-4 h-4" /> Save Environmental Prep Log
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};