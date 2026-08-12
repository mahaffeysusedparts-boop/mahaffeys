import React, { useState, useEffect, useRef } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { storageService } from "@/services/storageService";
import { sharedStorage } from "@/services/sharedStorage";
import { PullYardVehicle, PullYardVehicleStatus } from "@/types/scrap";
import { generateSamplePhoto } from "@/utils/complianceUtils";
import { analyzeVinImage, analyzeLicensePlateImage } from "@/services/aiVisionService";
import { TowDropModal } from "@/components/mobile-yard/TowDropModal";
import { YardRelocateModal } from "@/components/mobile-yard/YardRelocateModal";
import { DismantleChecklistModal } from "@/components/mobile-yard/DismantleChecklistModal";
import { YardWindowTagModal } from "@/components/inventory/YardWindowTagModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Truck,
  Scan,
  MapPin,
  Droplets,
  Camera,
  Search,
  CheckCircle2,
  Clock,
  Car,
  Wrench,
  MoveRight,
  Flame,
  Plus,
  RefreshCw,
  Printer,
  Sparkles,
  Wifi,
  Radio,
  Eye,
  ChevronRight,
  Ban,
  ShieldCheck,
  Smartphone,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

export default function MobileYardPage() {
  const [vehicles, setVehicles] = useState<PullYardVehicle[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString());

  // Modal control states
  const [towModalOpen, setTowModalOpen] = useState(false);
  const [relocateVeh, setRelocateVeh] = useState<PullYardVehicle | null>(null);
  const [dismantleVeh, setDismantleVeh] = useState<PullYardVehicle | null>(null);
  const [tagVeh, setTagVeh] = useState<PullYardVehicle | null>(null);

  // Quick Camera Scanner State
  const vinScannerInputRef = useRef<HTMLInputElement>(null);
  const [isScanningVin, setIsScanningVin] = useState(false);

  const loadData = () => {
    const list = storageService.getPullYardVehicles();
    setVehicles(list);
    setLastSyncTime(new Date().toLocaleTimeString());
  };

  useEffect(() => {
    loadData();

    // 2-second background sync for field tablets
    const interval = setInterval(() => {
      const list = storageService.getPullYardVehicles();
      setVehicles(list);
      setLastSyncTime(new Date().toLocaleTimeString());
    }, 2000);

    const unsub = sharedStorage.subscribe(() => {
      loadData();
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, []);

  const handleQuickVinScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsScanningVin(true);
      toast.info("AI Vision analyzing VIN barcode or tag...", { icon: "✨" });
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const dataUrl = evt.target?.result as string;
        try {
          const res = await analyzeVinImage(dataUrl);
          if (res.vin) {
            setSearchQuery(res.vin);
            toast.success(`VIN Scanned: ${res.vin}`, {
              description: "Filtered vehicle list to matching stock / VIN.",
            });
          } else {
            toast.error("Could not decode VIN text. Enter search terms manually.");
          }
        } catch (err) {
          console.warn("VIN scan error:", err);
        } finally {
          setIsScanningVin(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const pendingTowDrops = vehicles.filter((v) => v.status === "PENDING");
  const availableOnYard = vehicles.filter((v) => v.status === "AVAILABLE");
  const crushQueue = vehicles.filter((v) => v.status === "CRUSHED");

  const filteredVehicles = vehicles.filter((v) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.make.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      v.year.toString().includes(q) ||
      v.vin.toLowerCase().includes(q) ||
      v.section.toLowerCase().includes(q) ||
      (v.stockNumber && v.stockNumber.toLowerCase().includes(q)) ||
      (v.rowNumber && v.rowNumber.toLowerCase().includes(q)) ||
      (v.originSource && v.originSource.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      <Navbar />

      {/* Hidden File Input for Quick VIN Camera Scanner */}
      <input
        type="file"
        ref={vinScannerInputRef}
        onChange={handleQuickVinScan}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        
        {/* Top PWA Field Header & Quick Status Bar */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/60 p-4 sm:p-6 rounded-2xl border border-slate-800 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                <Smartphone className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight font-mono">
                    Field Yard Ops & Tow Driver Hub
                  </h1>
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-mono">
                    PWA TABLET SUITE
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Touch-optimized field station for tow drop-offs, VIN scans, spot relocations & dismantling logs.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-mono gap-1.5 py-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" /> LIVE SYNC ({lastSyncTime})
              </Badge>

              <Button
                size="sm"
                onClick={() => vinScannerInputRef.current?.click()}
                disabled={isScanningVin}
                className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs h-9 px-3 gap-1.5 shadow"
              >
                <Scan className="w-4 h-4 text-amber-300" /> Camera Scan
              </Button>
            </div>

          </div>

          {/* Quick Stats Counter Bar */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => { setSearchQuery(""); }}
              className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-left hover:border-amber-400 transition-colors"
            >
              <span className="text-[10px] font-bold text-amber-400 block uppercase">Inbound Tow Drops</span>
              <span className="text-xl font-black text-amber-300 font-mono">{pendingTowDrops.length}</span>
            </button>

            <button
              type="button"
              onClick={() => { setSearchQuery(""); }}
              className="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/40 text-left hover:border-emerald-400 transition-colors"
            >
              <span className="text-[10px] font-bold text-emerald-400 block uppercase">Staged On Yard</span>
              <span className="text-xl font-black text-emerald-300 font-mono">{availableOnYard.length}</span>
            </button>

            <button
              type="button"
              onClick={() => { setSearchQuery(""); }}
              className="p-2.5 rounded-xl bg-slate-950 border border-rose-500/40 text-left hover:border-rose-400 transition-colors"
            >
              <span className="text-[10px] font-bold text-rose-400 block uppercase">Crush Queue</span>
              <span className="text-xl font-black text-rose-300 font-mono">{crushQueue.length}</span>
            </button>
          </div>
        </div>

        {/* Big Touch Target Action Launchers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button
            onClick={() => setTowModalOpen(true)}
            className="h-16 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-amber-950/40 gap-3 justify-start px-5"
          >
            <div className="p-2 rounded-xl bg-slate-950/20 text-slate-950">
              <Truck className="w-6 h-6" />
            </div>
            <div className="text-left">
              <div className="text-sm font-black">1-Tap Tow Driver Drop-Off</div>
              <div className="text-[10px] font-normal text-slate-900">Record inbound drop & camera VIN</div>
            </div>
          </Button>

          <Button
            onClick={() => {
              if (vehicles.length > 0) setRelocateVeh(vehicles[0]);
              else toast.error("No vehicles available to relocate");
            }}
            className="h-16 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-blue-950/40 gap-3 justify-start px-5"
          >
            <div className="p-2 rounded-xl bg-slate-950/30 text-white">
              <MapPin className="w-6 h-6 text-amber-300" />
            </div>
            <div className="text-left">
              <div className="text-sm font-black">Yard Relocation Spotter</div>
              <div className="text-[10px] font-normal text-blue-200">Move car spot-to-spot on lot</div>
            </div>
          </Button>

          <Button
            onClick={() => {
              if (vehicles.length > 0) setDismantleVeh(vehicles[0]);
              else toast.error("No vehicles available for dismantling");
            }}
            className="h-16 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-950/40 gap-3 justify-start px-5"
          >
            <div className="p-2 rounded-xl bg-slate-950/30 text-white">
              <Droplets className="w-6 h-6 text-emerald-300" />
            </div>
            <div className="text-left">
              <div className="text-sm font-black">Environmental Prep Log</div>
              <div className="text-[10px] font-normal text-emerald-200">Log fluids, cats & wheels</div>
            </div>
          </Button>
        </div>

        {/* Four Main Mobile Workstation Tabs */}
        <Tabs defaultValue="inbound" className="space-y-4">
          <TabsList className="grid grid-cols-4 bg-slate-900 border border-slate-800 p-1 rounded-2xl h-auto">
            <TabsTrigger value="inbound" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 text-xs font-bold gap-1.5 h-11 rounded-xl">
              <Truck className="w-4 h-4" /> Tow Drops ({pendingTowDrops.length})
            </TabsTrigger>
            <TabsTrigger value="relocate" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs font-bold gap-1.5 h-11 rounded-xl">
              <MapPin className="w-4 h-4 text-amber-300" /> Relocator
            </TabsTrigger>
            <TabsTrigger value="dismantle" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs font-bold gap-1.5 h-11 rounded-xl">
              <Droplets className="w-4 h-4" /> EPA Prep
            </TabsTrigger>
            <TabsTrigger value="scanner" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-xs font-bold gap-1.5 h-11 rounded-xl">
              <Scan className="w-4 h-4" /> Scanner
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: INBOUND TOW DROPS */}
          <TabsContent value="inbound" className="space-y-3">
            <Card className="bg-slate-900 border-slate-800 text-white shadow-xl overflow-hidden">
              <CardHeader className="py-3.5 px-4 bg-slate-950/80 border-b border-slate-800 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-400" />
                  <CardTitle className="text-sm font-bold tracking-wide uppercase text-white">
                    Inbound Tow Drop Queue ({pendingTowDrops.length})
                  </CardTitle>
                </div>
                <Button
                  size="sm"
                  onClick={() => setTowModalOpen(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs gap-1.5 h-8"
                >
                  <Plus className="w-3.5 h-3.5" /> Record New Tow Drop
                </Button>
              </CardHeader>

              <CardContent className="p-3 space-y-3">
                {pendingTowDrops.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                    <p className="font-bold text-white text-sm">All Inbound Tow Drops Staged & Cleared!</p>
                    <p className="text-[11px] text-slate-500">Tap "Record New Tow Drop" above when a tow truck delivers a vehicle.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {pendingTowDrops.map((veh) => (
                      <div
                        key={veh.id}
                        className="bg-slate-950 border-2 border-amber-500/40 p-3.5 rounded-2xl space-y-3 text-xs"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-black text-white text-base">
                              {veh.year} {veh.make} {veh.model}
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                              VIN: <span className="text-amber-300 font-bold">{veh.vin}</span> | Staged: <span className="text-white font-bold">{veh.rowNumber || "Inbound Staging"}</span>
                            </p>
                          </div>
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 font-mono text-[10px]">
                            PENDING
                          </Badge>
                        </div>

                        {veh.notes && (
                          <div className="p-2 bg-slate-900 rounded-xl border border-slate-800 text-[11px] text-slate-300 font-sans">
                            {veh.notes}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <Button
                            size="sm"
                            onClick={() => setRelocateVeh(veh)}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-1.5 h-9"
                          >
                            <MapPin className="w-3.5 h-3.5 text-amber-300" /> Move Spot
                          </Button>

                          <Button
                            size="sm"
                            onClick={() => setDismantleVeh(veh)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 h-9"
                          >
                            <Droplets className="w-3.5 h-3.5" /> Prep Fluids
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: YARD RELOCATION & GRID SPOTTER */}
          <TabsContent value="relocate" className="space-y-3">
            <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
              <CardHeader className="py-3.5 px-4 bg-slate-950/80 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-400" />
                  <CardTitle className="text-sm font-bold tracking-wide uppercase text-white">
                    Spot-to-Spot Yard Relocation Directory
                  </CardTitle>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                  <Input
                    placeholder="Search car, VIN or row..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs pl-8 h-9 w-60"
                  />
                </div>
              </CardHeader>

              <CardContent className="p-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
                  {filteredVehicles.map((veh) => (
                    <div
                      key={veh.id}
                      className="bg-slate-950 border border-slate-800 hover:border-slate-700 p-3.5 rounded-2xl space-y-3 text-xs"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-extrabold text-white text-sm block">
                            {veh.year} {veh.make} {veh.model}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            Section: <strong className="text-amber-300">{veh.section}</strong> | Spot: <strong className="text-white">{veh.rowNumber || "Row 12"} ({veh.spaceNumber || "Spot 01"})</strong>
                          </span>
                        </div>

                        <Badge
                          className={`text-[10px] font-mono ${
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

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-900">
                        <span className="text-[10px] text-slate-500 font-mono truncate">VIN: {veh.vin}</span>
                        <Button
                          size="sm"
                          onClick={() => setRelocateVeh(veh)}
                          className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-8 gap-1.5 px-3 shrink-0"
                        >
                          <MoveRight className="w-3.5 h-3.5 text-amber-300" /> Relocate
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: DISMANTLING & FLUID PREP */}
          <TabsContent value="dismantle" className="space-y-3">
            <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
              <CardHeader className="py-3.5 px-4 bg-slate-950/80 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-emerald-400" />
                  <CardTitle className="text-sm font-bold tracking-wide uppercase text-white">
                    Environmental Depollution & Dismantling Workstation
                  </CardTitle>
                </div>
              </CardHeader>

              <CardContent className="p-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
                  {filteredVehicles.map((veh) => {
                    const isPrepped = veh.dismantlingLog.gasDrained && veh.dismantlingLog.oilDrained;

                    return (
                      <div
                        key={veh.id}
                        className={`p-3.5 rounded-2xl border space-y-3 text-xs ${
                          isPrepped
                            ? "bg-slate-950 border-emerald-500/40"
                            : "bg-slate-950 border-amber-500/40"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-extrabold text-white text-sm block">
                              {veh.year} {veh.make} {veh.model}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              Spot: <strong className="text-white">{veh.rowNumber || "Row 12"} ({veh.spaceNumber || "Spot 01"})</strong>
                            </span>
                          </div>

                          <Badge
                            className={`text-[10px] font-mono ${
                              isPrepped
                                ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                                : "bg-amber-950 text-amber-300 border-amber-800"
                            }`}
                          >
                            {isPrepped ? "FLUIDS PREPPED" : "NEEDS FLUID PREP"}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-slate-900 p-2 rounded-xl border border-slate-800">
                          <div>
                            Gas Drained: <strong className={veh.dismantlingLog.gasDrained ? "text-emerald-400" : "text-amber-400"}>{veh.dismantlingLog.gasDrained ? "YES" : "NO"}</strong>
                          </div>
                          <div>
                            Oil Drained: <strong className={veh.dismantlingLog.oilDrained ? "text-emerald-400" : "text-amber-400"}>{veh.dismantlingLog.oilDrained ? "YES" : "NO"}</strong>
                          </div>
                          <div>
                            Cats Pulled: <strong className="text-amber-300">{veh.dismantlingLog.catalyticConvertersRemoved}</strong>
                          </div>
                          <div>
                            Wheels Pulled: <strong className="text-sky-300">{veh.dismantlingLog.wheelsRemoved}</strong>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => setDismantleVeh(veh)}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 gap-1.5"
                        >
                          <Droplets className="w-3.5 h-3.5" /> Log Fluids & Parts Removal
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: BARCODE & TAG SCANNER */}
          <TabsContent value="scanner" className="space-y-3">
            <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
              <CardHeader className="py-3.5 px-4 bg-slate-950/80 border-b border-slate-800">
                <CardTitle className="text-sm font-bold tracking-wide uppercase text-white flex items-center gap-2">
                  <Scan className="w-4 h-4 text-purple-400" /> Camera Barcode & VIN Scanner
                </CardTitle>
              </CardHeader>

              <CardContent className="p-6 space-y-4 text-center">
                <div className="w-16 h-16 bg-purple-500/10 text-purple-400 rounded-3xl flex items-center justify-center mx-auto border border-purple-500/30">
                  <Scan className="w-8 h-8 animate-pulse" />
                </div>

                <div>
                  <h3 className="font-extrabold text-white text-base">Point Camera at VIN Barcode or Windshield Tag</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    Scans 17-character VIN barcode labels or stock numbers to instantly bring up location, dismantling logs, and print yard window tags.
                  </p>
                </div>

                <Button
                  onClick={() => vinScannerInputRef.current?.click()}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs h-12 px-8 rounded-xl shadow-lg shadow-purple-950 gap-2"
                >
                  <Camera className="w-5 h-5 text-amber-300" /> Open Camera Barcode Scanner
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

      </main>

      {/* Tow Drop Modal */}
      <TowDropModal
        isOpen={towModalOpen}
        onClose={() => setTowModalOpen(false)}
        onSuccess={loadData}
      />

      {/* Yard Spot Relocation Modal */}
      <YardRelocateModal
        vehicle={relocateVeh}
        isOpen={!!relocateVeh}
        onClose={() => setRelocateVeh(null)}
        onSuccess={loadData}
      />

      {/* Dismantling Checklist Modal */}
      <DismantleChecklistModal
        vehicle={dismantleVeh}
        isOpen={!!dismantleVeh}
        onClose={() => setDismantleVeh(null)}
        onSuccess={loadData}
      />

      {/* Yard Window Tag & QR Pass Modal */}
      <YardWindowTagModal
        vehicle={tagVeh}
        isOpen={!!tagVeh}
        onClose={() => setTagVeh(null)}
      />

    </div>
  );
}