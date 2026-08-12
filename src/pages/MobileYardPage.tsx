"use client";

import React, { useState, useEffect, useRef } from "react";
import { storageService } from "@/services/storageService";
import { sharedStorage } from "@/services/sharedStorage";
import { PullYardVehicle, PullYardVehicleStatus, VehicleRelocationLog } from "@/types/scrap";
import { Navbar } from "@/components/layout/Navbar";
import { analyzeVinImage, analyzeLicensePlateImage } from "@/services/aiVisionService";
import { generateSamplePhoto } from "@/utils/complianceUtils";
import { TowDropModal } from "@/components/mobile-yard/TowDropModal";
import { YardRelocateModal } from "@/components/mobile-yard/YardRelocateModal";
import { DismantleChecklistModal } from "@/components/mobile-yard/DismantleChecklistModal";
import { YardWindowTagModal } from "@/components/inventory/YardWindowTagModal";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Truck,
  MapPin,
  Wrench,
  Scan,
  Camera,
  Search,
  Plus,
  RotateCcw,
  CheckCircle2,
  Clock,
  Car,
  Wifi,
  WifiOff,
  Sparkles,
  Droplets,
  Printer,
  ChevronRight,
  RefreshCw,
  Eye,
  ArrowRight,
  Layers3,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

export default function MobileYardPage() {
  const [vehicles, setVehicles] = useState<PullYardVehicle[]>([]);
  const [relocLogs, setRelocLogs] = useState<VehicleRelocationLog[]>([]);
  const [activeTab, setActiveTab] = useState<string>("drops");
  const [search, setSearch] = useState<string>("");

  // Modal States
  const [towDropModalOpen, setTowDropModalOpen] = useState(false);
  const [relocateModalVeh, setRelocateModalVeh] = useState<PullYardVehicle | null>(null);
  const [dismantleModalVeh, setDismantleModalVeh] = useState<PullYardVehicle | null>(null);
  const [tagModalVeh, setTagModalVeh] = useState<PullYardVehicle | null>(null);

  // Quick Scanner Camera State
  const [scanResultVeh, setScanResultVeh] = useState<PullYardVehicle | null>(null);
  const scannerInputRef = useRef<HTMLInputElement>(null);

  const loadData = () => {
    const list = storageService.getPullYardVehicles();
    setVehicles(list);
    setRelocLogs(storageService.getRelocationLogs());
  };

  useEffect(() => {
    loadData();

    const interval = setInterval(loadData, 2500);
    const unsub = sharedStorage.subscribe(() => loadData());

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, []);

  const handleScannerCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.info("AI Scanner reading barcode / VIN tag photo...", { icon: "✨" });
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const dataUrl = evt.target?.result as string;
        try {
          const res = await analyzeVinImage(dataUrl);
          if (res.vin) {
            const match = vehicles.find(
              (v) => v.vin.toLowerCase() === res.vin.toLowerCase() || v.id.toLowerCase() === res.vin.toLowerCase()
            );
            if (match) {
              setScanResultVeh(match);
              toast.success(`Found Yard Vehicle! ${match.year} ${match.make} ${match.model} (${match.section})`);
            } else {
              toast.info(`Scanned VIN: ${res.vin} (No matching yard vehicle found in inventory)`);
              setSearch(res.vin);
            }
          } else {
            toast.error("Could not read VIN barcode clearly. Try adjusting camera angle.");
          }
        } catch (err) {
          console.warn("Scanner error:", err);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredVehicles = vehicles.filter((v) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      v.make.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      v.year.toString().includes(q) ||
      v.vin.toLowerCase().includes(q) ||
      v.section.toLowerCase().includes(q) ||
      (v.stockNumber && v.stockNumber.toLowerCase().includes(q)) ||
      (v.rowNumber && v.rowNumber.toLowerCase().includes(q))
    );
  });

  const pendingCount = vehicles.filter((v) => v.status === "PENDING").length;
  const availableCount = vehicles.filter((v) => v.status === "AVAILABLE").length;
  const crushedCount = vehicles.filter((v) => v.status === "CRUSHED").length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-16">
      <Navbar />

      <input
        type="file"
        ref={scannerInputRef}
        onChange={handleScannerCapture}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5">
        
        {/* Mobile Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/60 p-4 sm:p-6 rounded-2xl border border-slate-800 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] sm:text-xs font-mono">
                  MOBILE FIELD WORKSTATION
                </Badge>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-mono gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" /> FIELD SYNC
                </Badge>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono mt-1">
                Mobile Yard Scan & Tow Driver Hub
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Touch-optimized workstation for tow drop-offs, forklift vehicle relocations, and environmental prep checklists
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => scannerInputRef.current?.click()}
                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs h-11 px-4 gap-1.5 shadow-lg shadow-purple-950"
              >
                <Scan className="w-4 h-4 text-amber-300" /> AI Barcode & VIN Scanner
              </Button>
            </div>
          </div>
        </div>

        {/* Top Field KPI Counter Tiles */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <Card
            onClick={() => setActiveTab("drops")}
            className="bg-slate-900 border-amber-500/40 text-white p-3 cursor-pointer hover:border-amber-500 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-amber-400 font-bold uppercase">Pending Drops</p>
                <p className="text-2xl font-black text-amber-300 font-mono mt-0.5">{pendingCount}</p>
              </div>
              <Truck className="w-6 h-6 text-amber-400 opacity-80" />
            </div>
          </Card>

          <Card
            onClick={() => setActiveTab("relocate")}
            className="bg-slate-900 border-emerald-500/40 text-white p-3 cursor-pointer hover:border-emerald-500 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-emerald-400 font-bold uppercase">On Yard Staged</p>
                <p className="text-2xl font-black text-emerald-400 font-mono mt-0.5">{availableCount}</p>
              </div>
              <MapPin className="w-6 h-6 text-emerald-400 opacity-80" />
            </div>
          </Card>

          <Card
            onClick={() => setActiveTab("dismantle")}
            className="bg-slate-900 border-sky-500/40 text-white p-3 cursor-pointer hover:border-sky-500 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-sky-400 font-bold uppercase">Crush Queue</p>
                <p className="text-2xl font-black text-sky-300 font-mono mt-0.5">{crushedCount}</p>
              </div>
              <Droplets className="w-6 h-6 text-sky-400 opacity-80" />
            </div>
          </Card>
        </div>

        {/* Primary Mobile Tabs Workstation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-4 bg-slate-900 border border-slate-800 p-1 rounded-xl h-auto">
            <TabsTrigger
              value="drops"
              className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 text-xs font-bold gap-1 py-2.5"
            >
              <Truck className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Tow Drops</span>
            </TabsTrigger>

            <TabsTrigger
              value="relocate"
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs font-bold gap-1 py-2.5"
            >
              <MapPin className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Relocator</span>
            </TabsTrigger>

            <TabsTrigger
              value="dismantle"
              className="data-[state=active]:bg-sky-600 data-[state=active]:text-white text-xs font-bold gap-1 py-2.5"
            >
              <Droplets className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Prep Checklist</span>
            </TabsTrigger>

            <TabsTrigger
              value="scan"
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-xs font-bold gap-1 py-2.5"
            >
              <Scan className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Scanner</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: TOW INBOUND DROPS */}
          <TabsContent value="drops" className="space-y-4">
            <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
              <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold tracking-wide uppercase text-white flex items-center gap-2">
                    <Truck className="w-4 h-4 text-amber-400" /> Tow Driver Vehicle Drops ({pendingCount} Pending)
                  </CardTitle>
                </div>

                <Button
                  size="sm"
                  onClick={() => setTowDropModalOpen(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs gap-1 h-9 shadow"
                >
                  <Plus className="w-4 h-4" /> Tow Drop-Off
                </Button>
              </CardHeader>

              <CardContent className="p-3 space-y-3">
                <div className="space-y-2">
                  {vehicles.filter((v) => v.status === "PENDING").length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                      <p className="font-bold text-slate-300">No Pending Tow Drops</p>
                      <p className="text-slate-500 text-[11px]">Tap "Tow Drop-Off" above to record a new vehicle arrival.</p>
                    </div>
                  ) : (
                    vehicles
                      .filter((v) => v.status === "PENDING")
                      .map((veh) => (
                        <div
                          key={veh.id}
                          className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 hover:border-amber-500/50 transition-all space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-white text-sm">
                                  {veh.year} {veh.make} {veh.model}
                                </span>
                                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[9px] font-mono">
                                  PENDING
                                </Badge>
                              </div>
                              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                                Drop Spot: <span className="text-amber-300 font-bold">{veh.section} ({veh.rowNumber || "Inbound"} - {veh.spaceNumber || "Drop Bay"})</span>
                              </p>
                              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                VIN: {veh.vin} | Arrived: {new Date(veh.dateSetInYard).toLocaleTimeString()}
                              </p>
                            </div>

                            <div className="w-12 h-10 rounded bg-slate-900 overflow-hidden border border-slate-800 shrink-0 flex items-center justify-center">
                              {veh.photoUrl ? (
                                <img src={veh.photoUrl} alt="Drop thumbnail" className="w-full h-full object-cover" />
                              ) : (
                                <Car className="w-5 h-5 text-slate-600" />
                              )}
                            </div>
                          </div>

                          {veh.notes && (
                            <p className="text-[11px] text-slate-300 bg-slate-900 p-2 rounded-lg border border-slate-800 font-sans">
                              {veh.notes}
                            </p>
                          )}

                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-900">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRelocateModalVeh(veh)}
                              className="h-8 text-xs border-slate-800 bg-slate-900 text-slate-200 hover:text-white gap-1 flex-1"
                            >
                              <MapPin className="w-3.5 h-3.5 text-amber-400" /> Relocate Spot
                            </Button>

                            <Button
                              size="sm"
                              onClick={() => setDismantleModalVeh(veh)}
                              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1 flex-1 shadow"
                            >
                              <Droplets className="w-3.5 h-3.5" /> Environmental Prep
                            </Button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: YARD RELOCATOR & SPOTTER */}
          <TabsContent value="relocate" className="space-y-4">
            <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
              <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-bold tracking-wide uppercase text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400" /> Yard Spotter & Forklift Relocation Engine
                  </CardTitle>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                  <Input
                    placeholder="Search vehicle or row..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs pl-8 h-8 w-52"
                  />
                </div>
              </CardHeader>

              <CardContent className="p-3 space-y-3">
                <div className="space-y-2">
                  {filteredVehicles.map((veh) => (
                    <div
                      key={veh.id}
                      className="bg-slate-950 p-3 rounded-xl border border-slate-800 hover:border-emerald-500/50 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">
                            {veh.year} {veh.make} {veh.model}
                          </span>
                          <Badge
                            className={`text-[9px] font-mono ${
                              veh.status === "AVAILABLE"
                                ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                                : veh.status === "PENDING"
                                ? "bg-amber-950 text-amber-300 border-amber-800"
                                : "bg-rose-950 text-rose-300 border-rose-800"
                            }`}
                          >
                            {veh.status}
                          </Badge>
                        </div>

                        <div className="text-[11px] text-slate-400 font-mono">
                          Current Location: <strong className="text-emerald-400">{veh.section} ({veh.rowNumber || "Row 01"} - {veh.spaceNumber || "Spot 01"})</strong>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => setRelocateModalVeh(veh)}
                        className="h-9 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1 shrink-0 shadow"
                      >
                        <MapPin className="w-3.5 h-3.5" /> Move
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Relocation History Logs */}
                {relocLogs.length > 0 && (
                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <span className="text-xs font-bold text-slate-400 uppercase font-mono block">
                      Recent Field Relocation Movements:
                    </span>
                    <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                      {relocLogs.slice(0, 5).map((log) => (
                        <div key={log.id} className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-[11px] font-mono flex items-center justify-between">
                          <div>
                            <span className="text-white font-bold">{log.vehicleDesc}</span>
                            <span className="text-slate-400 block text-[10px]">{log.fromLocation} → <strong className="text-emerald-400">{log.toLocation}</strong></span>
                          </div>
                          <span className="text-slate-500 text-[9px]">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: DISMANTLE PREP CHECKLIST */}
          <TabsContent value="dismantle" className="space-y-4">
            <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
              <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold tracking-wide uppercase text-white flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-sky-400" /> Environmental Fluid & Parts Dismantling
                  </CardTitle>
                </div>
              </CardHeader>

              <CardContent className="p-3 space-y-2">
                {vehicles.map((veh) => (
                  <div
                    key={veh.id}
                    className="bg-slate-950 p-3 rounded-xl border border-slate-800 hover:border-sky-500/50 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">
                          {veh.year} {veh.make} {veh.model}
                        </span>
                        <Badge
                          className={`text-[9px] font-mono ${
                            veh.dismantlingLog.gasDrained && veh.dismantlingLog.oilDrained
                              ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                              : "bg-amber-950 text-amber-300 border-amber-800"
                          }`}
                        >
                          {veh.dismantlingLog.gasDrained && veh.dismantlingLog.oilDrained ? "FLUIDS DRAINED" : "PREP PENDING"}
                        </Badge>
                      </div>

                      <div className="text-[11px] text-slate-400 font-mono space-x-2">
                        <span>Cats: <strong className="text-amber-400">{veh.dismantlingLog.catalyticConvertersRemoved}</strong></span>
                        <span>|</span>
                        <span>Wheels: <strong className="text-sky-400">{veh.dismantlingLog.wheelsRemoved}</strong></span>
                        <span>|</span>
                        <span>Gas: <strong className={veh.dismantlingLog.gasDrained ? "text-emerald-400" : "text-slate-500"}>{veh.dismantlingLog.gasDrained ? "Yes" : "No"}</strong></span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => setDismantleModalVeh(veh)}
                      className="h-9 px-3 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs gap-1 shrink-0 shadow"
                    >
                      <Droplets className="w-3.5 h-3.5" /> Prep
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: SCANNER & TAGS */}
          <TabsContent value="scan" className="space-y-4">
            <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
              <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800">
                <CardTitle className="text-sm font-bold tracking-wide uppercase text-white flex items-center gap-2">
                  <Scan className="w-4 h-4 text-purple-400" /> Barcode & Stock Tag Scanner
                </CardTitle>
              </CardHeader>

              <CardContent className="p-4 space-y-4 text-center">
                <div className="p-8 bg-slate-950 rounded-2xl border-2 border-dashed border-slate-800 space-y-3">
                  <div className="w-14 h-14 bg-purple-500/10 text-purple-400 rounded-2xl flex items-center justify-center mx-auto border border-purple-500/30">
                    <Scan className="w-7 h-7 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Point Camera at VIN Barcode or Stock Tag</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Uses camera vision OCR to locate vehicle record instantly
                    </p>
                  </div>

                  <Button
                    onClick={() => scannerInputRef.current?.click()}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs px-5 h-11 gap-1.5 shadow-lg shadow-purple-950"
                  >
                    <Camera className="w-4 h-4 text-amber-300" /> Launch Camera Barcode Scanner
                  </Button>
                </div>

                {scanResultVeh && (
                  <Card className="bg-slate-950 border-2 border-emerald-500/50 text-white p-4 text-left space-y-3 font-mono">
                    <div className="flex items-start justify-between">
                      <div>
                        <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px]">
                          SCANNED MATCH
                        </Badge>
                        <h4 className="text-lg font-bold text-white mt-1">
                          {scanResultVeh.year} {scanResultVeh.make} {scanResultVeh.model}
                        </h4>
                        <p className="text-xs text-slate-400">
                          Location: <strong className="text-emerald-400">{scanResultVeh.section} ({scanResultVeh.rowNumber || "Row 01"} - {scanResultVeh.spaceNumber || "Spot"})</strong>
                        </p>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => setTagModalVeh(scanResultVeh)}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs gap-1"
                      >
                        <Printer className="w-3.5 h-3.5" /> Yard Tag
                      </Button>
                    </div>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </main>

      {/* Tow Drop Modal */}
      <TowDropModal
        isOpen={towDropModalOpen}
        onClose={() => setTowDropModalOpen(false)}
        onSuccess={loadData}
      />

      {/* Vehicle Relocate Modal */}
      <YardRelocateModal
        vehicle={relocateModalVeh}
        isOpen={!!relocateModalVeh}
        onClose={() => setRelocateModalVeh(null)}
        onSuccess={loadData}
      />

      {/* Environmental Dismantle Checklist Modal */}
      <DismantleChecklistModal
        vehicle={dismantleModalVeh}
        isOpen={!!dismantleModalVeh}
        onClose={() => setDismantleModalVeh(null)}
        onSuccess={loadData}
      />

      {/* Window Tag Modal */}
      <YardWindowTagModal
        vehicle={tagModalVeh}
        isOpen={!!tagModalVeh}
        onClose={() => setTagModalVeh(null)}
      />
    </div>
  );
}