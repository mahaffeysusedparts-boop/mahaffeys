import { CalendarClock, History } from "lucide-react";

interface TimeTravelSliderProps {
  dates: string[];
  selectedDate: string | null;
  onDateChange: (date: string | null) => void;
}

export function TimeTravelSlider({ dates, selectedDate, onDateChange }: TimeTravelSliderProps) {
  const options = [...dates, "LIVE"];
  const currentIndex = selectedDate ? Math.max(0, dates.indexOf(selectedDate)) : options.length - 1;
  const label = selectedDate
    ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "Live layout";

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-3 sm:flex-row sm:items-center">
      <div className="flex shrink-0 items-center gap-2 text-violet-200">
        {selectedDate ? <History className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
        <div><p className="text-[10px] font-black uppercase tracking-wider">Time travel</p><p className="text-xs font-bold text-white">{label}</p></div>
      </div>
      <input aria-label="Historical layout date" type="range" min={0} max={Math.max(0, options.length - 1)} value={currentIndex} onChange={(event) => { const value = options[Number(event.target.value)]; onDateChange(value === "LIVE" ? null : value); }} className="h-2 min-w-0 flex-1 cursor-pointer accent-violet-400" />
      <span className="text-[10px] font-semibold text-violet-200/70">{selectedDate ? "Read-only snapshot" : `${dates.length} saved day${dates.length === 1 ? "" : "s"}`}</span>
    </div>
  );
}
