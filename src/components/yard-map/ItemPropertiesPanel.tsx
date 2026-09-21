import type { PullYardVehicle, YardBayLocation, YardMapItem } from "@/types/scrap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Link2, RotateCw, Trash2, X } from "lucide-react";

const colors = ["#f59e0b", "#10b981", "#0ea5e9", "#6366f1", "#e11d48", "#a855f7", "#64748b"];

interface ItemPropertiesPanelProps {
  item: YardMapItem;
  bays: YardBayLocation[];
  vehicles: PullYardVehicle[];
  onChange: (changes: Partial<YardMapItem>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ItemPropertiesPanel({ item, bays, vehicles, onChange, onDuplicate, onDelete, onClose }: ItemPropertiesPanelProps) {
  const linkValue = item.linkedEntityType && item.linkedEntityId
    ? `${item.linkedEntityType}:${item.linkedEntityId}`
    : "none";

  const updateLink = (value: string) => {
    if (value === "none") {
      onChange({ linkedEntityType: undefined, linkedEntityId: undefined });
      return;
    }
    const separator = value.indexOf(":");
    onChange({
      linkedEntityType: value.slice(0, separator) as YardMapItem["linkedEntityType"],
      linkedEntityId: value.slice(separator + 1),
    });
  };

  return (
    <aside className="rounded-2xl border border-slate-800 bg-slate-900/95 p-4 shadow-2xl shadow-slate-950/50">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-400">Selected item</p>
          <h2 className="mt-1 text-lg font-black text-white">Edit properties</h2>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose} className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-800 hover:text-white">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="yard-item-label" className="text-xs text-slate-300">Map label</Label>
          <Input id="yard-item-label" value={item.label} onChange={(event) => onChange({ label: event.target.value })} className="rounded-xl border-slate-700 bg-slate-950 text-white" />
        </div>

        {item.type === "NOTE" && (
          <div className="space-y-1.5">
            <Label htmlFor="yard-note-text" className="text-xs text-slate-300">Note or task details</Label>
            <Textarea id="yard-note-text" value={item.noteText ?? ""} onChange={(event) => onChange({ noteText: event.target.value })} placeholder="Add instructions, a reminder, or a safety warning…" className="min-h-28 rounded-xl border-slate-700 bg-slate-950 text-white placeholder:text-slate-600" />
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs text-slate-300">Marker color</Label>
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => (
              <button
                type="button"
                key={color}
                aria-label={`Use color ${color}`}
                onClick={() => onChange({ color })}
                className={`h-8 w-8 rounded-full border-2 transition hover:scale-110 ${item.color === color ? "border-white ring-2 ring-white/20" : "border-transparent"}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {item.type !== "NOTE" && (
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-slate-300"><Link2 className="h-3.5 w-3.5" /> Inventory connection</Label>
            <Select value={linkValue} onValueChange={updateLink}>
              <SelectTrigger className="rounded-xl border-slate-700 bg-slate-950 text-slate-200">
                <SelectValue placeholder="No linked inventory" />
              </SelectTrigger>
              <SelectContent className="border-slate-700 bg-slate-900 text-slate-100">
                <SelectItem value="none">No linked inventory</SelectItem>
                {bays.map((bay) => <SelectItem key={bay.id} value={`YARD_BAY:${bay.id}`}>Bin · {bay.bayName}</SelectItem>)}
                {vehicles.map((vehicle) => <SelectItem key={vehicle.id} value={`VEHICLE:${vehicle.id}`}>{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.vin.slice(-6)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="yard-width" className="text-xs text-slate-300">Width</Label>
            <Input id="yard-width" type="number" min={40} max={600} value={Math.round(item.width)} onChange={(event) => onChange({ width: Math.max(40, Number(event.target.value) || 40) })} className="rounded-xl border-slate-700 bg-slate-950 text-white" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="yard-height" className="text-xs text-slate-300">Height</Label>
            <Input id="yard-height" type="number" min={40} max={500} value={Math.round(item.height)} onChange={(event) => onChange({ height: Math.max(40, Number(event.target.value) || 40) })} className="rounded-xl border-slate-700 bg-slate-950 text-white" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="yard-rotation" className="flex items-center gap-1.5 text-xs text-slate-300"><RotateCw className="h-3.5 w-3.5" /> Rotation</Label>
          <Input id="yard-rotation" type="number" min={0} max={359} value={Math.round(item.rotation)} onChange={(event) => onChange({ rotation: ((Number(event.target.value) || 0) + 360) % 360 })} className="rounded-xl border-slate-700 bg-slate-950 text-white" />
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-4">
          <Button variant="outline" onClick={onDuplicate} className="rounded-xl border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800 hover:text-white"><Copy className="mr-2 h-4 w-4" /> Duplicate</Button>
          <Button variant="outline" onClick={onDelete} className="rounded-xl border-rose-900/70 bg-rose-950/30 text-rose-300 hover:bg-rose-950 hover:text-rose-200"><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
        </div>
      </div>
    </aside>
  );
}
