import { memo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { PullYardVehicle, YardBayLocation, YardMapItem as YardMapItemModel } from "@/types/scrap";
import { BrickWall, Building2, CarFront, Fence, Grid3X3, MessageSquareText, PackageOpen, RotateCw, Route, Waves } from "lucide-react";

interface YardItemProps {
  item: YardMapItemModel;
  selected: boolean;
  scale: number;
  bay?: YardBayLocation;
  vehicle?: PullYardVehicle;
  heatColor?: string;
  readOnly?: boolean;
  onSelect: () => void;
  onChange: (changes: Partial<YardMapItemModel>) => void;
}

const iconByType = { CAR: CarFront, SCRAP_BIN: PackageOpen, BUILDING: Building2, ZONE: Grid3X3, ROAD: Route, WALL: BrickWall, FENCE: Fence, CREEK: Waves, NOTE: MessageSquareText };

export const YardItem = memo(function YardItem({ item, selected, scale, bay, vehicle, heatColor, readOnly, onSelect, onChange }: YardItemProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const Icon = iconByType[item.type];

  const startMove = (event: ReactPointerEvent) => {
    event.stopPropagation();
    onSelect();
    if (readOnly || (event.target as HTMLElement).closest("[data-control]")) return;
    const startX = event.clientX; const startY = event.clientY; const originX = item.x; const originY = item.y;
    const move = (next: PointerEvent) => onChange({ x: Math.max(0, Math.min(2400 - item.width, originX + (next.clientX - startX) / scale)), y: Math.max(0, Math.min(1500 - item.height, originY + (next.clientY - startY) / scale)) });
    const end = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", end);
  };

  const startResize = (event: ReactPointerEvent) => {
    event.preventDefault(); event.stopPropagation();
    const startX = event.clientX; const startY = event.clientY; const originWidth = item.width; const originHeight = item.height;
    const move = (next: PointerEvent) => onChange({ width: Math.max(48, Math.min(900, originWidth + (next.clientX - startX) / scale)), height: Math.max(24, Math.min(700, originHeight + (next.clientY - startY) / scale)) });
    const end = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", end);
  };

  const startRotate = (event: ReactPointerEvent) => {
    event.preventDefault(); event.stopPropagation();
    const rect = elementRef.current?.getBoundingClientRect(); if (!rect) return;
    const centerX = rect.left + rect.width / 2; const centerY = rect.top + rect.height / 2;
    const move = (next: PointerEvent) => onChange({ rotation: (Math.round((Math.atan2(next.clientY - centerY, next.clientX - centerX) * 180 / Math.PI + 90) / 5) * 5 + 360) % 360 });
    const end = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", end);
  };

  const subtitle = item.type === "NOTE" ? item.noteText || "Click to add details" : bay ? `${bay.currentLbs.toLocaleString()} lb · $${bay.estValueUsd.toLocaleString()}` : vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : item.type.replace("_", " ").toLowerCase();
  const linear = ["ROAD", "WALL", "FENCE", "CREEK"].includes(item.type);

  return (
    <div ref={elementRef} role="button" tabIndex={0} aria-label={`${item.label}, ${subtitle}`} onPointerDown={startMove} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(); }} className={`group absolute select-none touch-none ${item.type === "NOTE" ? "rounded-2xl" : linear ? "rounded-lg" : "rounded-xl"} border-2 shadow-xl transition-shadow ${selected ? "z-20 border-white shadow-white/20" : "z-10 border-white/30 hover:border-white/70"}`} style={{ left: item.x, top: item.y, width: item.width, height: item.height, transform: `rotate(${item.rotation}deg)`, backgroundColor: heatColor ?? `${item.color}d9`, borderStyle: item.type === "FENCE" ? "dashed" : "solid" }}>
      <div className={`flex h-full min-h-0 overflow-hidden rounded-[10px] px-2 text-center text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] ${linear ? "flex-row items-center justify-center gap-2" : "flex-col items-center justify-center"}`}>
        <Icon className={`${linear ? "h-4 w-4" : "mb-1 h-6 w-6"} shrink-0 drop-shadow`} />
        <span className="max-w-full truncate text-xs font-black tracking-wide drop-shadow">{item.label}</span>
        {!linear && <span className={`mt-0.5 max-w-full text-[9px] font-semibold text-white/85 ${item.type === "NOTE" ? "line-clamp-3 whitespace-normal" : "truncate"}`}>{subtitle}</span>}
        {bay && <span className={`mt-1 rounded-full px-1.5 py-0.5 text-[8px] font-black ${bay.status === "CRITICAL_FULL" ? "bg-rose-950/80" : bay.status === "NEAR_CAPACITY" ? "bg-amber-950/80" : "bg-emerald-950/80"}`}>{Math.min(100, Math.round((bay.currentLbs / bay.capacityLbs) * 100))}% FULL</span>}
      </div>
      {selected && !readOnly && <div className="yard-map-item-controls"><button data-control type="button" aria-label="Rotate item" onPointerDown={startRotate} className="absolute left-1/2 top-[-34px] flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border-2 border-white bg-slate-800 text-white shadow-lg"><RotateCw className="h-3.5 w-3.5" /></button><span className="absolute left-1/2 top-[-8px] h-2 w-px -translate-x-1/2 bg-white" /><button data-control type="button" aria-label="Resize item" onPointerDown={startResize} className="absolute bottom-[-7px] right-[-7px] h-4 w-4 cursor-nwse-resize rounded-full border-2 border-slate-900 bg-white shadow" /></div>}
    </div>
  );
});
