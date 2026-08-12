import React, { useState, useEffect } from "react";
import { storageService } from "@/services/storageService";
import { sharedStorage } from "@/services/sharedStorage";
import { PullYardVehicle } from "@/types/scrap";
import { Navbar } from "@/components/layout/Navbar";
import { generateSamplePhoto } from "@/utils/complianceUtils";
import { PartsInterchangeModal } from "@/components/inventory/PartsInterchangeModal";
import { YardWindowTagModal } from "@/components/inventory/YardWindowTagModal";
import { VehicleIntakeModal } from "@/components/inventory/VehicleIntakeModal";
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
  RefreshCw,
  Eye,
  Radio,
  Plus,
  QrCode,
  Flame,
} from "lucide-react";
import { toast } from "sonner";

export default function PublicVehiclesPage() {
  const [vehicles, setVehicles] = useState<PullYardVehicle[]>([]);
  const [search, setSearch] = useState("");
  const [selectedSection, setSelectedSection] = useState<string>("ALL");
  const [arrivalFilter, setArrivalFilter] = useState<"ALL" | "NEW_ARRIVALS">("ALL");
  const [selectedVehicle, setSelectedVehicle] = useState<PullYardVehicle | null>(null);
  
  // Modals
  const [interchangeOpen, setInterchangeOpen] = useState(false);
  const [tagModalVehicle, setTagModalVehicle] = useState<PullYardVehicle | null>(null);
  const [intakeModalOpen, setIntakeModalOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  
  // Notification form
  const [reqMake, setReqMake] = useState("Ford");
  const [reqModel, setReqModel] = useState("F-150");
  const [reqContact, setReqPhone] = useState("");

  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString());

  const loadData = () => {
    const list = storageService.getPullYardVehicles();
    setVehicles(list);
    setLastSyncTime(new Date().toLocaleTimeString());
  };

  useEffect(() => {
    loadData();

    // 1. Live 2-second background sync
    const timer = setInterval(() => {
      const currentList = storageService.getPullYardVehicles();
      setVehicles(currentList);
      setLastSyncTime(new Date().toLocaleTimeString());
    }, 2000);

    // 2. Storage event
    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.key === "mahaffeys_pull_yard_vehicles") {
        loadData();
      }
    };
    window.addEventListener("storage", handleStorage);

    // 3. Shared storage sync
    const unsub = sharedStorage.subscribe(() => {
      loadData();
    });

    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", handleStorage);
      unsub();
    };
  }, []);

  const newArrivals = vehicles.filter((v) => {
    const days = (Date.now() - new Date(v.dateSetInYard).getTime()) / (1000 * 60 * 60 * 24);
    return days <= 7 && v.status === "AVAILABLE";
  });

  const filteredVehicles = vehicles.filter((v) => {
    const q = search.toLowerCase();
    const matchesSearch =
      v.make.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      v.year.toString().includes(q) ||
      v.vin.toLowerCase().includes(q) ||
      v.section.toLowerCase().includes(q) ||
      (v.stockNumber && v.stockNumber.toLowerCase().includes(q)) ||
      (v.rowNumber && v.rowNumber.toLowerCase().includes(q));

    const matchesSection = selectedSection === "ALL" ? true : v.section === selectedSection;

    const daysOnYard = (Date.now() - new Date(v.dateSetInYard).getTime()) / (1000 * 60 * 60 * 24);
    const matchesArrival = arrivalFilter === "NEW_ARRIVALS" ? daysOnYard <= 7 && v.status === "AVAILABLE" : true;

    return matchesSearch && matchesSection && matchesArrival;
  });

  const handleCreateArrivalNotify = () => {
    if (!reqContact.trim()) {
      toast.error("Please enter a phone number or email address");
      return;
    }
    storageService.saveArrivalSubscription({
      id: `sub-${Date.now()}`,
      make: reqMake.trim(),
      model: reqModel.trim(),
      contactPhoneOrEmail: reqContact.trim(),
      createdAt: new Date().toISOString(),
    });
    toast.success(`Vehicle Arrival Alert Subscribed for ${reqMake} ${reqModel}!`, {
      description: "We will alert you the moment a matching vehicle is logged into the yard.",
    });
    setNotifyOpen(false);
    setReqPhone("");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Hero Header */}
        <div className="relative bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/60 p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-mono uppercase tracking-widest px-3 py-1">
                  PUBLIC YARD CARS PORTAL
                </Badge>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-mono gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" /> LIVE ENTRY SYNC ({lastSyncTime})
                </Badge>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Cars On Yard & Entry Arrival Times
              </h1>
              <p className="text-slate-400 text-sm leading-relaxed">
                Browse all cars currently staged in the yard. View exact arrival dates, entry timestamps, row numbers, and parts interchange fitment.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
              <Button
                onClick={() => setIntakeModalOpen(true)}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-4 h-10 gap-1.5 shadow-lg shadow-emerald-950"
              >
                <Plus className="w-4 h-4" /> Record Car Arrival
              </Button>

              <Button
                onClick={() => setInterchangeOpen(true)}
                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs px-4 h-10 gap-1.5 shadow-lg shadow-purple-950"
              >
                <Layers3 className="w-4 h-4 text-amber-300" /> Interchange Lookup
              </Button>

              <Button
                onClick={() => setNotifyOpen(true)}
                className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs px-4 h-10 gap-1.5 shadow-lg shadow-amber-950"
              >
                <Bell className="w-4 h-4" /> Notify Me
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Search & Filters Bar */}
        <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <Input
                  placeholder="Search Make, Model, Year, VIN, or Row..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white text-xs pl-9 h-10"
                />
              </div>

              {/* Section Filter */}
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

              {/* Arrival Filter */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={arrivalFilter === "ALL" ? "default" : "outline"}
                  onClick={() => setArrivalFilter("ALL")}
                  className={`flex-1 h-10 text-xs font-bold ${
                    arrivalFilter === "ALL" ? "bg-slate-800 text-white" : "border-slate-800 text-slate-400"
                  }`}
                >
                  All Cars ({vehicles.length})
                </Button>

                <Button
                  size="sm"
                  variant={arrivalFilter === "NEW_ARRIVALS" ? "default" : "outline"}
                  onClick={() => setArrivalFilter("NEW_ARRIVALS")}
                  className={`flex-1 h-10 text-xs font-bold gap-1 ${
                    arrivalFilter === "NEW_ARRIVALS"
                      ? "bg-amber-500 text-slate-950"
                      : "border-slate-800 text-amber-400 hover:text-amber-300"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" /> New Arrivals ({newArrivals.length})
                </Button>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Cars Inventory Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-amber-400" /> Staged Yard Vehicles ({filteredVehicles.length})
            </h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-xs font-mono">
                {newArrivals.length} Fresh Arrivals This Week
              </Badge>
              <Button size="sm" variant="ghost" onClick={loadData} className="h-7 text-slate-400 hover:text-white">
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {filteredVehicles.length === 0 ? (
            <Card className="bg-slate-900 border-slate-800 text-slate-400 p-12 text-center space-y-3">
              <AlertCircle className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-white">No vehicles found matching search filter</p>
              <Button
                size="sm"
                onClick={() => { setSearch(""); setSelectedSection("ALL"); setArrivalFilter("ALL"); }}
                className="bg-slate-800 border-slate-700 text-slate-200 text-xs"
              >
                Reset Search Filters
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVehicles.map((veh) => {
                const arrivalDate = new Date(veh.dateSetInYard);
                const daysAgo = Math.floor((Date.now() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24));
                const isNewArrival = daysAgo <= 7 && veh.status === "AVAILABLE";
                const displayPhoto = veh.photoUrl || generateSamplePhoto("vehicle");

                return (
                  <Card
                    key={veh.id}
                    className={`group bg-slate-900 border-2 transition-all duration-300 shadow-xl overflow-hidden flex flex-col justify-between ${
                      isNewArrival ? "border-amber-500/80 shadow-amber-950/20" : "border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    {/* Vehicle Image Viewport */}
                    <div className="relative aspect-video bg-slate-950 overflow-hidden border-b border-slate-800">
                      <img
                        src={displayPhoto}
                        alt={`${veh.year} ${veh.make} ${veh.model}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />

                      <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
                        <Badge className="bg-slate-950/90 backdrop-blur-md text-amber-300 border-amber-500/40 text-[10px] font-mono">
                          {veh.section}
                        </Badge>
                        {veh.rowNumber && (
                          <Badge className="bg-slate-900/90 text-slate-200 border-slate-700 text-[10px] font-mono">
                            {veh.rowNumber}
                          </Badge>
                        )}
                      </div>

                      <div className="absolute top-2 right-2 z-10">
                        {isNewArrival ? (
                          <Badge className="bg-amber-500 text-slate-950 font-black text-[10px] gap-1 shadow-lg animate-pulse">
                            <Sparkles className="w-3 h-3 text-slate-950" /> NEW ARRIVAL ({daysAgo === 0 ? "TODAY" : `${daysAgo}d ago`})
                          </Badge>
                        ) : veh.status === "AVAILABLE" ? (
                          <Badge className="bg-emerald-950/90 text-emerald-300 border-emerald-500/40 text-[10px]">
                            ON YARD ({daysAgo}d)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-slate-950/90 border-rose-800 text-rose-400 text-[10px]">
                            CRUSHED
                          </Badge>
                        )}
                      </div>

                      {/* Entry Arrival Timestamp Overlay */}
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] font-mono font-bold text-white bg-slate-950/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800">
                        <span className="flex items-center gap-1 text-emerald-400">
                          <Clock className="w-3 h-3" /> Arrived: {arrivalDate.toLocaleDateString()} {arrivalDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>

                    <CardHeader className="py-3 px-5 bg-slate-950/60 border-b border-slate-800">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg font-black text-white group-hover:text-amber-400 transition-colors">
                            {veh.year} {veh.make} {veh.model}
                          </CardTitle>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            Color: <span className="text-slate-200">{veh.color || "White"}</span> | VIN: {veh.vin.slice(0, 11)}...
                          </p>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 space-y-3 flex-1">
                      {/* Available Parts */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Intact Harvest Parts ({veh.partsRemaining.length}):
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {veh.partsRemaining.map((p, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800 font-mono">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    </CardContent>

                    <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedVehicle(veh)}
                        className="text-xs text-amber-400 hover:text-white hover:bg-slate-900 gap-1 h-8"
                      >
                        <Eye className="w-3.5 h-3.5" /> Details
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => setTagModalVehicle(veh)}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs h-8 gap-1.5 shadow"
                      >
                        <Printer className="w-3.5 h-3.5" /> Yard Tag & QR
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

      </main>

      {/* Vehicle Details Modal */}
      {selectedVehicle && (
        <Dialog open={!!selectedVehicle} onOpenChange={() => setSelectedVehicle(null)}>
          <DialogContent className="max-w-lg bg-slate-950 text-slate-100 border-slate-800 p-6 max-h-[90vh] overflow-y-auto">
            <DialogHeader className="border-b border-slate-800 pb-3">
              <div className="flex items-center justify-between">
                <Badge className="bg-amber-950 text-amber-300 border-amber-500/40 text-xs font-mono">
                  {selectedVehicle.section}
                </Badge>
                <Badge className="bg-emerald-950 text-emerald-400 border-emerald-500/40 text-xs font-mono">
                  {selectedVehicle.status}
                </Badge>
              </div>
              <DialogTitle className="text-xl font-bold text-white mt-2">
                {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Self-Service Yard Location & Arrival Spec
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                <img src={selectedVehicle.photoUrl || generateSamplePhoto("vehicle")} alt="Vehicle" className="w-full h-full object-cover" />
              </div>

              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Arrival Entry Timestamp:</span>
                  <span className="text-emerald-400 font-bold">
                    {new Date(selectedVehicle.dateSetInYard).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Yard Row / Space:</span>
                  <span className="text-white font-bold">{selectedVehicle.rowNumber || "Row 12"} ({selectedVehicle.spaceNumber || "Space 04"})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Full VIN:</span>
                  <span className="text-amber-300 font-bold">{selectedVehicle.vin}</span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Intact Harvest Parts:</span>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {selectedVehicle.partsRemaining.map((part, idx) => (
                    <div key={idx} className="p-2 bg-slate-900 rounded border border-slate-800 flex items-center gap-1.5 text-slate-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{part}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <Button
                onClick={() => {
                  const target = selectedVehicle;
                  setSelectedVehicle(null);
                  setTagModalVehicle(target);
                }}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs gap-1.5"
              >
                <Printer className="w-4 h-4" /> Print Yard Window Tag with QR
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Yard Window Tag & QR Code Modal */}
      <YardWindowTagModal
        vehicle={tagModalVehicle}
        isOpen={!!tagModalVehicle}
        onClose={() => setTagModalVehicle(null)}
      />

      {/* Staff Vehicle Arrival Entry Modal */}
      <VehicleIntakeModal
        isOpen={intakeModalOpen}
        onClose={() => setIntakeModalOpen(false)}
        onSuccess={loadData}
      />

      {/* Notify Me Request Modal */}
      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-400" /> Create Vehicle Arrival Notification
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Get notified via SMS / email the minute a requested vehicle is logged at the yard scale.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Make *</label>
                <Input
                  value={reqMake}
                  onChange={(e) => setReqMake(e.target.value)}
                  placeholder="e.g. Ford"
                  className="bg-slate-900 border-slate-800 text-white text-xs"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Model *</label>
                <Input
                  value={reqModel}
                  onChange={(e) => setReqModel(e.target.value)}
                  placeholder="e.g. F-150"
                  className="bg-slate-900 border-slate-800 text-white text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">SMS Phone or Email *</label>
              <Input
                value={reqContact}
                onChange={(e) => setReqPhone(e.target.value)}
                placeholder="(555) 000-0000 or customer@email.local"
                className="bg-slate-900 border-slate-800 text-white text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-800">
            <Button variant="ghost" onClick={() => setNotifyOpen(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button onClick={handleCreateArrivalNotify} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs">
              Subscribe Arrival Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Parts Interchange Search Modal */}
      <PartsInterchangeModal
        isOpen={interchangeOpen}
        onClose={() => setInterchangeOpen(false)}
      />
    </div>
  );
}