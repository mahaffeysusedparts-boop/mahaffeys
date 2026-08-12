import React from 'react';
import { PullYardVehicle, YardSettings } from '@/types/scrap';
import { storageService } from '@/services/storageService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, QrCode, ShieldCheck, Car, Calendar, MapPin, Wrench } from 'lucide-react';

interface YardWindowTagModalProps {
  vehicle: PullYardVehicle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const YardWindowTagModal: React.FC<YardWindowTagModalProps> = ({ vehicle, open, onOpenChange }) => {
  if (!vehicle) return null;

  const settings: YardSettings = storageService.getSettings();

  const handlePrint = () => {
    window.print();
  };

  const stockNum = vehicle.stockNumber || `STK-${vehicle.id.slice(-6).toUpperCase()}`;
  const arrivalDate = new Date(vehicle.dateSetInYard);
  const formattedArrival = `${arrivalDate.toLocaleDateString()} at ${arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-slate-950 text-slate-100 border-slate-800 max-h-[90vh] overflow-y-auto printable-window-tag-container">
        
        <DialogHeader className="border-b border-slate-800 pb-3 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-amber-400" />
              <DialogTitle className="text-base font-bold text-white font-mono">
                Yard Vehicle Window Sheet & Printable Tag
              </DialogTitle>
            </div>
            <Button
              onClick={handlePrint}
              size="sm"
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs"
            >
              <Printer className="w-4 h-4 mr-1.5" /> Print 8.5x11 Window Tag
            </Button>
          </div>
        </DialogHeader>

        {/* Printable 8.5x11 Window Sheet Container */}
        <div className="p-6 sm:p-8 bg-white text-slate-950 rounded-xl font-sans space-y-6 border-4 border-slate-900 shadow-2xl print:border-slate-900 print:shadow-none print:p-0 print:m-0 print:w-full">
          
          {/* Header Branding */}
          <div className="flex items-center justify-between border-b-4 border-slate-900 pb-4">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">
                {settings.yardName}
              </h1>
              <p className="text-xs text-slate-700 font-bold font-mono">
                {settings.address}, {settings.cityStateZip} | Phone: {settings.phone}
              </p>
            </div>

            <div className="text-right font-mono">
              <div className="bg-slate-900 text-white px-3 py-1 text-sm font-black uppercase tracking-widest rounded">
                YARD WINDOW TAG
              </div>
              <p className="text-xs font-extrabold text-slate-800 mt-1">STOCK #: {stockNum}</p>
            </div>
          </div>

          {/* Huge Vehicle Year Make Model Banner */}
          <div className="bg-slate-100 border-2 border-slate-900 p-4 text-center rounded-lg space-y-1">
            <span className="text-sm font-bold text-slate-600 font-mono uppercase tracking-widest block">
              VEHICLE IDENTIFICATION
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 uppercase tracking-tight">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h2>
            <p className="text-sm font-bold text-slate-800 font-mono">
              COLOR: {vehicle.color || 'COLOR UNKNOWN'}
            </p>
          </div>

          {/* Key Specs Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs font-mono border-2 border-slate-900 rounded-lg p-4 bg-slate-50">
            <div>
              <p className="text-[10px] text-slate-600 font-bold uppercase">VIN NUMBER (17-DIGIT):</p>
              <p className="text-base font-black text-slate-900 tracking-wider font-mono">{vehicle.vin}</p>
            </div>

            <div>
              <p className="text-[10px] text-slate-600 font-bold uppercase">YARD SECTION & LOCATION:</p>
              <p className="text-base font-black text-amber-700 uppercase">
                {vehicle.section} {vehicle.rowNumber ? `| ${vehicle.rowNumber}` : ''} {vehicle.spaceNumber ? `(${vehicle.spaceNumber})` : ''}
              </p>
            </div>

            <div>
              <p className="text-[10px] text-slate-600 font-bold uppercase">EXACT ARRIVAL ENTRY TIMESTAMP:</p>
              <p className="text-sm font-bold text-slate-900">{formattedArrival}</p>
            </div>

            <div>
              <p className="text-[10px] text-slate-600 font-bold uppercase">YARD INTAKE STATUS:</p>
              <p className="text-sm font-black text-emerald-800 uppercase">{vehicle.status}</p>
            </div>
          </div>

          {/* Intact Components Checklist */}
          <div className="border-2 border-slate-900 rounded-lg p-4 space-y-2">
            <p className="text-xs font-black uppercase text-slate-900 border-b border-slate-300 pb-1">
              AVAILABLE HARVESTABLE COMPONENTS:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-bold font-mono text-slate-800">
              {vehicle.partsRemaining.map((part, idx) => (
                <div key={idx} className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded border border-slate-300">
                  <span className="text-emerald-700 font-black">✓</span>
                  <span>{part}</span>
                </div>
              ))}
            </div>
          </div>

          {/* QR Code & Digital Scan Section */}
          <div className="border-2 border-slate-900 rounded-lg p-4 bg-slate-50 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-black uppercase text-slate-900 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-slate-900 inline" /> PUBLIC CATALOG & PARTS INTERCHANGE QR
              </p>
              <p className="text-[10px] text-slate-700 leading-snug max-w-sm">
                Scan this QR code with any smartphone camera to view live vehicle photos, intact parts list, and interchange cross-fitment mappings.
              </p>
            </div>

            {/* Generated QR Representation */}
            <div className="p-2 bg-white border-2 border-slate-900 rounded shrink-0 text-center">
              <div className="w-24 h-24 bg-slate-900 p-1 flex items-center justify-center rounded">
                <svg viewBox="0 0 100 100" className="w-full h-full text-white fill-current">
                  <rect width="100" height="100" fill="black" />
                  <rect x="10" y="10" width="30" height="30" fill="white" />
                  <rect x="15" y="15" width="20" height="20" fill="black" />
                  <rect x="60" y="10" width="30" height="30" fill="white" />
                  <rect x="65" y="15" width="20" height="20" fill="black" />
                  <rect x="10" y="60" width="30" height="30" fill="white" />
                  <rect x="15" y="65" width="20" height="20" fill="black" />
                  <rect x="45" y="45" width="10" height="10" fill="white" />
                  <rect x="60" y="60" width="15" height="15" fill="white" />
                  <rect x="75" y="75" width="15" height="15" fill="white" />
                  <rect x="45" y="70" width="10" height="20" fill="white" />
                </svg>
              </div>
              <span className="text-[9px] font-mono font-bold text-slate-900 block mt-1">SCAN ME</span>
            </div>
          </div>

          {/* Safety Rules Disclaimers */}
          <div className="text-[9px] text-slate-700 border-t-2 border-slate-900 pt-3 space-y-0.5 leading-tight font-sans">
            <p className="font-bold uppercase text-slate-900">SAFETY WARNING & HARVESTING RULES:</p>
            <p>1. Must wear closed-toe shoes and safety glasses at all times on the yard lot.</p>
            <p>2. Jacks, open flames, torches, and power cutting tools are strictly prohibited.</p>
            <p>3. Check out at the scale counter before leaving with harvested parts.</p>
          </div>

        </div>

      </DialogContent>
    </Dialog>
  );
};