import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, PointerEvent as ReactPointerEvent, WheelEvent } from "react";
import type { PullYardVehicle, YardBayLocation, YardMapItem, YardMapItemType } from "@/types/scrap";
import { storageService } from "@/services/storageService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ItemPropertiesPanel } from "./ItemPropertiesPanel";
import { YardItemPalette } from "./YardItemPalette";
import { YardItem } from "./YardItem";
import { Crosshair, Maximize2, Minus, MousePointer2, Plus, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 1000;

const itemDefaults: Record<YardMapItemType, Pick<YardMapItem, "label" | "width" | "height" | "color">> = {
  CAR: { label: "Vehicle space", width: 150, height: 74, color: "#f59e0b" },
  SCRAP_BIN: { label: "Scrap bin", width: 170, height: 130, color: "#10b981" },
  BUILDING: { label: "Building", width: 260, height: 170, color: "#6366f1" },
  ZONE: { label: "Work zone", width: 300, height: 190, color: "#0ea5e9" },
};

interface InteractiveYardMapProps {
  bays: YardBayLocation[];
  vehicles: PullYardVehicle[];
}

export function InteractiveYardMap({ bays, vehicles }: InteractiveYardMapProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<YardMapItem[]>(() => storageService.getYardLayout());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(0.72);
  const [pan, setPan] = useState({ x: 24, y: 24 });
  const [saved, setSaved] = useState(true);

  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const bayById = useMemo(() => new Map(bays.map((bay) => [bay.id, bay])), [bays]);
  const vehicleById = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      storageService.saveYardLayout(items);
      setSaved(true);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [items]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).matches("input, textarea, [role='combobox']")) return;
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        setItems((current) => current.filter((item) => item.id !== selectedId));
        setSelectedId(null);
      }
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedId]);

  const updateItem = (id: string, changes: Partial<YardMapItem>) => {
    setSaved(false);
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
  };

  const addItem = (type: YardMapItemType, point?: { x: number; y: number }) => {
    const defaults = itemDefaults[type];
    const viewport = viewportRef.current;
    const center = point ?? {
      x: viewport ? (viewport.clientWidth / 2 - pan.x) / scale : 500,
      y: viewport ? (viewport.clientHeight / 2 - pan.y) / scale : 350,
    };
    const item: YardMapItem = {
      id: `yard-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      ...defaults,
      x: Math.max(0, Math.min(CANVAS_WIDTH - defaults.width, center.x - defaults.width / 2)),
      y: Math.max(0, Math.min(CANVAS_HEIGHT - defaults.height, center.y - defaults.height / 2)),
      rotation: 0,
    };
    setSaved(false);
    setItems((current) => [...current, item]);
    setSelectedId(item.id);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/yard-item") as YardMapItemType;
    if (!itemDefaults[type]) return;
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    addItem(type, { x: (event.clientX - rect.left - pan.x) / scale, y: (event.clientY - rect.top - pan.y) / scale });
  };

  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    setSelectedId(null);
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = pan;
    const move = (next: PointerEvent) => setPan({ x: origin.x + next.clientX - startX, y: origin.y + next.clientY - startY });
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const nextScale = Math.max(0.35, Math.min(1.5, scale * (event.deltaY > 0 ? 0.9 : 1.1)));
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const worldX = (cursorX - pan.x) / scale;
    const worldY = (cursorY - pan.y) / scale;
    setPan({ x: cursorX - worldX * nextScale, y: cursorY - worldY * nextScale });
    setScale(nextScale);
  };

  const fitMap = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const nextScale = Math.min((viewport.clientWidth - 32) / CANVAS_WIDTH, (viewport.clientHeight - 32) / CANVAS_HEIGHT, 1);
    setScale(nextScale);
    setPan({ x: (viewport.clientWidth - CANVAS_WIDTH * nextScale) / 2, y: (viewport.clientHeight - CANVAS_HEIGHT * nextScale) / 2 });
  };

  const duplicateSelected = () => {
    if (!selectedItem) return;
    const copy = { ...selectedItem, id: `yard-${Date.now()}`, label: `${selectedItem.label} copy`, x: selectedItem.x + 24, y: selectedItem.y + 24 };
    setItems((current) => [...current, copy]);
    setSelectedId(copy.id);
    setSaved(false);
  };

  const resetLayout = () => {
    if (items.length > 0 && !window.confirm("Clear every item from this yard layout?")) return;
    setItems([]);
    setSelectedId(null);
    setSaved(false);
    toast.success("Yard map cleared");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
      <YardItemPalette onAdd={addItem} />

      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-slate-950/50">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/95 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Badge className="rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-300"><Crosshair className="mr-1 h-3 w-3" /> Live canvas</Badge>
            <span className="text-xs text-slate-500">{items.length} item{items.length === 1 ? "" : "s"}</span>
            <span className={`flex items-center gap-1 text-[11px] ${saved ? "text-emerald-400" : "text-amber-400"}`}><Save className="h-3 w-3" /> {saved ? "Saved" : "Saving…"}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => setScale((value) => Math.max(0.35, value - 0.1))} className="h-8 w-8 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white"><Minus className="h-4 w-4" /></Button>
            <span className="w-12 text-center text-xs font-bold text-slate-300">{Math.round(scale * 100)}%</span>
            <Button size="icon" variant="ghost" onClick={() => setScale((value) => Math.min(1.5, value + 0.1))} className="h-8 w-8 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white"><Plus className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" onClick={fitMap} className="h-8 rounded-lg text-xs text-slate-300 hover:bg-slate-800 hover:text-white"><Maximize2 className="mr-1.5 h-3.5 w-3.5" /> Fit</Button>
            <Button size="sm" variant="ghost" onClick={resetLayout} className="h-8 rounded-lg text-xs text-slate-400 hover:bg-rose-950/50 hover:text-rose-300"><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Clear</Button>
          </div>
        </div>

        <div
          ref={viewportRef}
          onDrop={handleDrop}
          onDragOver={(event) => event.preventDefault()}
          onPointerDown={startPan}
          onWheel={handleWheel}
          className="relative h-[62vh] min-h-[520px] cursor-grab overflow-hidden bg-slate-950 active:cursor-grabbing"
        >
          <div
            className="absolute origin-top-left overflow-hidden rounded-2xl border border-slate-700 bg-[#17251d] shadow-2xl"
            style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedId(null);
                startPan(event as unknown as ReactPointerEvent<HTMLDivElement>);
              }
            }}
          >
            <div className="pointer-events-none absolute inset-0 opacity-25" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.16) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
            <div className="pointer-events-none absolute left-6 top-5 rounded-full border border-white/15 bg-slate-950/55 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">North yard · 160 × 100 ft</div>

            {items.map((item) => (
              <YardItem
                key={item.id}
                item={item}
                selected={item.id === selectedId}
                scale={scale}
                bay={item.linkedEntityType === "YARD_BAY" ? bayById.get(item.linkedEntityId ?? "") : undefined}
                vehicle={item.linkedEntityType === "VEHICLE" ? vehicleById.get(item.linkedEntityId ?? "") : undefined}
                onSelect={() => setSelectedId(item.id)}
                onChange={(changes) => updateItem(item.id, changes)}
              />
            ))}

            {items.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="rounded-3xl border border-dashed border-white/20 bg-slate-950/55 px-10 py-8 text-center text-white shadow-xl">
                  <MousePointer2 className="mx-auto h-8 w-8 text-emerald-400" />
                  <p className="mt-3 text-lg font-black">Your yard is ready to map</p>
                  <p className="mt-1 text-sm text-slate-300">Drag an item from the left panel onto this canvas.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="lg:min-h-[620px]">
        {selectedItem ? (
          <ItemPropertiesPanel
            item={selectedItem}
            bays={bays}
            vehicles={vehicles}
            onChange={(changes) => updateItem(selectedItem.id, changes)}
            onDuplicate={duplicateSelected}
            onDelete={() => {
              setItems((current) => current.filter((item) => item.id !== selectedItem.id));
              setSelectedId(null);
              setSaved(false);
            }}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <aside className="rounded-2xl border border-slate-800 bg-slate-900/95 p-5 text-center shadow-2xl shadow-slate-950/40">
            <MousePointer2 className="mx-auto h-8 w-8 text-sky-400" />
            <h2 className="mt-3 text-base font-black text-white">Select a map item</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">Choose an item to edit its label, size, rotation, color, and live inventory connection.</p>
          </aside>
        )}
      </div>
    </div>
  );
}
