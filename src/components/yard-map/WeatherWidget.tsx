import { useEffect, useState } from "react";
import { CloudSun, Droplets, Loader2, MapPin, Wind } from "lucide-react";

interface WeatherData {
  location: string;
  temperatureF: number;
  condition: string;
  windMph: number;
  humidity: number;
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async (lat?: number, lon?: number) => {
      try {
        const params = lat === undefined ? "" : `?lat=${lat}&lon=${lon}`;
        const response = await fetch(`/api/weather${params}`);
        if (!response.ok) throw new Error("Weather unavailable");
        const data = await response.json() as WeatherData;
        if (active) setWeather(data);
      } catch {
        if (active) setWeather(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => void load(coords.latitude, coords.longitude),
        () => void load(),
        { timeout: 3500, maximumAge: 900000 },
      );
    } else {
      void load();
    }
    return () => { active = false; };
  }, []);

  return (
    <div className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sky-50 shadow-lg shadow-sky-950/20">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-300">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CloudSun className="h-6 w-6" />}
      </span>
      {weather ? (
        <div className="min-w-0">
          <div className="flex items-baseline gap-2"><strong className="text-2xl font-black">{weather.temperatureF}°</strong><span className="truncate text-xs font-bold text-sky-200">{weather.condition}</span></div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-sky-200/75">
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{weather.location}</span>
            <span className="flex items-center gap-1"><Wind className="h-3 w-3" />{weather.windMph} mph</span>
            <span className="flex items-center gap-1"><Droplets className="h-3 w-3" />{weather.humidity}%</span>
          </div>
        </div>
      ) : (
        <div><p className="text-sm font-bold">Weather unavailable</p><p className="text-[11px] text-sky-200/70">Map tools remain online.</p></div>
      )}
    </div>
  );
}
