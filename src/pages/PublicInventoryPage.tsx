import React, { useCallback, useEffect, useMemo, useState } from "react";
import { storageService } from "@/services/storageService";
import { sharedStorage } from "@/services/sharedStorage";
import { PullYardVehicle } from "@/types/scrap";
import { PartsInterchangeModal } from "@/components/inventory/PartsInterchangeModal";
import { Navbar } from "@/components/layout/Navbar";
import { generateSamplePhoto } from "@/utils/complianceUtils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Car,
  Search,
  MapPin,
  Sparkles,
  Printer,
  Wrench,
  Filter,
  CheckCircle2,
  Clock,
  ChevronRight,
  ShieldCheck,
  Bell,
  Layers,
  Calendar,
  AlertCircle,
  Layers3,
  Image as ImageIcon,
  RefreshCw,
  Eye,
  Radio,
} from "lucide-react";
import { toast } from "sonner";

const FALLBACK_VEHICLE_PHOTO = generateSamplePhoto("vehicle");

export default function PublicInventoryPage() {
  const [vehicles, setVehicles] = useState<PullYardVehicle[]>([]);
  const [search, setSearch] = useState("");
  const [selectedSection, setSelectedSection] = useState<string>("ALL");
  const [partFilter, setPartFilter] = useState<string>("ALL");
  const [selectedVehicle, setSelectedVehicle] = useState<PullYardVehicle | null>(null);
  const [interchangeOpen, setInterchangeOpen] = useState(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>(new Date().toLocaleTimeString());

  // Notify Me Request State
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [reqMake, setReqMake] = useState("Honda");
  const [reqModel, setReqModel] = useState("Civic");
  const [reqPhone, setReqPhone] = useState("");

  const loadData = useCallback(() => {
    const list = storageService.getPullYardVehicles();
    setVehicles(list);
    setLastUpdatedTime(new Date().toLocaleTimeString());
  }, []);

  // Reload only when inventory can actually change instead of reparsing it every two seconds.
  useEffect(() => {
    loadData();

    const handleStorageChange = (e: StorageEvent) => {
      if (!e.key || e.key === "mahaffeys_pull_yard_vehicles") {
        loadData();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    const unsubscribeShared = sharedStorage.subscribe((status) => {
      if (status === "connected") loadData();
    });

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      unsubscribeShared();
    };
  }, [loadData]);

  const filteredVehicles = useMemo(() => {
    const q = search.trim().toLowerCase();
    const normalizedPartFilter = partFilter.toLowerCase();

    return vehicles.filter((v) => {
      const matchesSearch =
        v.make.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.year.toString().includes(q) ||
        v.vin.toLowerCase().includes(q) ||
        v.section.toLowerCase().includes(q);

      const matchesSection = selectedSection === "ALL" || v.section === selectedSection;
      const matchesPart =
        partFilter === "ALL" ||
        v.partsRemaining.some((p) => p.toLowerCase().includes(normalizedPartFilter));

      return matchesSearch && matchesSection && matchesPart;
    });
  }, [partFilter, search, selectedSection, vehicles]);

  const handleSendNotifyRequest = () => {
    if (!reqPhone.trim()) {
      toast.error("Please enter a contact phone or email");
      return;
    }
    toast.success(`Vehicle Alert Created for ${reqMake} ${reqModel}!`, {
      description: "We will SMS text you the moment this vehicle passes through the intake scale desk.",
    });
    setNotifyOpen(false);
    setReqPhone("");
  };

  const availableCount = useMemo(
    () => vehicles.reduce((count, vehicle) => count + (vehicle.status === "AVAILABLE" ? 1 : 0), 0),
    [vehicles],
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Header Hero Banner */}
        <div className="relative bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/50 p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-mono uppercase tracking-widest px-3 py-1">
                  LIVE YARD CATALOG
                </Badge>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-mono gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" /> REAL-TIME AUTO SYNC ({lastUpdatedTime})
                </Badge>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Public Vehicle Inventory & Part Locator
              </h1>
              <p className="text-slate-400 text-sm leading-relaxed">
                Search self-service harvest vehicles staged on the lot. See live photos, yard sections, available parts, and fresh vehicle arrivals in real-time.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
              <Button
                onClick={() => setInterchangeOpen(true)}
                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs px-5 h-10 gap-1.5 shadow-lg shadow-purple-950"
              >
                <Layers3 className="w-4 h-4 text-amber-300" /> Parts Interchange Lookup
              </Button>

              <Button
                onClick={() => setNotifyOpen(true)}
                className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs px-5 h-10 gap-1.5 shadow-lg shadow-amber-950"
              >
                <Bell className="w-4 h-4" /> Request Vehicle Alert
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Search & Filtering Bar */}
        <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              
              {/* Text Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <Input
                  placeholder="Search Year, Make, Model, or VIN..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white text-xs pl-9 h-10"
                />
              </div>

              {/* Yard Section Filter */}
              <div>
                <Select value={selectedSection} onValueChange={setSelectedSection}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs h-10">
                    <SelectValue placeholder="All Yard Sections" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                    <SelectItem value="ALL">All Yard Sections ({vehicles.length} Vehicles)</SelectItem>
                    <SelectItem value="Domestic Trucks & SUVs">Domestic Trucks & SUVs</SelectItem>
                    <SelectItem value="Ford & Lincoln">Ford & Lincoln</SelectItem>
                    <SelectItem value="GM & Chevrolet">GM & Chevrolet</SelectItem>
                    <SelectItem value="Asian Imports">Asian Imports</SelectItem>
                    <SelectItem value="Chrysler & Dodge">Chrysler & Dodge</SelectItem>
                    <SelectItem value="European">European</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Specific Part Component Filter */}
              <div>
                <Select value={partFilter} onValueChange={setPartFilter}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs h-10">
                    <SelectValue placeholder="Filter by Needed Component" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                    <SelectItem value="ALL">All Available Components</SelectItem>
                    <SelectItem value="Engine">Engine / Short Block</SelectItem>
                    <SelectItem value="Transmission">Transmission</SelectItem>
                    <SelectItem value="Doors">Doors & Panels</SelectItem>
                    <SelectItem value="Wheels">Alloy Wheels & Rims</SelectItem>
                    <SelectItem value="Headlights">Headlights / Lenses</SelectItem>
                    <SelectItem value="Fenders">Fenders / Body</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Vehicle Catalog Cards Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-amber-400" /> Currently Staged Vehicles ({filteredVehicles.length})
            </h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-xs font-mono">
                {availableCount} Available Vehicles On Lot
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={loadData}
                className="h-7 text-xs text-slate-400 hover:text-white"
                title="Refresh Inventory"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {filteredVehicles.length === 0 ? (
            <Card className="bg-slate-900 border-slate-800 text-slate-400 p-12 text-center space-y-3">
              <AlertCircle className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-white">No vehicles found matching your criteria</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Try clearing your search filters or set a vehicle request alert to get notified when a matching car enters the intake station.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setSearch("");
                  setSelectedSection("ALL");
                  setPartFilter("ALL");
                }}
                className="bg-slate-800 border-slate-700 text-slate-200 text-xs"
              >
                Clear All Filters
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVehicles.map((veh) => {
                const daysAgo = Math.floor(
                  (Date.now() - new Date(veh.dateSetInYard).getTime()) / (1000 * 60 * 60 * 24)
                );
                const displayPhoto = veh.photoUrl || FALLBACK_VEHICLE_PHOTO;

                return (
                  <Card
                    key={veh.id}
                    onClick={() => setSelectedVehicle(veh)}
                    className="group bg-slate-900 border-2 border-slate-800 hover:border-amber-500/70 transition-all duration-300 cursor-pointer shadow-xl overflow-hidden flex flex-col justify-between [content-visibility:auto] [contain-intrinsic-size:420px]"
                  >
                    {/* Vehicle Photo Banner */}
                    <div className="relative aspect-video bg-slate-950 overflow-hidden border-b border-slate-800">
                      <img
                        src={displayPhoto}
                        alt={`${veh.year} ${veh.make} ${veh.model}`}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = FALLBACK_VEHICLE_PHOTO;
                        }}
                      />
                      
                      {/* Photo Overlays: Section & Live Status Badges */}
                      <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1.5 z-10">
                        <Badge className="bg-slate-950/80 backdrop-blur-md text-amber-300 border-amber-500/40 text-[10px] font-mono">
                          {veh.section}
                        </Badge>
                      </div>

                      <div className="absolute top-2 right-2 z-10">
                        {veh.status === "AVAILABLE" ? (
                          <Badge className="bg-emerald-950/90 backdrop-blur-md text-emerald-300 border-emerald-500/40 text-[10px] gap-1 shadow-md">
                            <Sparkles className="w-3 h-3 text-emerald-400" /> {daysAgo === 0 ? "STAGED TODAY" : `${daysAgo}d ON YARD`}
                          </Badge>
                        ) : veh.status === "PENDING" ? (
                          <Badge className="bg-amber-950/90 backdrop-blur-md text-amber-300 border-amber-500/40 text-[10px] shadow-md">
                            PENDING INTAKE
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-slate-950/90 backdrop-blur-md border-rose-800 text-rose-400 text-[10px]">
                            CRUSHED / STRIPPED
                          </Badge>
                        )}
                      </div>

                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] font-mono font-bold text-white bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800">
                        <span>Color: {veh.color || "White"}</span>
                        <span>VIN: {veh.vin.slice(0, 11)}...</span>
                      </div>
                    </div>

                    <CardHeader className="py-3.5 px-5 bg-slate-950/60 border-b border-slate-800 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-lg font-black text-white group-hover:text-amber-400 transition-colors">
                          {veh.year} {veh.make} {veh.model}
                        </CardTitle>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 space-y-3 flex-1">
                      {/* Available Parts checklist */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Intact Components ({veh.partsRemaining.length}):
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {veh.partsRemaining.map((part, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800 font-mono"
                            >
                              {part}
                            </span>
                          ))}
                        </div>
                      </div>
                    </CardContent>

                    <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-amber-400 font-semibold group-hover:bg-amber-950/30 transition-colors">
                      <span className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" /> View Photo & Location Pass
                      </span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

      </main>

      {/* Vehicle Detailed Location & Printable Ticket Modal */}
      {selectedVehicle && (
        <Dialog open={!!selectedVehicle} onOpenChange={() => setSelectedVehicle(null)}>
          <DialogContent className="max-w-lg bg-slate-950 text-slate-100 border-slate-800 p-6 max-h-[90vh] overflow-y-auto">
            <DialogHeader className="border-b border-slate-800 pb-3">
              <div className="flex items-center justify-between">
                <Badge className="bg-amber-950 text-amber-300 border-amber-500/40 text-xs font-mono">
                  {selectedVehicle.section}
                </Badge>
                <Badge variant="outline" className="border-slate-700 text-slate-300 text-xs">
                  {selectedVehicle.status}
                </Badge>
              </div>
              <DialogTitle className="text-xl font-bold text-white mt-2">
                {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Self-Service Vehicle Locator & Component Sheet
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* Full Photo Display */}
              <div className="aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                <img
                  src={selectedVehicle.photoUrl || FALLBACK_VEHICLE_PHOTO}
                  alt="Vehicle Full Photo"
                  decoding="async"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = FALLBACK_VEHICLE_PHOTO;
                  }}
                />
              </div>

              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Yard Section:</span>
                  <span className="text-amber-300 font-bold">{selectedVehicle.section}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Color:</span>
                  <span className="text-white font-bold">{selectedVehicle.color || "White"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Full VIN:</span>
                  <span className="text-amber-300 font-bold">{selectedVehicle.vin}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Date Set In Yard:</span>
                  <span className="text-slate-200">{new Date(selectedVehicle.dateSetInYard).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Available Parts Checklist */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Intact Parts Available for Harvesting:
                </span>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {selectedVehicle.partsRemaining.map((part, idx) => (
                    <div key={idx} className="p-2 bg-slate-900 rounded border border-slate-800 flex items-center gap-1.5 text-slate-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{part}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rules Reminder */}
              <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-lg text-[11px] text-amber-200 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-amber-400" /> Yard Safety Rules:
                </div>
                <p className="text-slate-300">
                  Must wear closed-toe boots & safety glasses. Jacks, torches, and power cutting saws are strictly prohibited on the lot.
                </p>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-slate-800">
              <Button onClick={() => window.print()} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs gap-1.5">
                <Printer className="w-4 h-4" /> Print / Save Location Pass
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Request Vehicle Alert Modal */}
      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-400" /> Create Vehicle Arrival Alert
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              We'll send an instant text message the moment a matching vehicle passes through the intake station.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Vehicle Make *</label>
                <Input
                  value={reqMake}
                  onChange={(e) => setReqMake(e.target.value)}
                  placeholder="e.g. Honda"
                  className="bg-slate-900 border-slate-800 text-white text-xs"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Vehicle Model *</label>
                <Input
                  value={reqModel}
                  onChange={(e) => setReqModel(e.target.value)}
                  placeholder="e.g. Civic"
                  className="bg-slate-900 border-slate-800 text-white text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">SMS Mobile Phone # *</label>
              <Input
                value={reqPhone}
                onChange={(e) => setReqPhone(e.target.value)}
                placeholder="(555) 000-0000"
                className="bg-slate-900 border-slate-800 text-white text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-800">
            <Button variant="ghost" onClick={() => setNotifyOpen(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button onClick={handleSendNotifyRequest} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs">
              Subscribe Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Parts Interchange Search Modal */}
      {interchangeOpen && (
        <PartsInterchangeModal
          isOpen
          onClose={() => setInterchangeOpen(false)}
        />
      )}
    </div>
  );
}