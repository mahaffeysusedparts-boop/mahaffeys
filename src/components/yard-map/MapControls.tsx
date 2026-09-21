import { Button } from "@/components/ui/button";
import { Flame, Moon, Printer, Sun } from "lucide-react";

export type HeatmapMetric = "FILL" | "VALUE" | "AGE";

interface MapControlsProps {
  heatmapEnabled: boolean;
  heatmapMetric: HeatmapMetric;
  nightMode: boolean;
  onToggleHeatmap: () => void;
  onMetricChange: (metric: HeatmapMetric) => void;
  onToggleNight: () => void;
  onPrint: () => void;
}

export function MapControls({ heatmapEnabled, heatmapMetric, nightMode, onToggleHeatmap, onMetricChange, onToggleNight, onPrint }: MapControlsProps) {
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
      <Button size="sm" variant="outline" onClick={onToggleNight} className="h-9 rounded-xl border-slate-700 bg-slate-950 text-xs text-slate-300 hover:bg-slate-800 hover:text-white">
        {nightMode ? <Sun className="mr-1.5 h-3.5 w-3.5" /> : <Moon className="mr-1.5 h-3.5 w-3.5" />} {nightMode ? "Day" : "Night"}
      </Button>
      <Button size="sm" variant="outline" onClick={onPrint} className="h-9 rounded-xl border-slate-700 bg-slate-950 text-xs text-slate-300 hover:bg-slate-800 hover:text-white">
        <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
      </Button>
    </div>
  );
}
