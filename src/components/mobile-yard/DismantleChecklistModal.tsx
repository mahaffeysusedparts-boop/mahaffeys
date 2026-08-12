"use client";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Wrench,
  Droplets,
  Flame,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

interface DismantleChecklistModalProps {
  vehicle: PullYardVehicle | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const DismantleChecklistModal: React.FC<DismantleChecklistModalProps> = ({
  vehicle,
  isOpen,
  onClose,
  onSuccess,
}) => {
  if (!vehicle) return null;

  const [catsRemoved, setCatsRemoved] = useState<number>(vehicle.dismantlingLog.catalyticConvertersRemoved || 0);
  const [wheelsRemoved, setWheelsRemoved] = useState<number>(vehicle.dismantlingLog.wheelsRemoved || 0);
  const [gasDrained, setGasDrained] = useState<boolean>(vehicle.dismantlingLog.gasDrained || false);
  const [oilDrained, setOilDrained] = useState<boolean>(vehicle.dismantlingLog.oilDrained || false);
  const [coolantDrained, setCoolantDrained] = useState<boolean>(vehicle.dismantlingLog.coolantDrained || false);
  const [batteryPulled, setBatteryPulled] = useState<boolean>(vehicle.dismantlingLog.batteryPulled || false);
  const [status, setStatus] = useState<PullYardVehicleStatus>(vehicle.status);
  const [notes, setNotes] = useState<string>(vehicle.dismantlingLog.notes || "");

  const currentOp = storageService.getSettings().operatorName;

  const handleSaveChecklist = () => {
    storageService.savePullYardVehicle({
      ...vehicle,
      status,
      dismantlingLog: {
        catalyticConvertersRemoved: Math.max(0, catsRemoved),
        wheelsRemoved: Math.min(8, Math.max(0, wheelsRemoved)),
        gasDrained,
        oilDrained,
        coolantDrained,
        batteryPulled,
        notes: notes.trim() || undefined,
        updatedAt: new Date().toISOString(),
        updatedBy: currentOp,
      },
    });

    toast.success(
      `Updated Environmental Prep for ${vehicle.year} ${vehicle.make} ${vehicle.model}!`,
      { description: `Status set to ${status}` }
    );
    onSuccess();
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
                Field Environmental Prep & Fluid Checklist
              </DialogTitle>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-mono">
              EPA COMPLIANT
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          
          {/* Target Vehicle Header Box */}
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-white text-sm">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </span>
              <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-300 font-mono">
                {vehicle.section}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Location: {vehicle.rowNumber || "Row 01"} - {vehicle.spaceNumber || "Spot 01"} | VIN: {vehicle.vin}
            </p>
          </div>

          {/* Touch-Friendly Toggles */}
          <div className="space-y-2 bg-slate-900 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-2">
              Environmental Fluid & Part Removal Checklist:
            </span>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
              <span className="font-bold text-white text-xs">Gasoline / Fuel Tank Drained</span>
              <Switch checked={gasDrained} onCheckedChange={setGasDrained} />
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
              <span className="font-bold text-white text-xs">Engine & Transmission Oil Drained</span>
              <Switch checked={oilDrained} onCheckedChange={setOilDrained} />
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
              <span className="font-bold text-white text-xs">Radiator Coolant Drained</span>
              <Switch checked={coolantDrained} onCheckedChange={setCoolantDrained} />
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
              <span className="font-bold text-white text-xs">12V Battery Pulled for Vault</span>
              <Switch checked={batteryPulled} onCheckedChange={setBatteryPulled} />
            </div>
          </div>

          {/* Catalytic Converters & Wheels Count Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-300 font-bold">Catalytic Converters Removed</Label>
              <Input
                type="number"
                value={catsRemoved}
                onChange={(e) => setCatsRemoved(parseInt(e.target.value) || 0)}
                className="bg-slate-900 border-slate-800 text-amber-300 font-mono font-bold text-sm mt-1 h-10"
              />
            </div>

            <div>
              <Label className="text-slate-300 font-bold">Wheels / Rims Removed</Label>
              <Input
                type="number"
                value={wheelsRemoved}
                onChange={(e) => setWheelsRemoved(parseInt(e.target.value) || 0)}
                className="bg-slate-900 border-slate-800 text-sky-300 font-mono font-bold text-sm mt-1 h-10"
              />
            </div>
          </div>

          {/* Vehicle Status Readiness */}
          <div>
            <Label className="text-slate-300 font-bold">Vehicle Readiness Status *</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as PullYardVehicleStatus)}
              className="w-full h-11 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white px-3 mt-1 font-mono font-bold"
            >
              <option value="PENDING">PENDING (Inbound Processing)</option>
              <option value="AVAILABLE">AVAILABLE (Staged on Yard for Pullers)</option>
              <option value="CRUSHED">CRUSHED / STRIPPED (Ready for Bailer)</option>
            </select>
          </div>

          <div>
            <Label className="text-slate-300 font-bold">Processor Comments / Notes</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Engine oil drained, catalytic converter removed & logged into vault..."
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
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs gap-1.5 shadow-lg shadow-emerald-950 h-11"
          >
            <CheckCircle2 className="w-4 h-4" /> Save Environmental Prep
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};