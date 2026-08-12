import React, { useState, useEffect } from "react";
import { storageService } from "@/services/storageService";
import { PullYardVehicle } from "@/types/scrap";
import { Navbar } from "@/components/layout/Navbar";
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
} from "lucide-react";
import { toast } from "sonner";

export default function PublicInventoryPage() {
  const [vehicles, setVehicles] = useState<PullYardVehicle[]>([]);
  const [search, setSearch] = useState("");
  const [selectedSection, setSelectedSection] = useState<string>("ALL");
  const [partFilter, setPartFilter] = useState<string>("ALL");
  const [selectedVehicle, setSelectedVehicle] = useState<PullYardVehicle | null>(null);

  // Notify Me Request State
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [reqMake, setReqMake] = useState("Honda");
  const [reqModel, setReqModel] = useState("Civic");
  const [reqPhone, setReqPhone] = useState("");

  const loadData = () => {
    setVehicles(storageService.getPullYardVehicles());
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter vehicles
  const filteredVehicles = vehicles.filter((v) => {
    const q = search.toLowerCase();
    const matchesSearch =
      v.make.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      v.year.toString().includes(q) ||
      v.vin.toLowerCase().includes(q) ||
      v.rowNumber.toLowerCase().includes(q);

    const matchesSection = selectedSection === "ALL" ? true : v.section === selectedSection;

    const matchesPart =
      partFilter === "ALL"
        ? true
        : v.partsRemaining.some((p) => p.toLowerCase().includes(partFilter.toLowerCase()));

    return matchesSearch && matchesSection && matchesPart;
  });

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

  const availableCount = vehicles.filter((v) => v.status === "AVAILABLE").length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Header Hero Banner */}
        <div className="relative bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/50 p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-mono uppercase tracking-widest px-3 py-1">
                  LIVE YARD CATALOG
                </Badge>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-mono">
                  UPDATED EVERY 15 MIN
                </Badge>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Public Vehicle Inventory & Part Locator
              </h1>
              <p className="text-slate-400 text-sm leading-relaxed">
                Search self-service harvest vehicles staged on the lot. Check row and space locations, see available components, and find fresh vehicle arrivals.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
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
            <Badge variant="outline" className="border-slate-700 text-slate-300 text-xs font-mono">
              {availableCount} Available Vehicles On Lot
            </Badge>
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

                return (
                  <Card
                    key={veh.id}
                    onClick={() => setSelectedVehicle(veh)}
                    className="group bg-slate-900 border-2 border-slate-800 hover:border-amber-500/70 transition-all duration-200 cursor-pointer shadow-xl overflow-hidden flex flex-col justify-between"
                  >
                    <CardHeader className="py-4 px-5 bg-slate-950/80 border-b border-slate-800 flex flex-row items-start justify-between">
                      <div className="space-y-1">
                        <Badge variant="outline" className="border-slate-700 text-slate-300 text-[10px]">
                          {veh.section}
                        </Badge>
                        <CardTitle className="text-lg font-black text-white group-hover:text-amber-400 transition-colors">
                          {veh.year} {veh.make} {veh.model}
                        </CardTitle>
                        <p className="text-xs text-slate-400 font-mono">
                          Color: <span className="text-slate-200">{veh.color}</span>
                        </p>
                      </div>

                      {/* Row Badge */}
                      <div className="text-right shrink-0">
                        <div className="p-2 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-300 text-center shadow-md">
                          <span className="text-xs font-black block leading-none font-mono">{veh.rowNumber}</span>
                          <span className="text-[9px] text-amber-400/80 font-mono">{veh.spaceNumber}</span>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-5 space-y-4 flex-1">
                      {/* Status Badges */}
                      <div className="flex items-center justify-between text-xs">
                        {veh.status === "AVAILABLE" ? (
                          <Badge className="bg-emerald-950 text-emerald-300 border-emerald-500/40 text-[10px] gap-1">
                            <Sparkles className="w-3 h-3 text-emerald-400" /> AVAILABLE ({daysAgo === 0 ? "Today" : `${daysAgo}d ago`})
                          </Badge>
                        ) : veh.status === "PENDING" ? (
                          <Badge className="bg-amber-950 text-amber-300 border-amber-500/40 text-[10px]">
                            PENDING INTAKE
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-rose-800 text-rose-400 text-[10px]">
                            CRUSHED / STRIPPED
                          </Badge>
                        )}

                        <span className="text-[11px] text-slate-500 font-mono truncate max-w-[120px]">
                          VIN: {veh.vin.slice(0, 11)}...
                        </span>
                      </div>

                      {/* Parts Available checklist */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Available Components ({veh.partsRemaining.length}):
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {veh.partsRemaining.map((part, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800"
                            >
                              {part}
                            </span>
                          ))}
                        </div>
                      </div>
                    </CardContent>

                    <div className="p-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-amber-400 font-semibold group-hover:bg-amber-950/30 transition-colors">
                      <span>View Row Locator Pass</span>
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
          <DialogContent className="max-w-md bg-slate-950 text-slate-100 border-slate-800 p-6">
            <DialogHeader className="border-b border-slate-800 pb-3">
              <div className="flex items-center justify-between">
                <Badge className="bg-amber-950 text-amber-300 border-amber-500/40 text-xs font-mono">
                  {selectedVehicle.rowNumber} - {selectedVehicle.spaceNumber}
                </Badge>
                <Badge variant="outline" className="border-slate-700 text-slate-300 text-xs">
                  {selectedVehicle.section}
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
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Color:</span>
                  <span className="text-white font-bold">{selectedVehicle.color}</span>
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
    </div>
  );
}