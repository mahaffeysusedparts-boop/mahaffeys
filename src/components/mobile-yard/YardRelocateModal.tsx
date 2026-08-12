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
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Car,
  CheckCircle2,
  MoveRight,
  Warehouse,
  AlertTriangle,
  Flame,
} from "lucide-react";
import { toast } from "sonner";

interface YardRelocateModalProps {
  vehicle: PullYardVehicle | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const YardRelocateModal: React.FC<YardRelocateModalProps> = ({
  vehicle,
  isOpen,
  onClose,
  onSuccess,
}) => {
  if (!vehicle) return null;

  const [section, setSection] = useState<PullYardVehicle["section"]>(vehicle.section);
  const [rowNumber, setRowNumber] = useState<string>(vehicle.rowNumber || "Row 12");
  const [spaceNumber, setSpaceNumber] = useState<string>(vehicle.spaceNumber || "Space 04");
  const [status, setStatus] = useState<PullYardVehicleStatus>(vehicle.status);
  const [relocateNotes, setRelocateNotes] = useState<string>("");

  const handleSaveRelocation = () => {
    const operatorName = storageService.getSettings().operatorName;
    const currentNotes = vehicle.notes || "";
    const updateTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const appendNote = ` [Moved to ${rowNumber} ${spaceNumber} at ${updateTime} by ${operatorName}]`;

    const updated: PullYardVehicle = {
      ...vehicle,
      section,
      rowNumber,
      spaceNumber,
      status,
      notes: relocateNotes.trim() ? `${currentNotes}${appendNote} Note: ${relocateNotes}` : `${currentNotes}${appendNote}`,
    };

    storageService.savePullYardVehicle(updated);
    toast.success(`Relocated ${vehicle.year} ${vehicle.make} ${vehicle.model}!`, {
      description: `New Location: ${section} • ${rowNumber} (${spaceNumber})`,
    });

    if (onSuccess) onSuccess();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[460px] font-sans">
        <DialogHeader className="border-b border-slate-800 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-400" />
              <DialogTitle className="text-base font-bold text-white font-mono">
                Relocate Vehicle Grid Spot
              </DialogTitle>
            </div>
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-mono">
              YARD SPOTTER
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          
          {/* Target Vehicle Summary */}
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-white text-sm">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </span>
              <Badge variant="outline" className="border-slate-700 text-slate-300 text-[10px]">
                {vehicle.color || "White"}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              VIN: {vehicle.vin} | Current: <span className="text-amber-300 font-bold">{vehicle.rowNumber || "Staging"} ({vehicle.spaceNumber || "Spot 01"})</span>
            </p>
          </div>

          {/* Quick Target Preset Launchers */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 font-bold block text-[11px]">Quick Location Presets:</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setRowNumber("Inbound Staging");
                  setSpaceNumber("Spot 01");
                  setStatus("PENDING");
                }}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500 text-slate-300 text-[11px] font-bold text-center"
              >
                Inbound Staging
              </button>

              <button
                type="button"
                onClick={() => {
                  setRowNumber("Row 12");
                  setSpaceNumber("Spot 05");
                  setStatus("AVAILABLE");
                }}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-emerald-500 text-slate-300 text-[11px] font-bold text-center"
              >
                Parts Yard Rows
              </button>

              <button
                type="button"
                onClick={() => {
                  setRowNumber("Crush Bay 01");
                  setSpaceNumber("Queue");
                  setStatus("CRUSHED");
                }}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-rose-500 text-rose-300 text-[11px] font-bold text-center"
              >
                Crush Queue
              </button>
            </div>
          </div>

          {/* Destination Form */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-900 rounded-xl border border-slate-800">
            <div className="col-span-2">
              <Label className="text-slate-300 font-bold">Yard Section *</Label>
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
              <Label className="text-slate-300 font-bold">Target Row *</Label>
              <Input
                value={rowNumber}
                onChange={(e) => setRowNumber(e.target.value)}
                placeholder="Row 14"
                className="bg-slate-950 border-slate-800 text-amber-300 font-bold text-xs mt-1 h-10"
              />
            </div>

            <div>
              <Label className="text-slate-300 font-bold">Target Spot *</Label>
              <Input
                value={spaceNumber}
                onChange={(e) => setSpaceNumber(e.target.value)}
                placeholder="Spot B"
                className="bg-slate-950 border-slate-800 text-white font-bold text-xs mt-1 h-10"
              />
            </div>
          </div>

          {/* Status Shift */}
          <div>
            <Label className="text-slate-300 font-bold">Vehicle Yard Status</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full h-10 bg-slate-900 border border-slate-800 rounded-md text-xs text-white px-2 mt-1 font-mono font-bold"
            >
              <option value="PENDING">PENDING (Inbound Processing)</option>
              <option value="AVAILABLE">AVAILABLE (Staged on Parts Lot)</option>
              <option value="CRUSHED">CRUSHED (Archived / Bailer Queue)</option>
            </select>
          </div>

          <div>
            <Label className="text-slate-300">Spotter Move Notes</Label>
            <Input
              value={relocateNotes}
              onChange={(e) => setRelocateNotes(e.target.value)}
              placeholder="e.g. Moved with Forklift #2 to make room for truck drop"
              className="bg-slate-900 border-slate-800 text-white text-xs mt-1 h-10"
            />
          </div>

        </div>

        <DialogFooter className="pt-2 border-t border-slate-800">
          <Button variant="ghost" onClick={onClose} className="text-slate-400">
            Cancel
          </Button>
          <Button
            onClick={handleSaveRelocation}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs gap-1.5 h-10 shadow"
          >
            <MoveRight className="w-4 h-4" /> Save Spot Relocation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};