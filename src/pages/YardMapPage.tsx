import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { InteractiveYardMap } from "@/components/yard-map/InteractiveYardMap";
import { WeatherWidget } from "@/components/yard-map/WeatherWidget";
import { storageService } from "@/services/storageService";
import type { MetalGrade, PullYardVehicle, YardBayLocation } from "@/types/scrap";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CarFront, Map, PackageOpen, Sparkles } from "lucide-react";

export default function YardMapPage() {
  const [bays, setBays] = useState<YardBayLocation[]>([]);
  const [vehicles, setVehicles] = useState<PullYardVehicle[]>([]);
  const [metals, setMetals] = useState<MetalGrade[]>([]);

  useEffect(() => {
    const refreshBays = () => setBays([...storageService.getYardBays()]);
    const refreshVehicles = () => setVehicles(storageService.getPullYardVehicles().filter((vehicle) => vehicle.status !== "CRUSHED"));
    const refreshMetals = () => setMetals([...storageService.getMetals()]);
    refreshBays();
    refreshVehicles();
    refreshMetals();
    const unsubscribeBays = storageService.subscribe("mahaffeys_yard_bays", refreshBays);
    const unsubscribeVehicles = storageService.subscribe("mahaffeys_pull_yard_vehicles", refreshVehicles);
    const unsubscribeMetals = storageService.subscribe("mahaffeys_metals", refreshMetals);
    return () => {
      unsubscribeBays();
      unsubscribeVehicles();
      unsubscribeMetals();
    };
  }, []);

  const fullBays = bays.filter((bay) => bay.status === "CRITICAL_FULL").length;

  return (
    <div className="yard-map-page flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-[1900px] flex-1 space-y-5 px-3 py-5 sm:px-5 lg:px-7">
        <header className="yard-map-no-print relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 px-5 py-5 shadow-2xl shadow-slate-950/40 sm:px-7">
          <div className="absolute right-[-45px] top-[-55px] h-40 w-40 rounded-full bg-emerald-500/10 blur-2xl" />
          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/15 text-emerald-300 shadow-lg shadow-emerald-950/30">
                <Map className="h-7 w-7" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Yard Map Builder</h1>
                  <Badge className="rounded-full border-sky-500/30 bg-sky-500/10 text-sky-300"><Sparkles className="mr-1 h-3 w-3" /> Interactive</Badge>
                </div>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">Design the yard visually, position cars and scrap storage, then connect each marker to live inventory.</p>
              </div>
            </div>

            <div className="grid gap-2 sm:min-w-[540px] sm:grid-cols-[1fr_1fr]">
              <WeatherWidget />
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2.5">
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500"><PackageOpen className="h-3 w-3" /> Bays</span>
                  <strong className="mt-0.5 block text-xl font-black text-emerald-400">{bays.length}</strong>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2.5">
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500"><CarFront className="h-3 w-3" /> Vehicles</span>
                  <strong className="mt-0.5 block text-xl font-black text-amber-400">{vehicles.length}</strong>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2.5">
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500"><AlertTriangle className="h-3 w-3" /> Full bays</span>
                  <strong className={`mt-0.5 block text-xl font-black ${fullBays ? "text-rose-400" : "text-slate-300"}`}>{fullBays}</strong>
                </div>
              </div>
            </div>
          </div>
        </header>

        <InteractiveYardMap bays={bays} vehicles={vehicles} metals={metals} />
      </main>
    </div>
  );
}
