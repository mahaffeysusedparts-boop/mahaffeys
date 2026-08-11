import React from 'react';
import { IntakeType } from '@/types/scrap';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Car,
  Scale,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Ban,
} from 'lucide-react';

interface IntakeModeSelectorProps {
  onSelectMode: (mode: IntakeType) => void;
}

export const IntakeModeSelector: React.FC<IntakeModeSelectorProps> = ({ onSelectMode }) => {
  return (
    <div className="max-w-5xl mx-auto space-y-8 py-4">
      {/* Title & Prompt */}
      <div className="text-center space-y-2">
        <Badge
          variant="outline"
          className="border-emerald-500/50 text-emerald-400 bg-emerald-950/40 text-xs px-3 py-1 uppercase font-mono tracking-widest"
        >
          Yard Workstations
        </Badge>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Select Intake Workstation Category
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto">
          Choose the appropriate workstation workflow. Junk yard cars are acquired via flat component rates (no scale), while scrap metals use live scale weighing.
        </p>
      </div>

      {/* Two Main Intake Choice Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Option 1: Junk Yard Car Station (Auto Salvage / Pull-A-Part) */}
        <Card
          onClick={() => onSelectMode('CAR_SALVAGE')}
          className="group relative bg-slate-900 border-2 border-slate-800 hover:border-amber-500/80 transition-all duration-300 cursor-pointer overflow-hidden shadow-2xl hover:shadow-amber-500/10 flex flex-col justify-between"
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600" />

          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between">
              <div className="w-14 h-14 rounded-2xl bg-amber-950/80 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 group-hover:bg-amber-900 transition-all shadow-lg shadow-amber-950">
                <Car className="w-8 h-8" />
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 font-mono text-xs">
                  JUNK YARD / AUTO SALVAGE
                </Badge>
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px]">
                  FLAT RATE • NO SCALE
                </Badge>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white group-hover:text-amber-400 transition-colors flex items-center gap-2">
                Junk Yard Car Station
                <Sparkles className="w-4 h-4 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h2>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                Flat-rate vehicle acquisition for Pull-A-Part dismantling and staged lot placement without scale weighing.
              </p>
            </div>

            {/* Included Features Checklist */}
            <ul className="space-y-2.5 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Flat Rate & Component Bonus Payouts (No Scale Weighing)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>VIN Decoding & Title Verification (Clean, Salvage, Bill of Sale)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Catalytic Converter, Driveline & Battery Component Bonuses</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Pull-A-Part Row Assignment & Environmental Fluids Checklist</span>
              </li>
            </ul>

            <div className="pt-4 flex items-center justify-between text-amber-400 font-semibold text-sm group-hover:translate-x-1 transition-transform">
              <span>Start Junk Car Intake</span>
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Option 2: Scrap Yard Metal Scale Desk */}
        <Card
          onClick={() => onSelectMode('SCRAP_METAL')}
          className="group relative bg-slate-900 border-2 border-slate-800 hover:border-emerald-500/80 transition-all duration-300 cursor-pointer overflow-hidden shadow-2xl hover:shadow-emerald-500/10 flex flex-col justify-between"
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />

          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between">
              <div className="w-14 h-14 rounded-2xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 group-hover:bg-emerald-900 transition-all shadow-lg shadow-emerald-950">
                <Scale className="w-8 h-8" />
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-mono text-xs">
                  SCRAP YARD SCALE DESK
                </Badge>
                <Badge variant="outline" className="border-blue-500/40 text-blue-400 text-[10px]">
                  LIVE SCALE INDICATOR
                </Badge>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                Scrap Yard Metal Scale Desk
                <Sparkles className="w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h2>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                Standard metal recycling intake station with live scale weight holding for ferrous and non-ferrous commodities.
              </p>
            </div>

            {/* Included Features Checklist */}
            <ul className="space-y-2.5 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Live Scale Weight Holding (USB Serial, Network, or Simulator)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Vehicle Drive-On / Drive-Off Double Weighing (Gross vs Tare)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Multi-Grade Scrap Lines (Copper, Brass, Alum, Steel, Batteries)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Contamination Deductions & Instant Cash / Check Payout Vouchers</span>
              </li>
            </ul>

            <div className="pt-4 flex items-center justify-between text-emerald-400 font-semibold text-sm group-hover:translate-x-1 transition-transform">
              <span>Start Metal Scrap Ticket</span>
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};