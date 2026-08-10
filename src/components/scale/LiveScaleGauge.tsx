import React, { useEffect, useState } from 'react';
import { ScaleStatus, WeightUnit } from '@/types/scrap';
import { scaleService } from '@/services/scaleService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import {
  Scale,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Zap,
  Lock,
  ArrowDownUp,
  Truck,
  Box,
} from 'lucide-react';
import { toast } from 'sonner';

interface LiveScaleGaugeProps {
  onHoldWeight?: (weight: number, unit: WeightUnit) => void;
  className?: string;
  compact?: boolean;
}

export const LiveScaleGauge: React.FC<LiveScaleGaugeProps> = ({
  onHoldWeight,
  className = '',
  compact = false,
}) => {
  const [scale, setScale] = useState<ScaleStatus>(scaleService.getStatus());
  const [isHeld, setIsHeld] = useState(false);
  const [heldWeight, setHeldWeight] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = scaleService.subscribe((status) => {
      setScale(status);
    });
    return () => unsubscribe();
  }, []);

  const handleZero = () => {
    scaleService.setZero();
    toast.success('Scale zeroed');
  };

  const handleTare = () => {
    scaleService.setTare();
    toast.success(`Tare set to ${scale.grossWeight} ${scale.unit}`);
  };

  const handleClearTare = () => {
    scaleService.clearTare();
    toast.info('Tare cleared');
  };

  const handleToggleUnit = () => {
    const newUnit: WeightUnit = scale.unit === 'LBS' ? 'KG' : 'LBS';
    scaleService.setUnit(newUnit);
  };

  const handleHoldWeight = () => {
    const currentNet = scale.netWeight;
    setHeldWeight(currentNet);
    setIsHeld(true);
    if (onHoldWeight) {
      onHoldWeight(currentNet, scale.unit);
      toast.success(`Captured ${currentNet.toLocaleString()} ${scale.unit} to line item`);
    }
  };

  // Quick load presets for simulator testing
  const loadPreset = (lbs: number) => {
    scaleService.setMode('SIMULATOR');
    scaleService.setSimulatedWeight(lbs);
    setIsHeld(false);
  };

  return (
    <Card className={`bg-slate-900 border-slate-800 text-white shadow-xl overflow-hidden ${className}`}>
      <CardHeader className="py-3 px-4 bg-slate-950/80 border-b border-slate-800 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-emerald-400" />
          <CardTitle className="text-sm font-bold tracking-wide uppercase font-mono text-slate-200">
            Live Scale Indicator
          </CardTitle>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`font-mono text-xs px-2 py-0.5 border ${
              scale.isStable
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40'
                : 'bg-amber-950/60 text-amber-400 border-amber-500/40 animate-pulse'
            }`}
          >
            {scale.isStable ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> STABLE
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-400" /> IN MOTION
              </span>
            )}
          </Badge>

          <Badge variant="secondary" className="bg-slate-800 text-slate-300 font-mono text-xs">
            {scale.mode}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Digital Readout Screen */}
        <div className="bg-black/90 rounded-xl p-4 sm:p-6 border border-slate-800 shadow-inner relative overflow-hidden flex flex-col items-center justify-center">
          
          {/* Subtle grid pattern background */}
          <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] opacity-5 pointer-events-none" />

          {/* Scale Indicators status header */}
          <div className="w-full flex justify-between items-center text-[11px] font-mono text-slate-400 mb-1 z-10">
            <span>GROSS: {scale.grossWeight.toLocaleString()} {scale.unit}</span>
            {scale.tareWeight > 0 && (
              <span className="text-amber-400 font-bold">TARE: {scale.tareWeight.toLocaleString()} {scale.unit}</span>
            )}
            <span>NET WEIGHT</span>
          </div>

          {/* Large LED Digital Readout */}
          <div className="flex items-baseline justify-center gap-3 my-1 z-10 font-mono tracking-tight">
            <span className="text-5xl sm:text-6xl font-extrabold text-emerald-400 drop-shadow-[0_0_20px_rgba(16,185,129,0.35)]">
              {scale.netWeight.toLocaleString('en-US', { minimumFractionDigits: scale.netWeight % 1 === 0 ? 0 : 1 })}
            </span>
            <span className="text-xl sm:text-2xl font-bold text-slate-400 uppercase">
              {scale.unit}
            </span>
          </div>

          {/* Zero & Hold status badges */}
          <div className="flex items-center gap-3 mt-2 z-10">
            {scale.isZero && (
              <Badge className="bg-blue-950 text-blue-400 border border-blue-800/60 text-[10px]">
                CENTER OF ZERO
              </Badge>
            )}
            {isHeld && heldWeight !== null && (
              <Badge className="bg-emerald-900 text-emerald-300 border border-emerald-600 text-[10px] animate-pulse">
                HELD: {heldWeight.toLocaleString()} {scale.unit}
              </Badge>
            )}
          </div>
        </div>

        {/* Primary Scale Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleZero}
            className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1 text-slate-400" /> ZERO
          </Button>

          {scale.tareWeight > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearTare}
              className="bg-amber-950/60 hover:bg-amber-900 text-amber-200 border-amber-700/60 font-semibold text-xs"
            >
              CLEAR TARE
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTare}
              className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 font-semibold"
            >
              TARE
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleUnit}
            className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 font-semibold"
          >
            <ArrowDownUp className="w-3.5 h-3.5 mr-1 text-slate-400" /> {scale.unit === 'LBS' ? 'KG' : 'LBS'}
          </Button>

          <Button
            size="sm"
            onClick={handleHoldWeight}
            disabled={scale.netWeight <= 0}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-950"
          >
            <Lock className="w-3.5 h-3.5 mr-1" /> HOLD WEIGHT
          </Button>
        </div>

        {/* Scale Simulator Presets (if simulator mode active) */}
        {scale.mode === 'SIMULATOR' && !compact && (
          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> Live Simulator Quick Loads
              </span>
              <span>Slide or tap to test:</span>
            </div>

            <div className="space-y-3">
              <Slider
                value={[scale.grossWeight]}
                min={0}
                max={6000}
                step={5}
                onValueChange={(vals) => loadPreset(vals[0])}
                className="cursor-pointer"
              />

              <div className="grid grid-cols-4 gap-1.5 text-[11px]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => loadPreset(0)}
                  className="h-7 bg-slate-800/40 hover:bg-slate-800 text-slate-300 text-[11px]"
                >
                  Empty (0)
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => loadPreset(45)}
                  className="h-7 bg-slate-800/40 hover:bg-slate-800 text-slate-300 text-[11px]"
                >
                  <Box className="w-3 h-3 mr-1 text-amber-400" /> 45 lbs (Box)
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => loadPreset(350)}
                  className="h-7 bg-slate-800/40 hover:bg-slate-800 text-slate-300 text-[11px]"
                >
                  350 lbs (Pallet)
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => loadPreset(3650)}
                  className="h-7 bg-slate-800/40 hover:bg-slate-800 text-slate-300 text-[11px]"
                >
                  <Truck className="w-3 h-3 mr-1 text-emerald-400" /> 3,650 lbs (Car)
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
