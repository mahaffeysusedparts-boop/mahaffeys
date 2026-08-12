import React from "react";
import { PullYardVehicle, YardSettings } from "@/types/scrap";
import { storageService } from "@/services/storageService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, QrCode, ShieldCheck, MapPin, Calendar, Clock, Wrench, AlertTriangle, Car } from "lucide-react";

interface YardWindowTagModalProps {
  vehicle: PullYardVehicle | null;
  isOpen: boolean;
  onClose: () => void;
}

export const YardWindowTagModal: React.FC<YardWindowTagModalProps> = ({
  vehicle,
  isOpen,
  onClose,
}) => {
  if (!vehicle) return null;

  const settings: YardSettings = storageService.getSettings();
  const arrivalDate = new Date(vehicle.dateSetInYard);
  const formattedDate = arrivalDate.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const formattedTime = arrivalDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const stockNo = vehicle.stockNumber || `STK-${vehicle.id.slice(-6).toUpperCase()}`;
  const rowNo = vehicle.rowNumber || "Row 12";
  const spaceNo = vehicle.spaceNumber || "Space 04";

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[720px] bg-slate-950 text-slate-100 border-slate-800 max-h-[90vh] overflow-y-auto printable-tag-dialog font-sans">
        <DialogHeader className="border-b border-slate-800 pb-3 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-amber-400" />
              <DialogTitle className="text-base font-bold text-white font-mono">
                Yard Vehicle Window Tag & QR Pass Generator
              </DialogTitle>
            </div>
            <Button
              onClick={handlePrint}
              size="sm"
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs gap-1.5 shadow"
            >
              <Printer className="w-4 h-4" /> Print Window Tag (8.5x11)
            </Button>
          </div>
        </DialogHeader>

        {/* Printable Window Tag Sheet */}
        <div className="bg-white text-slate-950 p-8 rounded-xl font-mono border-4 border-slate-900 shadow-2xl space-y-6 print:p-0 print:border-4 print:border-black print:shadow-none print:m-0 print:w-full">
          
          {/* Header Branding */}
          <div className="text-center border-b-4 border-slate-900 pb-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black bg-slate-900 text-white px-3 py-1 rounded tracking-widest uppercase">
                YARD WINDOW TAG
              </span>
              <span className="text-xs font-black border-2 border-emerald-600 text-emerald-800 px-3 py-0.5 rounded uppercase">
                INSPECTED & STAGED
              </span>
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 mt-2">
              {settings.yardName}
            </h1>
            <p className="text-xs text-slate-700 font-sans font-bold">
              {settings.address}, {settings.cityStateZip} • {settings.phone}
            </p>
          </div>

          {/* Large Stock & Location Grid */}
          <div className="grid grid-cols-2 gap-4 bg-slate-100 p-4 rounded-xl border-2 border-slate-900 text-center">
            <div className="border-r-2 border-slate-900 pr-2">
              <span className="text-[10px] font-bold text-slate-600 block uppercase">YARD LOCATION ROW</span>
              <span className="text-3xl font-black text-slate-900 block font-mono">{rowNo}</span>
              <span className="text-xs font-bold text-amber-700 font-mono">{spaceNo}</span>
            </div>
            <div className="pl-2">
              <span className="text-[10px] font-bold text-slate-600 block uppercase">STOCK NUMBER</span>
              <span className="text-3xl font-black text-amber-600 block font-mono">{stockNo}</span>
              <span className="text-xs font-bold text-slate-800 font-mono">{vehicle.section}</span>
            </div>
          </div>

          {/* Vehicle Main Description Box */}
          <div className="space-y-3">
            <div className="bg-slate-900 text-white p-4 rounded-xl space-y-1">
              <span className="text-xs font-bold text-amber-400 block uppercase tracking-wider font-mono">
                VEHICLE SPECS
              </span>
              <h2 className="text-3xl font-black tracking-tight font-sans">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h2>
              <div className="flex items-center justify-between text-xs font-mono text-slate-300 pt-1 border-t border-slate-800">
                <span>Color: <strong>{vehicle.color || "White"}</strong></span>
                <span>Section: <strong>{vehicle.section}</strong></span>
              </div>
            </div>

            {/* Arrival Date & Time Box */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-300">
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase">ENTRY ARRIVAL DATE</span>
                <span className="text-sm font-bold text-slate-900 font-mono">{formattedDate}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase">EXACT ENTRY TIME</span>
                <span className="text-sm font-bold text-slate-900 font-mono">{formattedTime}</span>
              </div>
            </div>

            {/* VIN Display */}
            <div className="p-3 bg-slate-100 rounded-lg border border-slate-400 font-mono text-center">
              <span className="text-[10px] text-slate-600 font-bold block uppercase">17-DIGIT VIN NUMBER</span>
              <span className="text-xl font-black text-slate-900 tracking-widest block">{vehicle.vin}</span>
            </div>
          </div>

          {/* Intact Parts List */}
          <div className="space-y-1.5 font-sans">
            <span className="text-xs font-black uppercase text-slate-900 tracking-wider block">
              INTACT PARTS LISTED AT ENTRY:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {vehicle.partsRemaining.map((part, idx) => (
                <span key={idx} className="bg-slate-200 text-slate-900 text-xs px-2.5 py-1 rounded font-bold font-mono border border-slate-400">
                  ✓ {part}
                </span>
              ))}
            </div>
          </div>

          {/* QR Code & Digital Pass Footer */}
          <div className="grid grid-cols-3 gap-4 items-center pt-4 border-t-2 border-slate-900">
            <div className="col-span-2 space-y-1 font-sans">
              <div className="flex items-center gap-1 text-xs font-bold text-slate-900 uppercase">
                <ShieldCheck className="w-4 h-4 text-emerald-700" /> SELF-SERVICE PULLER RULES
              </div>
              <p className="text-[10px] text-slate-600 leading-tight">
                Must wear closed-toe shoes. Torches & jacks strictly prohibited. Parts priced per yard catalog.
              </p>
            </div>

            {/* QR Code Representation */}
            <div className="text-center space-y-1">
              <div className="w-20 h-20 mx-auto bg-slate-900 text-white p-2 rounded-lg flex items-center justify-center border-2 border-black">
                <QrCode className="w-16 h-16 text-amber-400" />
              </div>
              <span className="text-[9px] font-bold font-mono text-slate-800 block">SCAN FOR PARTS</span>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
};