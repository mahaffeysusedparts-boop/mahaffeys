"use client";

import React, { useState } from "react";
import { PullYardVehicle } from "@/types/scrap";
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
  ArrowRight,
  CheckCircle2,
  User,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface YardRelocateModalProps {
  vehicle: PullYardVehicle | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const YardRelocateModal: React.FC<YardRelocateModalProps> = ({
  vehicle,
  isOpen,
  onClose,
  onSuccess,
}) => {
  if (!vehicle) return null;

  const [newSection, setNewSection] = useState<PullYardVehicle["section"]>(vehicle.section);
  const [newRow, setNewRow] = useState<string>(vehicle.rowNumber || "Row 12");
  const [newSpace, setNewSpace] = useState<string>(vehicle.spaceNumber || "Space 01");
  const [relocReason, setRelocReason] = useState<string>("Forklift Staging to Parts Row");

  const currentOp = storageService.getSettings().operatorName;

  const handleSaveRelocation = () => {
    const updated = storageService.relocateVehicle(
      vehicle.id,
      newSection,
      newRow.trim() || "Row 12",
      newSpace.trim() || "Space 01",
      currentOp,
      relocReason
    );

    if (updated) {
      toast.success(
        `Relocated ${vehicle.year} ${vehicle.make} ${vehicle.model} to ${newSection} (${newRow} - ${newSpace})!`
      );
      onSuccess();
      onClose();
    } else {
      toast.error("Could not update vehicle location.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[460px] font-sans">
        <DialogHeader className="border-b border-slate-800 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-400" />
              <DialogTitle className="text-base font-bold text-white font-mono">
                Yard Vehicle Spotter & Relocator
              </DialogTitle>
            </div>
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-mono">
              RELOCATE
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
                {vehicle.status}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              VIN: {vehicle.vin} | Color: {vehicle.color || "White"}
            </p>
          </div>

          {/* Location Transfer Visual */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 text-center font-mono">
            <div className="space-y-1 border-r border-slate-800 pr-2">
              <span className="text-[10px] text-slate-500 font-bold block uppercase">CURRENT LOCATION</span>
              <span className="text-amber-400 font-bold block text-xs truncate">{vehicle.section}</span>
              <span className="text-slate-300 text-[11px] block">{vehicle.rowNumber || "Row 01"} - {vehicle.spaceNumber || "Drop Bay"}</span>
            </div>

            <div className="space-y-1 pl-2">
              <span className="text-[10px] text-emerald-400 font-bold block uppercase">NEW TARGET LOCATION</span>
              <span className="text-emerald-300 font-bold block text-xs truncate">{newSection}</span>
              <span className="text-white text-[11px] block">{newRow} - {newSpace}</span>
            </div>
          </div>

          {/* New Location Selectors */}
          <div className="space-y-3 pt-1">
            <div>
              <Label className="text-slate-300 font-bold">Select Target Section *</Label>
              <select
                value={newSection}
                onChange={(e) => setNewSection(e.target.value as any)}
                className="w-full h-11 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white px-3 mt-1 font-semibold"
              >
                <option value="Domestic Trucks & SUVs">Domestic Trucks & SUVs</option>
                <option value="Ford & Lincoln">Ford & Lincoln</option>
                <option value="GM & Chevrolet">GM & Chevrolet</option>
                <option value="Chrysler & Dodge">Chrysler & Dodge</option>
                <option value="Asian Imports">Asian Imports</option>
                <option value="European">European</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-slate-300 font-bold">New Row Number *</Label>
                <Input
                  value={newRow}
                  onChange={(e) => setNewRow(e.target.value)}
                  placeholder="Row 14"
                  className="bg-slate-900 border-slate-800 text-white font-mono text-xs mt-1 h-10 font-bold"
                />
              </div>

              <div>
                <Label className="text-slate-300 font-bold">New Space # *</Label>
                <Input
                  value={newSpace}
                  onChange={(e) => setNewSpace(e.target.value)}
                  placeholder="Space 08"
                  className="bg-slate-900 border-slate-800 text-white font-mono text-xs mt-1 h-10 font-bold"
                />
              </div>
            </div>

            <div>
              <Label className="text-slate-300 font-bold">Reason for Movement</Label>
              <Input
                value={relocReason}
                onChange={(e) => setRelocReason(e.target.value)}
                placeholder="Forklift staging / Row organizing..."
                className="bg-slate-900 border-slate-800 text-slate-200 text-xs mt-1 h-10"
              />
            </div>
          </div>

        </div>

        <DialogFooter className="pt-2 border-t border-slate-800">
          <Button variant="ghost" onClick={onClose} className="text-slate-400">
            Cancel
          </Button>
          <Button
            onClick={handleSaveRelocation}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs gap-1.5 shadow-lg shadow-emerald-950 h-11"
          >
            <CheckCircle2 className="w-4 h-4" /> Save Forklift Relocation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};