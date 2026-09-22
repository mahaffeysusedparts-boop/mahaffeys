import { memo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { MetalGrade, PullYardVehicle, YardBayLocation, YardMapItem as YardMapItemModel } from "@/types/scrap";
import { BrickWall, Building2, CarFront, Fence, Grid3X3, MessageSquareText, PackageOpen, RotateCw, Route, Waves } from "lucide-react";

const CANVAS_WIDTH = 2400;
const CANVAS_HEIGHT = 1500;
const SNAP_THRESHOLD_PX = 12;

export interface SnapTarget {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SnapGuides {
  x: number[];
  y: number[];
}

interface YardItemProps {
  item: YardMapItemModel;
  selected: boolean;
  scale: number;
  bay?: YardBayLocation;
  vehicle?: PullYardVehicle;
  metal?: MetalGrade;
  heatColor?: string;
  readOnly?: boolean;
  flash?: boolean;
  snapEnabled?: boolean;
  gridSizePx?: number;
  snapTargets?: SnapTarget[];
  onGuides?: (guides: SnapGuides | null) => void;
  onSelect: () => void;
  onChange: (changes: Partial<YardMapItemModel>) => void;
}

const iconByType = { CAR: CarFront, SCRAP_BIN: PackageOpen, BUILDING: Building2, ZONE: Grid3X3, ROAD: Route, WALL: BrickWall, FENCE: Fence, CREEK: Waves, NOTE: MessageSquareText };

export const YardItem = memo(function YardItem({
  item, selected, scale, bay, vehicle, metal, heatColor, readOnly, flash,
  snapEnabled, gridSizePx, snapTargets, onGuides, onSelect, onChange,
}: YardItemProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const Icon = iconByType[item.type];

  const clampX = (value: number) => Math.max(0, Math.min(CANVAS_WIDTH - item.width, value));
  const clampY = (value: number) => Math.max(0, Math.min(CANVAS_HEIGHT - item.height, value));

  /** Snaps one axis against neighbor edges/centers, then the grid. */
  const snapAxis = (raw: number, guides: number[], candidates: Array<{ position: number; guide: number }>) => {
    if (!snapEnabled) return raw;
    let best: { position: number; guide: number; delta: number } | null = null;
    for (const candidate of candidates) {
      const delta = Math.abs(candidate.position - raw);
      if (delta <= SNAP_THRESHOLD_PX && (!best || delta < best.delta)) best = { ...candidate, delta };
    }
    if (best) {
      guides.push(best.guide);
      return best.position;
    }
    return gridSizePx ? Math.round(raw / gridSizePx) * gridSizePx : raw;
  };

  const startMove = (event: ReactPointerEvent) => {
    event.stopPropagation();
    onSelect();
    if (readOnly || (event.target as HTMLElement).closest("[data-control]")) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = item.x;
    const originY = item.y;
    const others = (snapTargets ?? []).filter((target) => target.id !== item.id);
    const move = (next: PointerEvent) => {
      const rawX = clampX(originX + (next.clientX - startX) / scale);
      const rawY = clampY(originY + (next.clientY - startY) / scale);
      const guides: SnapGuides = { x: [], y: [] };
      const x = snapAxis(rawX, guides.x, others.flatMap((target) => [
        { position: target.x, guide: target.x },
        { position: target.x + target.width / 2 - item.width / 2, guide: target.x + target.width / 2 },
        { position: target.x + target.width - item.width, guide: target.x + target.width },
      ]));
      const y = snapAxis(rawY, guides.y, others.flatMap((target) => [
        { position: target.y, guide: target.y },
        { position: target.y + target.height / 2 - item.height / 2, guide: target.y + target.height / 2 },
        { position: target.y + target.height - item.height, guide: target.y + target.height },
      ]));
      onChange({ x, y });
      if (snapEnabled && (guides.x.length > 0 || guides.y.length > 0)) onGuides?.(guides);
      else onGuides?.(null);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      onGuides?.(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };

  const startResize = (event: ReactPointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const originWidth = item.width;
    const originHeight = item.height;
    const snapSize = (raw: number) => snapEnabled && gridSizePx ? Math.max(gridSizePx, Math.round(raw / gridSizePx) * gridSizePx) : raw;
    const move = (next: PointerEvent) => onChange({
      width: Math.max(48, Math.min(900, snapSize(originWidth + (next.clientX - startX) / scale))),
      height: Math.max(24, Math.min(700, snapSize(originHeight + (next.clientY - startY) / scale))),
    });
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };

  const startRotate = (event: ReactPointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = elementRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const move = (next: PointerEvent) => onChange({ rotation: (Math.round((Math.atan2(next.clientY - centerY, next.clientX - centerX) * 180 / Math.PI + 90) / 5) * 5 + 360) % 360 });
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };

  const binWeight = bay?.currentLbs ?? item.currentLbs ?? 0;
  const binCapacity = bay?.capacityLbs ?? item.capacityLbs ?? 0;
  const binValue = bay?.estValueUsd ?? (metal ? binWeight * metal.ratePerLb : 0);
  const binFill = binCapacity > 0 ? Math.min(100, Math.round((binWeight / binCapacity) * 100)) : 0;
  const subtitle = item.type === "NOTE"
    ? item.noteText || "Click to add details"
    : bay
      ? `${bay.currentLbs.toLocaleString()} lb · $${bay.estValueUsd.toLocaleString()}`
      : item.type === "SCRAP_BIN" && metal
        ? `${metal.name} · ${binWeight.toLocaleString()} lb · $${binValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : vehicle
          ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
          : item.type === "SCRAP_BIN" ? "Select bin contents" : item.type.replace("_", " ").toLowerCase();
  const linear = ["ROAD", "WALL", "FENCE", "CREEK"].includes(item.type);

  return (
    <div
      ref={elementRef}
      role="button"
      tabIndex={0}
      aria-label={`${item.label}, ${subtitle}`}
      onPointerDown={startMove}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(); }}
      className={`group absolute select-none touch-none ${item.type === "NOTE" ? "rounded-2xl" : linear ? "rounded-lg" : "rounded-xl"} border-2 shadow-xl transition-shadow ${selected ? "z-20 border-white shadow-white/20" : "z-10 border-white/30 hover:border-white/70"}`}
      style={{
        left: item.x,
        top: item.y,
        width: item.width,
        height: item.height,
        transform: `rotate(${item.rotation}deg)`,
        backgroundColor: heatColor ?? `${item.color}d9`,
        borderStyle: item.type === "FENCE" ? "dashed" : "solid",
      }}
    >
      {flash && <span className="yard-map-transient pointer-events-none absolute -inset-3 animate-ping rounded-2xl border-4 border-emerald-300" />}
      <div className={`flex h-full min-h-0 overflow-hidden rounded-[10px] px-2 text-center text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] ${linear ? "flex-row items-center justify-center gap-2" : "flex-col items-center justify-center"}`}>
        <Icon className={`${linear ? "h-4 w-4" : "mb-1 h-6 w-6"} shrink-0 drop-shadow`} />
        <span className="max-w-full truncate text-xs font-black tracking-wide drop-shadow">{item.label}</span>
        {!linear && <span className={`mt-0.5 max-w-full text-[9px] font-semibold text-white/85 ${item.type === "NOTE" ? "line-clamp-3 whitespace-normal" : "truncate"}`}>{subtitle}</span>}
        {(bay || (item.type === "SCRAP_BIN" && binCapacity > 0)) && <span className={`mt-1 rounded-full px-1.5 py-0.5 text-[8px] font-black ${binFill >= 95 ? "bg-rose-950/80" : binFill >= 80 ? "bg-amber-950/80" : "bg-emerald-950/80"}`}>{binFill}% FULL</span>}
      </div>
      {selected && !readOnly && (
        <>
          <button data-control type="button" aria-label="Rotate item" onPointerDown={startRotate} className="absolute left-1/2 top-[-34px] flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border-2 border-white bg-slate-800 text-white shadow-lg"><RotateCw className="h-3.5 w-3.5" /></button>
          <span className="absolute left-1/2 top-[-8px] h-2 w-px -translate-x-1/2 bg-white" />
          <button data-control type="button" aria-label="Resize item" onPointerDown={startResize} className="absolute bottom-[-7px] right-[-7px] h-4 w-4 cursor-nwse-resize rounded-full border-2 border-slate-900 bg-white shadow" />
        </>
      )}
    </div>
  );
});
