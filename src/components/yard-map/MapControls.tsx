import { Button } from "@/components/ui/button";
import { Flame, Magnet, Moon, Printer, Ruler, Sun } from "lucide-react";

export type HeatmapMetric = "FILL" | "VALUE" | "AGE";
export type SnapGridFt = 5 | 10 | 20;

interface MapControlsProps {
  heatmapEnabled: boolean;
  heatmapMetric: HeatmapMetric;
  nightMode: boolean;
  snapEnabled: boolean;
  gridSizeFt: SnapGridFt;
  measureMode: boolean;
  onToggleHeatmap: () => void;
  onMetricChange: (metric: HeatmapMetric) => void;
  onToggleNight: () => void;
  onPrint: () => void;
  onToggleSnap: () => void;
  onGridSizeChange: (size: SnapGridFt) => void;
  onToggleMeasure: () => void;
}

export function MapControls({
  heatmapEnabled, heatmapMetric, nightMode, snapEnabled, gridSizeFt, measureMode,
  onToggleHeatmap, onMetricChange, onToggleNight, onPrint, onToggleSnap, onGridSizeChange, onToggleMeasure,
}: MapControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button size="sm" variant="outline" onClick={onToggleHeatmap} className={`h-9 rounded-xl border-slate-700 text-xs ${heatmapEnabled ? "bg-rose-500 text-white hover:bg-rose-400" : "bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white"}`}>
        <Flame className="mr-1.5 h-3.5 w-3.5" /> Heatmap
      </Button>
      {heatmapEnabled && (
        <select value={heatmapMetric} onChange={(event) => onMetricChange(event.target.value as HeatmapMetric)} className="h-9 rounded-xl border border-slate-700 bg-slate-950 px-2 text-xs font-bold text-slate-200 outline-none">
          <option value="FILL">Fill rate</option><option value="VALUE">Inventory value</option><option value="AGE">Inventory age</option>
        </select>
      )}
      <Button size="sm" variant="outline" onClick={onToggleSnap} className={`h-9 rounded-xl border-slate-700 text-xs ${snapEnabled ? "bg-sky-500 text-white hover:bg-sky-400" : "bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white"}`}>
        <Magnet className="mr-1.5 h-3.5 w-3.5" /> Snap
      </Button>
      {snapEnabled && (
        <select value={gridSizeFt} onChange={(event) => onGridSizeChange(Number(event.target.value) as SnapGridFt)} aria-label="Grid size" className="h-9 rounded-xl border border-slate-700 bg-slate-950 px-2 text-xs font-bold text-slate-200 outline-none">
          <option value={5}>5 ft grid</option><option value={10}>10 ft grid</option><option value={20}>20 ft grid</option>
        </select>
      )}
      <Button size="sm" variant="outline" onClick={onToggleMeasure} className={`h-9 rounded-xl border-slate-700 text-xs ${measureMode ? "bg-emerald-500 text-white hover:bg-emerald-400" : "bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white"}`}>
        <Ruler className="mr-1.5 h-3.5 w-3.5" /> Measure
      </Button>
      <Button size="sm" variant="outline" onClick={onToggleNight} className="h-9 rounded-xl border-slate-700 bg-slate-950 text-xs text-slate-300 hover:bg-slate-800 hover:text-white">
        {nightMode ? <Sun className="mr-1.5 h-3.5 w-3.5" /> : <Moon className="mr-1.5 h-3.5 w-3.5" />} {nightMode ? "Day" : "Night"}
      </Button>
      <Button size="sm" variant="outline" onClick={onPrint} className="h-9 rounded-xl border-slate-700 bg-slate-950 text-xs text-slate-300 hover:bg-slate-800 hover:text-white">
        <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
      </Button>
    </div>
  );
}
