import type { YardMapItemType } from "@/types/scrap";
import { Building2, CarFront, Grid3X3, PackageOpen } from "lucide-react";

const paletteItems: Array<{
  type: YardMapItemType;
  label: string;
  description: string;
  icon: typeof CarFront;
  color: string;
}> = [
  { type: "CAR", label: "Vehicle space", description: "Track a car or parking spot", icon: CarFront, color: "#f59e0b" },
  { type: "SCRAP_BIN", label: "Scrap bin", description: "Link to a material bay", icon: PackageOpen, color: "#10b981" },
  { type: "BUILDING", label: "Building", description: "Office, scale or workshop", icon: Building2, color: "#6366f1" },
  { type: "ZONE", label: "Yard zone", description: "Mark rows and work areas", icon: Grid3X3, color: "#0ea5e9" },
];

interface YardItemPaletteProps {
  onAdd: (type: YardMapItemType) => void;
}

export function YardItemPalette({ onAdd }: YardItemPaletteProps) {
  return (
    <aside className="rounded-2xl border border-slate-800 bg-slate-900/95 p-4 shadow-2xl shadow-slate-950/40">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">Build tools</p>
        <h2 className="mt-1 text-lg font-black text-white">Place an item</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">Drag onto the map, or tap to add at the center.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
        {paletteItems.map(({ type, label, description, icon: Icon, color }) => (
          <button
            key={type}
            type="button"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("application/yard-item", type);
              event.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => onAdd(type)}
            className="group flex min-h-[76px] cursor-grab items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-left transition hover:-translate-y-0.5 hover:border-slate-600 hover:bg-slate-800 active:cursor-grabbing"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-lg"
              style={{ backgroundColor: color }}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-slate-100">{label}</span>
              <span className="hidden text-[11px] leading-snug text-slate-500 lg:block">{description}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-3 text-[11px] leading-relaxed text-slate-400">
        <span className="font-bold text-slate-200">Tip:</span> Select an item to resize, rotate, color-code, and connect it to live inventory.
      </div>
    </aside>
  );
}
