import type { YardMapItemType } from "@/types/scrap";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal } from "lucide-react";

export type MapCategoryFilter = "ALL" | YardMapItemType;

interface MapSearchFilterProps {
  query: string;
  category: MapCategoryFilter;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: MapCategoryFilter) => void;
}

const categories: Array<{ value: MapCategoryFilter; label: string }> = [
  { value: "ALL", label: "All items" },
  { value: "CAR", label: "Vehicles" },
  { value: "SCRAP_BIN", label: "Scrap bins" },
  { value: "BUILDING", label: "Buildings" },
  { value: "ZONE", label: "Zones" },
  { value: "ROAD", label: "Roads" },
  { value: "WALL", label: "Walls" },
  { value: "FENCE", label: "Fences" },
  { value: "CREEK", label: "Creeks" },
  { value: "NOTE", label: "Notes" },
];

export function MapSearchFilter({ query, category, onQueryChange, onCategoryChange }: MapSearchFilterProps) {
  return (
    <div className="flex flex-1 flex-col gap-2 sm:flex-row">
      <label className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Find a label, note, VIN, bay…" className="h-9 rounded-xl border-slate-700 bg-slate-950 pl-9 text-xs text-white placeholder:text-slate-600" />
      </label>
      <label className="relative">
        <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
        <select value={category} onChange={(event) => onCategoryChange(event.target.value as MapCategoryFilter)} className="h-9 w-full appearance-none rounded-xl border border-slate-700 bg-slate-950 py-0 pl-9 pr-8 text-xs font-semibold text-slate-200 outline-none focus:border-sky-500 sm:w-36">
          {categories.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
    </div>
  );
}
