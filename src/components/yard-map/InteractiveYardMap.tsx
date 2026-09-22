import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, PointerEvent as ReactPointerEvent, WheelEvent } from "react";
import type { MetalGrade, PullYardVehicle, YardBayLocation, YardMapItem, YardMapItemType } from "@/types/scrap";
import { storageService } from "@/services/storageService";
import { sharedStorage, type ConnectionStatus } from "@/services/sharedStorage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ItemPropertiesPanel } from "./ItemPropertiesPanel";
import { YardItemPalette } from "./YardItemPalette";
import { YardItem, type SnapGuides, type SnapTarget } from "./YardItem";
import { MapSearchFilter, type MapCategoryFilter } from "./MapSearchFilter";
import { MapControls, type HeatmapMetric, type SnapGridFt } from "./MapControls";
import { TimeTravelSlider } from "./TimeTravelSlider";
import { CloudOff, Crosshair, Eye, Loader2, Maximize2, Minus, MousePointer2, Plus, Ruler, RotateCcw, Save, Users, X } from "lucide-react";
import { toast } from "sonner";

const CANVAS_WIDTH = 2400;
const CANVAS_HEIGHT = 1500;
const PX_PER_FOOT = 10;

const itemDefaults: Record<YardMapItemType, Pick<YardMapItem, "label" | "width" | "height" | "color">> = {
  CAR: { label: "Vehicle space", width: 150, height: 74, color: "#f59e0b" },
  SCRAP_BIN: { label: "Scrap bin", width: 170, height: 130, color: "#10b981" },
  BUILDING: { label: "Building", width: 260, height: 170, color: "#6366f1" },
  ZONE: { label: "Work zone", width: 300, height: 190, color: "#0ea5e9" },
  ROAD: { label: "Haul road", width: 430, height: 70, color: "#475569" },
  WALL: { label: "Wall", width: 320, height: 42, color: "#92400e" },
  FENCE: { label: "Fence", width: 380, height: 34, color: "#78716c" },
  CREEK: { label: "Creek", width: 420, height: 64, color: "#0284c7" },
  NOTE: { label: "Team note", width: 210, height: 145, color: "#eab308" },
};

interface InteractiveYardMapProps { bays: YardBayLocation[]; vehicles: PullYardVehicle[]; metals: MetalGrade[]; }

export function InteractiveYardMap({ bays, vehicles, metals }: InteractiveYardMapProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const skipNextSaveRef = useRef(false);
  const [items, setItems] = useState<YardMapItem[]>(() => storageService.getYardLayout());
  const [syncStatus, setSyncStatus] = useState<ConnectionStatus>(() => sharedStorage.getStatus());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(0.5);
  const [pan, setPan] = useState({ x: 24, y: 24 });
  const [saved, setSaved] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MapCategoryFilter>("ALL");
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [heatmapMetric, setHeatmapMetric] = useState<HeatmapMetric>("FILL");
  const [nightMode, setNightMode] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [gridSizeFt, setGridSizeFt] = useState<SnapGridFt>(10);
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<Array<{ x: number; y: number }>>([]);
  const [cursorWorld, setCursorWorld] = useState<{ x: number; y: number } | null>(null);
  const [guides, setGuides] = useState<SnapGuides | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [historyDates, setHistoryDates] = useState<string[]>(() => storageService.getYardLayoutSnapshotDates());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const gridSizePx = gridSizeFt * PX_PER_FOOT;
  const displayItems = useMemo(() => {
    const source = selectedDate ? storageService.getYardLayoutSnapshot(selectedDate) : items;
    return source.filter((item) => !item.deletedAt);
  }, [items, selectedDate]);
  const selectedItem = selectedDate ? null : items.find((item) => item.id === selectedId && !item.deletedAt) ?? null;
  const bayById = useMemo(() => new Map(bays.map((bay) => [bay.id, bay])), [bays]);
  const vehicleById = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles]);
  const metalById = useMemo(() => new Map(metals.map((metal) => [metal.id, metal])), [metals]);
  const snapTargets = useMemo<SnapTarget[]>(() => displayItems.map((item) => ({ id: item.id, x: item.x, y: item.y, width: item.width, height: item.height })), [displayItems]);
  const handleGuides = useCallback((next: SnapGuides | null) => setGuides(next), []);

  useEffect(() => {
    if (selectedDate) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      storageService.saveYardLayout(items);
      setHistoryDates(storageService.getYardLayoutSnapshotDates());
      setSaved(true);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [items, selectedDate]);

  useEffect(() => {
    const unsubscribeStatus = sharedStorage.subscribe(setSyncStatus);
    const handleRemoteLayout = (event: Event) => {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      if (key !== "mahaffeys_yard_layout") return;
      const incoming = storageService.getYardLayout();
      setItems((current) => {
        const merged = new Map(incoming.map((item) => [item.id, { ...item }]));
        let preservedLocalEdit = false;
        current.forEach((localItem) => {
          const remoteItem = merged.get(localItem.id);
          const localUpdatedAt = Date.parse(localItem.updatedAt ?? "") || 0;
          const remoteUpdatedAt = Date.parse(remoteItem?.updatedAt ?? "") || 0;
          if (!remoteItem || localUpdatedAt > remoteUpdatedAt) {
            merged.set(localItem.id, localItem);
            preservedLocalEdit = true;
          }
        });
        skipNextSaveRef.current = !preservedLocalEdit;
        return [...merged.values()];
      });
      setSaved(true);
    };
    window.addEventListener("mahaffeys:remote-sync", handleRemoteLayout);
    return () => {
      unsubscribeStatus();
      window.removeEventListener("mahaffeys:remote-sync", handleRemoteLayout);
    };
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).matches("input, textarea, select, [role='combobox']")) return;
      if (event.key === "Escape") {
        if (measureMode) {
          setMeasureMode(false);
          setMeasurePoints([]);
        } else {
          setSelectedId(null);
        }
        return;
      }
      if (!selectedDate && (event.key === "Delete" || event.key === "Backspace") && selectedId) {
        const deletedAt = new Date().toISOString();
        setItems((current) => current.map((item) => item.id === selectedId ? { ...item, deletedAt, updatedAt: deletedAt } : item));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedId, selectedDate, measureMode]);

  const clientToWorld = (clientX: number, clientY: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: (clientX - rect.left - pan.x) / scale, y: (clientY - rect.top - pan.y) / scale };
  };

  const updateItem = (id: string, changes: Partial<YardMapItem>) => {
    if (selectedDate) return;
    setSaved(false);
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item));
  };

  const addItem = (type: YardMapItemType, point?: { x: number; y: number }) => {
    if (selectedDate) { toast.info("Return to the live layout to make changes"); return; }
    const defaults = itemDefaults[type];
    const viewport = viewportRef.current;
    const center = point ?? { x: viewport ? (viewport.clientWidth / 2 - pan.x) / scale : 700, y: viewport ? (viewport.clientHeight / 2 - pan.y) / scale : 450 };
    const item: YardMapItem = {
      id: `yard-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, ...defaults,
      x: Math.max(0, Math.min(CANVAS_WIDTH - defaults.width, center.x - defaults.width / 2)),
      y: Math.max(0, Math.min(CANVAS_HEIGHT - defaults.height, center.y - defaults.height / 2)), rotation: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      noteText: type === "NOTE" ? "New task or safety reminder" : undefined,
      currentLbs: type === "SCRAP_BIN" ? 0 : undefined,
      capacityLbs: type === "SCRAP_BIN" ? 20000 : undefined,
    };
    setSaved(false); setItems((current) => [...current, item]); setSelectedId(item.id);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/yard-item") as YardMapItemType;
    if (!itemDefaults[type]) return;
    const rect = viewportRef.current?.getBoundingClientRect(); if (!rect) return;
    addItem(type, { x: (event.clientX - rect.left - pan.x) / scale, y: (event.clientY - rect.top - pan.y) / scale });
  };

  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    setSelectedId(null);
    const startX = event.clientX; const startY = event.clientY; const origin = pan;
    const move = (next: PointerEvent) => setPan({ x: origin.x + next.clientX - startX, y: origin.y + next.clientY - startY });
    const end = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", end);
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const nextScale = Math.max(0.25, Math.min(1.5, scale * (event.deltaY > 0 ? 0.9 : 1.1)));
    const rect = viewportRef.current?.getBoundingClientRect(); if (!rect) return;
    const cursorX = event.clientX - rect.left; const cursorY = event.clientY - rect.top;
    const worldX = (cursorX - pan.x) / scale; const worldY = (cursorY - pan.y) / scale;
    setPan({ x: cursorX - worldX * nextScale, y: cursorY - worldY * nextScale }); setScale(nextScale);
  };

  const fitMap = () => {
    const viewport = viewportRef.current; if (!viewport) return;
    const nextScale = Math.min((viewport.clientWidth - 32) / CANVAS_WIDTH, (viewport.clientHeight - 32) / CANVAS_HEIGHT, 1);
    setScale(nextScale); setPan({ x: (viewport.clientWidth - CANVAS_WIDTH * nextScale) / 2, y: (viewport.clientHeight - CANVAS_HEIGHT * nextScale) / 2 });
  };

  const handleLocate = (id: string) => {
    const target = displayItems.find((item) => item.id === id);
    const viewport = viewportRef.current;
    if (!target || !viewport) return;
    const nextScale = Math.max(scale, 0.6);
    setScale(nextScale);
    setPan({
      x: viewport.clientWidth / 2 - (target.x + target.width / 2) * nextScale,
      y: viewport.clientHeight / 2 - (target.y + target.height / 2) * nextScale,
    });
    setSelectedId(selectedDate ? null : id);
    setFlashId(id);
    window.setTimeout(() => setFlashId((current) => current === id ? null : current), 1600);
  };

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return displayItems.filter((item) => {
      if (category !== "ALL" && item.type !== category) return false;
      if (!needle) return true;
      const bay = item.linkedEntityType === "YARD_BAY" ? bayById.get(item.linkedEntityId ?? "") : undefined;
      const vehicle = item.linkedEntityType === "VEHICLE" ? vehicleById.get(item.linkedEntityId ?? "") : undefined;
      const metal = metalById.get(item.materialGradeId ?? "");
      return [item.label, item.noteText, bay?.bayName, metal?.name, metal?.code, vehicle?.vin, vehicle?.make, vehicle?.model].some((value) => value?.toLowerCase().includes(needle));
    });
  }, [displayItems, category, query, bayById, vehicleById, metalById]);

  const locateSuggestions = useMemo(() => selectedDate ? [] : visibleItems.slice(0, 6).map((item) => ({ id: item.id, label: item.label, kind: item.type })), [visibleItems, selectedDate]);

  const getHeatColor = (item: YardMapItem) => {
    if (!heatmapEnabled) return undefined;
    const bay = item.linkedEntityType === "YARD_BAY" ? bayById.get(item.linkedEntityId ?? "") : undefined;
    const vehicle = item.linkedEntityType === "VEHICLE" ? vehicleById.get(item.linkedEntityId ?? "") : undefined;
    const metal = metalById.get(item.materialGradeId ?? "");
    let score = 0;
    if (heatmapMetric === "FILL") score = bay ? bay.currentLbs / Math.max(1, bay.capacityLbs) : (item.currentLbs ?? 0) / Math.max(1, item.capacityLbs ?? 1);
    if (heatmapMetric === "VALUE") score = bay ? bay.estValueUsd / 50000 : metal ? ((item.currentLbs ?? 0) * metal.ratePerLb) / 50000 : vehicle ? (vehicle.purchasePrice ?? 0) / 10000 : 0;
    if (heatmapMetric === "AGE") score = vehicle ? (Date.now() - new Date(vehicle.dateSetInYard).getTime()) / 86400000 / 120 : item.createdAt ? (Date.now() - new Date(item.createdAt).getTime()) / 86400000 / 120 : 0;
    const normalized = Math.max(0, Math.min(1, score));
    const hue = Math.round(120 - normalized * 120);
    return `hsla(${hue}, 88%, 44%, 0.9)`;
  };

  const measureTotalFt = useMemo(() => {
    let totalPx = 0;
    for (let index = 1; index < measurePoints.length; index += 1) {
      totalPx += Math.hypot(measurePoints[index].x - measurePoints[index - 1].x, measurePoints[index].y - measurePoints[index - 1].y);
    }
    return totalPx / PX_PER_FOOT;
  }, [measurePoints]);

  const measureAreaFt2 = useMemo(() => {
    if (measurePoints.length < 3) return 0;
    let sum = 0;
    for (let index = 0; index < measurePoints.length; index += 1) {
      const current = measurePoints[index];
      const next = measurePoints[(index + 1) % measurePoints.length];
      sum += current.x * next.y - next.x * current.y;
    }
    return Math.abs(sum) / 2 / (PX_PER_FOOT * PX_PER_FOOT);
  }, [measurePoints]);

  const duplicateSelected = () => {
    if (!selectedItem) return;
    const now = new Date().toISOString();
    const copy = { ...selectedItem, id: `yard-${Date.now()}`, label: `${selectedItem.label} copy`, x: selectedItem.x + 24, y: selectedItem.y + 24, createdAt: now, updatedAt: now, deletedAt: undefined };
    setItems((current) => [...current, copy]); setSelectedId(copy.id); setSaved(false);
  };

  const resetLayout = () => {
    if (displayItems.length > 0 && !window.confirm("Clear every item from this yard layout?")) return;
    const deletedAt = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, deletedAt, updatedAt: deletedAt })));
    setSelectedId(null); setSaved(false); toast.success("Yard map cleared");
  };

  const measureSvgPoints = measurePoints.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className={`space-y-4 ${nightMode ? "yard-map-night" : "yard-map-day"}`}>
      <div className="yard-map-no-print grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]"><MapSearchFilter query={query} category={category} suggestions={locateSuggestions} onQueryChange={setQuery} onCategoryChange={setCategory} onLocate={handleLocate} /><TimeTravelSlider dates={historyDates} selectedDate={selectedDate} onDateChange={(date) => { setSelectedDate(date); setSelectedId(null); }} /></div>
        <MapControls heatmapEnabled={heatmapEnabled} heatmapMetric={heatmapMetric} nightMode={nightMode} snapEnabled={snapEnabled} gridSizeFt={gridSizeFt} measureMode={measureMode} onToggleHeatmap={() => setHeatmapEnabled((value) => !value)} onMetricChange={setHeatmapMetric} onToggleNight={() => setNightMode((value) => !value)} onPrint={() => window.print()} onToggleSnap={() => setSnapEnabled((value) => !value)} onGridSizeChange={setGridSizeFt} onToggleMeasure={() => setMeasureMode((value) => { if (value) setMeasurePoints([]); return !value; })} />
      </div>

      <div className="yard-map-layout grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
        <YardItemPalette onAdd={addItem} />
        <section className="yard-map-print-shell min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-slate-950/50">
          <div className="yard-map-no-print flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/95 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={`rounded-full ${selectedDate ? "border-violet-500/30 bg-violet-500/10 text-violet-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}><Crosshair className="mr-1 h-3 w-3" /> {selectedDate ? "Historical" : "Live canvas"}</Badge>
              {!selectedDate && <Badge className={`rounded-full ${syncStatus === "connected" ? "border-sky-500/30 bg-sky-500/10 text-sky-300" : syncStatus === "error" ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : "border-slate-600 bg-slate-800 text-slate-300"}`}>{syncStatus === "connected" ? <Users className="mr-1 h-3 w-3" /> : syncStatus === "connecting" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CloudOff className="mr-1 h-3 w-3" />}{syncStatus === "connected" ? "Shared live" : syncStatus === "connecting" ? "Connecting" : syncStatus === "error" ? "Offline queue" : "Local only"}</Badge>}
              {measureMode && <Badge className="rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-300"><Ruler className="mr-1 h-3 w-3" /> Measuring</Badge>}
              <span className="text-xs text-slate-500">{visibleItems.length} of {displayItems.length} visible</span>
              {!selectedDate && <span className={`flex items-center gap-1 text-[11px] ${saved ? "text-emerald-400" : "text-amber-400"}`}><Save className="h-3 w-3" /> {saved ? "Saved" : "Saving…"}</span>}
            </div>
            <div className="flex items-center gap-1"><Button size="icon" variant="ghost" onClick={() => setScale((value) => Math.max(0.25, value - 0.1))} className="h-8 w-8 rounded-lg text-slate-300"><Minus className="h-4 w-4" /></Button><span className="w-12 text-center text-xs font-bold text-slate-300">{Math.round(scale * 100)}%</span><Button size="icon" variant="ghost" onClick={() => setScale((value) => Math.min(1.5, value + 0.1))} className="h-8 w-8 rounded-lg text-slate-300"><Plus className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={fitMap} className="h-8 rounded-lg text-xs text-slate-300"><Maximize2 className="mr-1.5 h-3.5 w-3.5" /> Fit</Button>{!selectedDate && <Button size="sm" variant="ghost" onClick={resetLayout} className="h-8 rounded-lg text-xs text-slate-400 hover:text-rose-300"><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Clear</Button>}</div>
          </div>
          <div
            ref={viewportRef}
            onDrop={handleDrop}
            onDragOver={(event) => event.preventDefault()}
            onPointerDown={startPan}
            onPointerMove={(event) => setCursorWorld(clientToWorld(event.clientX, event.clientY))}
            onPointerLeave={() => setCursorWorld(null)}
            onWheel={handleWheel}
            className={`yard-map-viewport relative h-[68vh] min-h-[560px] cursor-grab overflow-hidden active:cursor-grabbing ${nightMode ? "bg-slate-950" : "bg-slate-200"} ${measureMode ? "cursor-crosshair" : ""}`}
          >
            <div
              className={`yard-map-canvas absolute origin-top-left overflow-hidden rounded-2xl border shadow-2xl ${nightMode ? "border-slate-700 bg-[#17251d]" : "border-emerald-200 bg-[#dbe8d4]"}`}
              style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
              onPointerDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (measureMode) {
                  const world = clientToWorld(event.clientX, event.clientY);
                  if (world) setMeasurePoints((current) => [...current, world]);
                  return;
                }
                setSelectedId(null);
                startPan(event as unknown as ReactPointerEvent<HTMLDivElement>);
              }}
            >
              <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.2) 1px, transparent 1px)", backgroundSize: snapEnabled ? `${gridSizePx}px ${gridSizePx}px` : "40px 40px", opacity: snapEnabled ? 0.35 : 0.25 }} />
              <div className="pointer-events-none absolute left-6 top-5 rounded-full border border-white/20 bg-slate-950/65 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white/75">North yard · 240 × 150 ft</div>

              {guides && (guides.x.length > 0 || guides.y.length > 0) && (
                <div className="yard-map-transient pointer-events-none absolute inset-0 z-30">
                  {guides.x.map((x) => <span key={`gx-${x}`} className="absolute bottom-0 top-0 w-px bg-fuchsia-400/80" style={{ left: x }} />)}
                  {guides.y.map((y) => <span key={`gy-${y}`} className="absolute right-0 h-px w-full bg-fuchsia-400/80" style={{ top: y }} />)}
                </div>
              )}

              {visibleItems.map((item) => (
                <YardItem
                  key={item.id}
                  item={item}
                  selected={!selectedDate && item.id === selectedId}
                  scale={scale}
                  bay={item.linkedEntityType === "YARD_BAY" ? bayById.get(item.linkedEntityId ?? "") : undefined}
                  vehicle={item.linkedEntityType === "VEHICLE" ? vehicleById.get(item.linkedEntityId ?? "") : undefined}
                  metal={metalById.get(item.materialGradeId ?? "")}
                  heatColor={getHeatColor(item)}
                  readOnly={Boolean(selectedDate)}
                  flash={item.id === flashId}
                  snapEnabled={snapEnabled && !selectedDate}
                  gridSizePx={gridSizePx}
                  snapTargets={snapTargets}
                  onGuides={handleGuides}
                  onSelect={() => setSelectedId(item.id)}
                  onChange={(changes) => updateItem(item.id, changes)}
                />
              ))}

              {measurePoints.length > 0 && (
                <svg className="yard-map-transient pointer-events-none absolute inset-0 z-30 h-full w-full" viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`} preserveAspectRatio="none">
                  {measurePoints.length >= 3 && <polygon points={measureSvgPoints} fill="rgba(52,211,153,0.18)" stroke="none" />}
                  {measurePoints.length >= 2 && <polyline points={measureSvgPoints} fill="none" stroke="#34d399" strokeWidth={6} strokeLinejoin="round" />}
                  {measureMode && cursorWorld && measurePoints.length > 0 && (
                    <line x1={measurePoints[measurePoints.length - 1].x} y1={measurePoints[measurePoints.length - 1].y} x2={cursorWorld.x} y2={cursorWorld.y} stroke="#34d399" strokeWidth={5} strokeDasharray="14 10" opacity={0.8} />
                  )}
                  {measurePoints.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={11} fill="#0f172a" stroke="#34d399" strokeWidth={5} />)}
                </svg>
              )}

              {visibleItems.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="rounded-3xl border border-dashed border-white/25 bg-slate-950/65 px-10 py-8 text-center text-white shadow-xl">
                    {displayItems.length ? <Eye className="mx-auto h-8 w-8 text-sky-400" /> : <MousePointer2 className="mx-auto h-8 w-8 text-emerald-400" />}
                    <p className="mt-3 text-lg font-black">{displayItems.length ? "No matching map items" : "Your yard is ready to map"}</p>
                    <p className="mt-1 text-sm text-slate-300">{displayItems.length ? "Adjust the search or category filter." : "Drag an item from the left panel onto this canvas."}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="yard-map-no-print pointer-events-none absolute bottom-3 left-3 z-40 flex flex-wrap items-center gap-2">
              {cursorWorld && (
                <span className="rounded-lg border border-slate-700 bg-slate-950/85 px-2.5 py-1.5 font-mono text-[11px] font-bold text-emerald-300">
                  {Math.max(0, Math.round(cursorWorld.x / PX_PER_FOOT))} ft · {Math.max(0, Math.round(cursorWorld.y / PX_PER_FOOT))} ft
                </span>
              )}
              {measureMode && (
                <span className="rounded-lg border border-emerald-500/40 bg-slate-950/85 px-2.5 py-1.5 font-mono text-[11px] font-bold text-emerald-300">
                  {measurePoints.length === 0 ? "Click the map to start measuring" : `${Math.round(measureTotalFt)} ft${measureAreaFt2 > 0 ? ` · ${Math.round(measureAreaFt2).toLocaleString()} ft²` : ""}`}
                </span>
              )}
              {measureMode && measurePoints.length > 0 && (
                <Button size="sm" variant="outline" className="pointer-events-auto h-7 rounded-lg border-emerald-500/40 bg-slate-950/85 px-2 text-[11px] text-emerald-300" onClick={() => setMeasurePoints([])}>Clear</Button>
              )}
              {measureMode && (
                <Button size="sm" variant="outline" className="pointer-events-auto h-7 rounded-lg border-slate-600 bg-slate-950/85 px-2 text-[11px] text-slate-300" onClick={() => { setMeasureMode(false); setMeasurePoints([]); }}><X className="mr-1 h-3 w-3" /> Exit</Button>
              )}
            </div>
          </div>
        </section>
        <div className="yard-map-no-print lg:min-h-[620px]">{selectedItem ? <ItemPropertiesPanel item={selectedItem} bays={bays} vehicles={vehicles} metals={metals} onChange={(changes) => updateItem(selectedItem.id, changes)} onDuplicate={duplicateSelected} onDelete={() => { const deletedAt = new Date().toISOString(); setItems((current) => current.map((item) => item.id === selectedItem.id ? { ...item, deletedAt, updatedAt: deletedAt } : item)); setSelectedId(null); setSaved(false); }} onClose={() => setSelectedId(null)} /> : <aside className="rounded-2xl border border-slate-800 bg-slate-900/95 p-5 text-center shadow-2xl shadow-slate-950/40"><MousePointer2 className="mx-auto h-8 w-8 text-sky-400" /><h2 className="mt-3 text-base font-black text-white">{selectedDate ? "Historical snapshot" : "Select a map item"}</h2><p className="mt-2 text-xs leading-relaxed text-slate-400">{selectedDate ? "Past layouts are read-only. Move the timeline to Live layout to edit." : "Choose an item to edit its details, size, rotation, color, and inventory connection."}</p></aside>}</div>
      </div>
    </div>
  );
}
