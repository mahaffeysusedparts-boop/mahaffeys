import { useState } from "react";
import type { YardMapItemType } from "@/types/scrap";
import { Input } from "@/components/ui/input";
import { LocateFixed, Search, SlidersHorizontal } from "lucide-react";

export type MapCategoryFilter = "ALL" | YardMapItemType;

export interface LocateSuggestion {
  id: string;
  label: string;
  kind: YardMapItemType;
}

interface MapSearchFilterProps {
  query: string;
  category: MapCategoryFilter;
  suggestions: LocateSuggestion[];
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: MapCategoryFilter) => void;
  onLocate: (id: string) => void;
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

export function MapSearchFilter({ query, category, suggestions, onQueryChange, onCategoryChange, onLocate }: MapSearchFilterProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const showSuggestions = dropdownOpen && query.trim().length > 0 && suggestions.length > 0;

  return (
    <div className="relative flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          value={query}
          onChange={(event) => { onQueryChange(event.target.value); setDropdownOpen(true); }}
          onFocus={() => setDropdownOpen(true)}
          onBlur={() => window.setTimeout(() => setDropdownOpen(false), 150)}
          placeholder="Find a label, note, VIN, bay…"
          className="h-9 rounded-xl border-slate-700 bg-slate-950 pl-9 text-xs text-white placeholder:text-slate-600"
        />
        {showSuggestions && (
          <div className="absolute left-0 right-0 top-10 z-30 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-slate-950/60">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => { onLocate(suggestion.id); setDropdownOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-200 transition hover:bg-sky-500/15 hover:text-white"
              >
                <LocateFixed className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                <span className="min-w-0 flex-1 truncate">{suggestion.label}</span>
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-500">{suggestion.kind.replace("_", " ")}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <label className="relative">
        <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
        <select value={category} onChange={(event) => onCategoryChange(event.target.value as MapCategoryFilter)} className="h-9 w-full appearance-none rounded-xl border border-slate-700 bg-slate-950 py-0 pl-9 pr-8 text-xs font-semibold text-slate-200 outline-none focus:border-sky-500 sm:w-36">
          {categories.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
    </div>
  );
}
