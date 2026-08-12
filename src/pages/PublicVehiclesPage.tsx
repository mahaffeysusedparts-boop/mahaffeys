import React, { useState, useEffect } from "react";
import { storageService } from "@/services/storageService";
import { sharedStorage } from "@/services/sharedStorage";
import { PullYardVehicle, VehicleArrivalSubscription } from "@/types/scrap";
import { useAuth } from "@/context/AuthContext";
import { Navbar } from "@/components/layout/Navbar";
import { PartsInterchangeModal } from "@/components/inventory/PartsInterchangeModal";
import { VehicleIntakeModal } from "@/components/inventory/VehicleIntakeModal";
import { YardWindowTagModal } from "@/components/inventory/YardWindowTagModal";
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
  Layers3,
  Calendar,
  AlertCircle,
  Image as ImageIcon,
  RefreshCw,
  Eye,
  Plus,
  Phone,
  Building,
  LogIn,
  Layers,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

export default function PublicVehiclesPage() {
  const { isAuthenticated, user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("search") || "";

  const [vehicles, setVehicles] = useState<PullYardVehicle[]>([]);
  const [search, setSearch] = useState(initialQuery);
  const [selectedSection, setSelectedSection] = useState<string>("ALL");
  const [filterMode, setFilterMode] = useState<"ALL" | "NEW_ARRIVALS">("ALL");
  const [selectedVehicle, setSelectedVehicle] = useState<PullYardVehicle | null>(null);

  // Modals
  const [interchangeOpen, setInterchangeOpen] = useState(false);
  const [intakeModalOpen, setIntakeModalOpen] = useState(false);
  const [tagModalVehicle, setTagModalVehicle] = useState<PullYardVehicle | null>(null);
  const [notifyOpen, setNotifyOpen] = useState(false);

  // Subscription Form
  const [subName, setSubName] = useState("");
  const [subContact, setSubContact] = useState("");
  const [subMake, setSubMake] = useState("Honda");
  const [subModel, setSubModel] = useState("Civic");

  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString());

  const settings = storageService.getSettings();

  const loadData = () => {
    const list = storageService.getPullYardVehicles();
    setVehicles(list);
    setLastSyncTime(new Date().toLocaleTimeString());
  };

  useEffect(() => {
    loadData();

    // Live 2-second background sync
    const timer = setInterval(() => {
      loadData();
    }, 2000);

    const handleStorageChange = (e: StorageEvent) => {
      if (!e.key || e.key === "mahaffeys_pull_yard_vehicles") {
        loadData();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    const unsubscribeShared = sharedStorage.subscribe(() => {
      loadData();
    });

    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", handleStorageChange);
      unsubscribeShared();
    };
  }, []);

  const isNewArrival = (dateStr: string) => {
    const arrivalTime = new Date(dateStr).getTime();
    const sevenDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 7;
    return arrivalTime >= sevenDaysAgo;
  };

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
    const matchesFilterMode = filterMode === "NEW_ARRIVALS" ? isNewArrival(v.dateSetInYard) : true;

    return matchesSearch && matchesSection && matchesFilterMode;
  });

  const handleSubscribeNotify = () => {
    if (!subContact.trim()) {
      toast.error("Contact phone or email is required for arrival alerts");
      return;
    }

    const newSub: VehicleArrivalSubscription = {
      id: `sub-${Date.now()}`,
      make: subMake.trim(),
      model: subModel.trim(),
      contactName: subName.trim() || "Public Visitor",
      contactPhoneOrEmail: subContact.trim(),
      createdAt: new Date().toISOString(),
    };

    storageService.saveVehicleSubscription(newSub);
    toast.success(`Arrival Alert Active for ${subMake} ${subModel}!`, {
      description: `We will notify ${subContact} as soon as this car enters the yard.`,
    });

    setNotifyOpen(false);
    setSubContact("");
  };

  const newArrivalsCount = vehicles.filter((v) => isNewArrival(v.dateSetInYard)).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* PUBLIC YARD BRANDING BANNER */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-base font-mono">{settings.yardName}</span>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-mono">
                  PUBLIC INVENTORY
                </Badge>
              </div>
              <p className="text-xs text-slate-400">
                {settings.address}, {settings.cityStateZip} • Phone: {settings.phone}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            {isAuthenticated ? (
              <Button
                onClick={() => setIntakeModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs gap-1.5 shadow-md shadow-emerald-950"
              >
                <Plus className="w-4 h-4" /> Log Vehicle Intake
              </Button>
            ) : (
              <Link to="/login">
                <Button variant="outline" className="border-slate-700 bg-slate-800 text-slate-200 text-xs font-semibold gap-1.5">
                  <LogIn className="w-3.5 h-3.5 text-emerald-400" /> Staff Workstation Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* HERO SEARCH & PUBLIC ACTION BAR */}
        <div className="relative bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-mono uppercase tracking-widest px-3 py-1">
                  SELF-SERVICE VEHICLE LOCATOR
                </Badge>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-mono gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" /> LIVE UPDATED ({lastSyncTime})
                </Badge>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Self-Service Vehicle Inventory Portal
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Browse cars staged on the lot. See arrival dates & times, row locations, intact harvestable components, and parts interchange fitments.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
              <Button
                onClick={() => setInterchangeOpen(true)}
                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs px-5 h-10 gap-1.5 shadow-lg shadow-purple-950"
              >
                <Layers3 className="w-4 h-4 text-amber-300" /> Parts Interchange Search
              </Button>

              <Button
                onClick={() => setNotifyOpen(true)}
                className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs px-5 h-10 gap-1.5 shadow-lg shadow-amber-950"
              >
                <Bell className="w-4 h-4" /> Notify Me When A Car Arrives
              </Button>
            </div>
          </div>
        </div>

        {/* SEARCH CONTROLS & QUICK ARRIVAL FILTERS */}
        <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              
              {/* Search Bar */}
              <div className="relative sm:col-span-2">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <Input
                  placeholder="Search Year, Make, Model, VIN, Stock #, or Row..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white text-xs pl-9 h-10 font-bold"
                />
              </div>

              {/* Yard Section Selector */}
              <div>
                <Select value={selectedSection} onValueChange={setSelectedSection}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs h-10">
                    <SelectValue placeholder="All Yard Sections" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                    <SelectItem value="ALL">All Yard Sections ({vehicles.length} Total)</SelectItem>
                    <SelectItem value="Domestic Trucks & SUVs">Domestic Trucks & SUVs</SelectItem>
                    <SelectItem value="Ford & Lincoln">Ford & Lincoln</SelectItem>
                    <SelectItem value="GM & Chevrolet">GM & Chevrolet</SelectItem>
                    <SelectItem value="Asian Imports">Asian Imports</SelectItem>
                    <SelectItem value="Chrysler & Dodge">Chrysler & Dodge</SelectItem>
                    <SelectItem value="European">European</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </div>

            {/* Quick Filter Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
              <span className="text-xs font-bold text-slate-400 font-mono uppercase mr-1">Quick Filters:</span>
              
              <Button
                size="sm"
                variant={filterMode === "ALL" ? "default" : "outline"}
                onClick={() => setFilterMode("ALL")}
                className={`text-xs h-8 ${
                  filterMode === "ALL"
                    ? "bg-slate-800 text-white border-slate-700 font-bold"
                    : "border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
                }`}
              >
                All Yard Cars ({vehicles.length})
              </Button>

              <Button
                size="sm"
                variant={filterMode === "NEW_ARRIVALS" ? "default" : "outline"}
                onClick={() => setFilterMode("NEW_ARRIVALS")}
                className={`text-xs h-8 gap-1.5 ${
                  filterMode === "NEW_ARRIVALS"
                    ? "bg-amber-500 text-slate-950 font-black shadow"
                    : "border-amber-500/40 bg-amber-950/20 text-amber-300 hover:bg-amber-950/50"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> New Arrivals (Last 7 Days) ({newArrivalsCount})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* VEHICLE GRID */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-amber-400" /> Staged Vehicles ({filteredVehicles.length})
            </h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={loadData}
              className="h-7 text-xs text-slate-400 hover:text-white gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Live
            </Button>
          </div>

          {filteredVehicles.length === 0 ? (
            <Card className="bg-slate-900 border-slate-800 text-slate-400 p-12 text-center space-y-3">
              <AlertCircle className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-white">No vehicles found matching search filters</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Try clearing your search query or set a vehicle arrival alert to get notified when a matching car enters the yard.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setSearch("");
                  setSelectedSection("ALL");
                  setFilterMode("ALL");
                }}
                className="bg-slate-800 border-slate-700 text-slate-200 text-xs"
              >
                Clear Search
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVehicles.map((veh) => {
                const isNew = isNewArrival(veh.dateSetInYard);
                const arrivalDate = new Date(veh.dateSetInYard);
                const formattedArrival = `${arrivalDate.toLocaleDateString()} at ${arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                const displayPhoto = veh.photoUrl || generateSamplePhoto("vehicle");
                const stockNum = veh.stockNumber || `STK-${veh.id.slice(-6).toUpperCase()}`;

                return (
                  <Card
                    key={veh.id}
                    onClick={() => setSelectedVehicle(veh)}
                    className="group bg-slate-900 border-2 border-slate-800 hover:border-amber-500/80 transition-all duration-300 cursor-pointer shadow-xl overflow-hidden flex flex-col justify-between"
                  >
                    {/* Vehicle Photo Frame */}
                    <div className="relative aspect-video bg-slate-950 overflow-hidden border-b border-slate-800">
                      <img
                        src={displayPhoto}
                        alt={`${veh.year} ${veh.make} ${veh.model}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = generateSamplePhoto("vehicle");
                        }}
                      />

                      {/* NEW ARRIVAL BADGE */}
                      <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1.5 z-10">
                        {isNew && (
                          <Badge className="bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-widest gap-1 shadow-lg animate-pulse">
                            <Sparkles className="w-3 h-3 text-slate-950 fill-current" /> NEW ARRIVAL
                          </Badge>
                        )}
                        <Badge className="bg-slate-950/90 backdrop-blur-md text-amber-300 border-amber-500/40 text-[10px] font-mono">
                          {veh.section}
                        </Badge>
                      </div>

                      <div className="absolute top-2 right-2 z-10">
                        <Badge className="bg-slate-950/90 backdrop-blur-md text-slate-200 border-slate-700 text-[10px] font-mono">
                          {stockNum}
                        </Badge>
                      </div>

                      {/* Row & VIN Footer */}
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] font-mono font-bold text-white bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800">
                        <span className="text-amber-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-amber-400" /> {veh.rowNumber || 'Row 1'} {veh.spaceNumber ? `(${veh.spaceNumber})` : ''}
                        </span>
                        <span>VIN: {veh.vin.slice(0, 11)}...</span>
                      </div>
                    </div>

                    <CardHeader className="py-3 px-5 bg-slate-950/60 border-b border-slate-800">
                      <CardTitle className="text-lg font-black text-white group-hover:text-amber-400 transition-colors">
                        {veh.year} {veh.make} {veh.model}
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                        <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>Arrived: <strong className="text-slate-200">{formattedArrival}</strong></span>
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="p-4 space-y-3 flex-1">
                      {/* Available Parts checklist */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Harvestable Parts ({veh.partsRemaining.length}):
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
                        <Eye className="w-3.5 h-3.5" /> View Photo & Location Details
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

      {/* Public Vehicle Detail Modal */}
      {selectedVehicle && (
        <Dialog open={!!selectedVehicle} onOpenChange={() => setSelectedVehicle(null)}>
          <DialogContent className="max-w-lg bg-slate-950 text-slate-100 border-slate-800 p-6 max-h-[90vh] overflow-y-auto font-sans">
            <DialogHeader className="border-b border-slate-800 pb-3">
              <div className="flex items-center justify-between">
                <Badge className="bg-amber-950 text-amber-300 border-amber-500/40 text-xs font-mono">
                  {selectedVehicle.section}
                </Badge>
                <Badge className="bg-slate-900 text-slate-200 border-slate-700 text-xs font-mono">
                  {selectedVehicle.stockNumber || 'STK-AVAILABLE'}
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
              <div className="aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                <img
                  src={selectedVehicle.photoUrl || generateSamplePhoto("vehicle")}
                  alt="Vehicle Full View"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = generateSamplePhoto("vehicle");
                  }}
                />
              </div>

              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Exact Entry Timestamp:</span>
                  <span className="text-amber-300 font-bold">
                    {new Date(selectedVehicle.dateSetInYard).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Yard Location:</span>
                  <span className="text-emerald-400 font-bold">
                    {selectedVehicle.section} ({selectedVehicle.rowNumber || 'Row 1'} {selectedVehicle.spaceNumber || 'Spot 01'})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Color:</span>
                  <span className="text-white font-bold">{selectedVehicle.color || "White"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Full VIN:</span>
                  <span className="text-amber-300 font-bold">{selectedVehicle.vin}</span>
                </div>
              </div>

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
            </div>

            <DialogFooter className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => setTagModalVehicle(selectedVehicle)}
                className="w-full sm:w-1/2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs gap-1.5"
              >
                <Printer className="w-4 h-4" /> Print Window Tag
              </Button>
              <Button
                onClick={() => {
                  setSelectedVehicle(null);
                  setInterchangeOpen(true);
                }}
                className="w-full sm:w-1/2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs gap-1.5"
              >
                <Layers3 className="w-4 h-4 text-amber-300" /> Interchange Search
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Staff Vehicle Intake Modal */}
      <VehicleIntakeModal
        open={intakeModalOpen}
        onOpenChange={setIntakeModalOpen}
        onVehicleAdded={loadData}
      />

      {/* Printable Yard Window Tag Modal */}
      <YardWindowTagModal
        vehicle={tagModalVehicle}
        open={!!tagModalVehicle}
        onOpenChange={(open) => { if (!open) setTagModalVehicle(null); }}
      />

      {/* Public Notify Me Modal */}
      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-400" /> Request Car Arrival Notification
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Submit your desired make and model. We will send an SMS text alert as soon as this car enters the yard intake station.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Your Name</label>
              <Input
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                placeholder="e.g. Alex Vance"
                className="bg-slate-900 border-slate-800 text-white text-xs h-10"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Vehicle Make *</label>
                <Input
                  value={subMake}
                  onChange={(e) => setSubMake(e.target.value)}
                  placeholder="e.g. Honda"
                  className="bg-slate-900 border-slate-800 text-white text-xs h-10"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Vehicle Model *</label>
                <Input
                  value={subModel}
                  onChange={(e) => setSubModel(e.target.value)}
                  placeholder="e.g. Civic"
                  className="bg-slate-900 border-slate-800 text-white text-xs h-10"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">SMS Mobile Phone or Email *</label>
              <Input
                value={subContact}
                onChange={(e) => setSubContact(e.target.value)}
                placeholder="(555) 000-0000 or email@example.com"
                className="bg-slate-900 border-slate-800 text-white text-xs h-10"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-800">
            <Button variant="ghost" onClick={() => setNotifyOpen(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button onClick={handleSubscribeNotify} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs">
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