import React, { lazy, Suspense, useCallback, useDeferredValue, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchInventory, type InventoryResponse } from "@/services/inventoryService";
import { storageService } from "@/services/storageService";
import { PullYardVehicle } from "@/types/scrap";
import { generateSamplePhoto } from "@/utils/complianceUtils";
import { VehicleAvailabilityBadge } from "@/components/inventory/VehicleAvailabilityBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Car,
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Bell,
  AlertCircle,
  Layers3,
  RefreshCw,
  Eye,
  Loader2,
  Lock,
  Scale,
  Heart,
  Share2,
  BellRing,
  Phone,
  CalendarClock,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";

const PartsInterchangeModal = lazy(() =>
  import("@/components/inventory/PartsInterchangeModal").then((module) => ({
    default: module.PartsInterchangeModal,
  })),
);
const FALLBACK_VEHICLE_PHOTO = generateSamplePhoto("vehicle");
const INVENTORY_PAGE_SIZE = 24;
const EMPTY_INVENTORY: InventoryResponse = {
  items: [], total: 0, page: 1, limit: INVENTORY_PAGE_SIZE, totalPages: 1,
  counts: { available: 0, pending: 0, crushed: 0 }, updatedAt: null,
};
const FAVORITES_KEY = "mahaffeys-public-inventory-favorites";
const WATCHES_KEY = "mahaffeys-public-inventory-watches";

type VehicleWatch = { status: PullYardVehicle["status"]; label: string };
type VehicleWatches = Record<string, VehicleWatch>;

const readFavorites = (): PullYardVehicle[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]") as unknown;
    return Array.isArray(saved) && saved.every((item) => typeof item === "object" && item !== null && "id" in item)
      ? saved as PullYardVehicle[]
      : [];
  } catch {
    return [];
  }
};

const readWatches = (): VehicleWatches => {
  try {
    return JSON.parse(localStorage.getItem(WATCHES_KEY) || "{}") as VehicleWatches;
  } catch {
    return {};
  }
};

const formatInventoryAge = (updatedAt: string | null, now: number) => {
  if (!updatedAt) return "Inventory update time unavailable";
  const minutes = Math.max(0, Math.floor((now - new Date(updatedAt).getTime()) / 60_000));
  if (minutes < 1) return "Inventory updated less than a minute ago";
  if (minutes === 1) return "Inventory updated 1 minute ago";
  if (minutes < 60) return `Inventory updated ${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  return `Inventory updated ${hours} ${hours === 1 ? "hour" : "hours"} ago`;
};

export default function PublicInventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const yardSettings = storageService.getSettings();
  const yardName = yardSettings.yardName;
  const [inventory, setInventory] = useState<InventoryResponse>(EMPTY_INVENTORY);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [interchangeOpen, setInterchangeOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [favoriteVehicles, setFavoriteVehicles] = useState<PullYardVehicle[]>(readFavorites);
  const [watchedIds, setWatchedIds] = useState<string[]>(() => Object.keys(readWatches()));
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [now, setNow] = useState(Date.now());
  const favoriteIds = favoriteVehicles.map((vehicle) => vehicle.id);
  const search = searchParams.get("search") || "";
  const selectedSection = searchParams.get("section") || "ALL";
  const partFilter = searchParams.get("part") || "ALL";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const deferredSearch = useDeferredValue(search);

  // Notify Me Request State
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [reqMake, setReqMake] = useState("Honda");
  const [reqModel, setReqModel] = useState("Civic");
  const [reqPhone, setReqPhone] = useState("");

  const updateQuery = useCallback((updates: Record<string, string | null>) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(updates).forEach(([key, value]) => {
        if (!value || value === "ALL" || (key === "page" && value === "1")) next.delete(key);
        else next.set(key, value);
      });
      return next;
    });
  }, [setSearchParams]);

  const loadData = useCallback(() => setRefreshToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), limit: String(INVENTORY_PAGE_SIZE), sort: "dateSetInYard_desc" });
    if (deferredSearch.trim()) params.set("search", deferredSearch.trim());
    if (selectedSection !== "ALL") params.set("section", selectedSection);
    if (partFilter !== "ALL") params.set("part", partFilter);
    setIsLoading(true);
    setLoadError("");
    fetchInventory(params, controller.signal)
      .then((response) => {
        setInventory(response);
        if (response.page !== page) updateQuery({ page: String(response.page) });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(error instanceof Error ? error.message : "Unable to load inventory");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [deferredSearch, page, partFilter, refreshToken, selectedSection, updateQuery]);

  const vehicles = inventory.items;
  const catalogVehicles = favoritesOnly ? favoriteVehicles : vehicles;
  const recentVehicles = vehicles
    .filter((vehicle) => Date.now() - new Date(vehicle.dateSetInYard).getTime() <= 7 * 86_400_000)
    .slice(0, 4);
  const freshnessLabel = formatInventoryAge(inventory.updatedAt, now);
  const freshnessMinutes = inventory.updatedAt
    ? Math.max(0, Math.floor((now - new Date(inventory.updatedAt).getTime()) / 60_000))
    : null;
  const inventoryIsStale = freshnessMinutes === null || freshnessMinutes > 15;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!vehicles.length) return;
    setFavoriteVehicles((current) => {
      let changed = false;
      const next = current.map((savedVehicle) => {
        const currentVehicle = vehicles.find((vehicle) => vehicle.id === savedVehicle.id);
        if (!currentVehicle || currentVehicle === savedVehicle) return savedVehicle;
        changed = true;
        return currentVehicle;
      });
      if (changed) localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      return changed ? next : current;
    });
  }, [vehicles]);

  useEffect(() => {
    if (!vehicles.length || !watchedIds.length) return;
    const watches = readWatches();
    let changed = false;

    vehicles.forEach((vehicle) => {
      if (!watchedIds.includes(vehicle.id)) return;
      const previous = watches[vehicle.id];
      const label = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
      if (previous && previous.status !== vehicle.status) {
        const message = `${label} changed from ${previous.status} to ${vehicle.status}.`;
        toast.info("Watched vehicle status changed", { description: message });
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Vehicle status changed", { body: message });
        }
      }
      if (!previous || previous.status !== vehicle.status || previous.label !== label) {
        watches[vehicle.id] = { status: vehicle.status, label };
        changed = true;
      }
    });

    if (changed) localStorage.setItem(WATCHES_KEY, JSON.stringify(watches));
  }, [vehicles, watchedIds]);

  const openVehicle = (vehicle: PullYardVehicle) => {
    navigate(`/inventory/vehicle/${encodeURIComponent(vehicle.vin)}`);
  };

  const toggleFavorite = (vehicle: PullYardVehicle) => {
    const next = favoriteIds.includes(vehicle.id)
      ? favoriteVehicles.filter((savedVehicle) => savedVehicle.id !== vehicle.id)
      : [...favoriteVehicles, vehicle];
    setFavoriteVehicles(next);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    toast.success(next.some((savedVehicle) => savedVehicle.id === vehicle.id) ? "Vehicle saved to your watchlist" : "Vehicle removed from your watchlist");
  };

  const toggleWatch = async (vehicle: PullYardVehicle) => {
    const watches = readWatches();
    if (watchedIds.includes(vehicle.id)) {
      delete watches[vehicle.id];
      const next = watchedIds.filter((id) => id !== vehicle.id);
      setWatchedIds(next);
      localStorage.setItem(WATCHES_KEY, JSON.stringify(watches));
      toast.info("Status notifications turned off");
      return;
    }

    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    const label = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    watches[vehicle.id] = { status: vehicle.status, label };
    setWatchedIds([...watchedIds, vehicle.id]);
    localStorage.setItem(WATCHES_KEY, JSON.stringify(watches));
    toast.success("Status notifications turned on", {
      description: "This device will alert you when the catalog is open or revisited and the status has changed.",
    });
  };

  const shareVehicle = async (vehicle: PullYardVehicle) => {
    const url = new URL(`/inventory/vehicle/${encodeURIComponent(vehicle.vin)}`, window.location.origin);
    const shareData = {
      title: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      text: `View this vehicle at ${yardName}`,
      url: url.toString(),
    };

    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(url.toString());
        toast.success("Vehicle link copied");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Could not share this vehicle");
    }
  };

  const handleSendNotifyRequest = () => {
    if (!reqPhone.trim()) {
      toast.error("Please enter a contact phone or email");
      return;
    }
    toast.success(`Vehicle request saved for ${reqMake} ${reqModel}`, {
      description: "Your request has been saved on this device.",
    });
    let requests: Array<Record<string, string>> = [];
    try {
      const saved = JSON.parse(localStorage.getItem("mahaffeys-public-arrival-alerts") || "[]") as unknown;
      if (Array.isArray(saved)) requests = saved as Array<Record<string, string>>;
    } catch {
      requests = [];
    }
    requests.push({ make: reqMake.trim(), model: reqModel.trim(), contact: reqPhone.trim(), createdAt: new Date().toISOString() });
    localStorage.setItem("mahaffeys-public-arrival-alerts", JSON.stringify(requests));
    setNotifyOpen(false);
    setReqPhone("");
  };

  const availableCount = inventory.counts.available;
  const activeFilterCount = [search.trim(), selectedSection !== "ALL" ? selectedSection : "", partFilter !== "ALL" ? partFilter : ""].filter(Boolean).length;
  const clearFilters = () => updateQuery({ search: null, section: null, part: null, page: null });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 shadow-lg shadow-amber-950/40">
              <Scale className="size-5" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-amber-300">Public Inventory</p>
              <p className="max-w-[220px] truncate text-xs font-semibold text-slate-400 sm:max-w-md">{yardName}</p>
            </div>
          </div>
          <Badge className="rounded-full border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-300">
            <Lock className="mr-1.5 size-3" /> Catalog Only
          </Badge>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Header Hero Banner */}
        <div className="relative bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/50 p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-mono uppercase tracking-widest px-3 py-1">
                  LIVE YARD CATALOG
                </Badge>
                <Badge className={inventoryIsStale
                  ? "border-rose-500/40 bg-rose-500/15 text-xs font-mono text-rose-300"
                  : "border-emerald-500/40 bg-emerald-500/20 text-xs font-mono text-emerald-300"
                } title={inventory.updatedAt ? new Date(inventory.updatedAt).toLocaleString() : undefined}>
                  <span className={`mr-1.5 inline-block size-2 rounded-full ${inventoryIsStale ? "bg-rose-400" : "animate-pulse bg-emerald-400"}`} />
                  {freshnessLabel}
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
                <Bell className="w-4 h-4" /> Save Vehicle Request
              </Button>
            </div>
          </div>
        </div>

        {inventoryIsStale && !isLoading ? (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-400" />
            <div>
              <p className="font-bold">Inventory information may be out of date</p>
              <p className="mt-0.5 text-xs text-rose-200/70">{freshnessLabel}. Call the yard before traveling for a specific vehicle.</p>
            </div>
          </div>
        ) : null}

        {/* Quick Search & Filtering Bar */}
        <div className="md:hidden">
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <Button type="button" className="h-12 w-full rounded-2xl bg-amber-400 font-black text-slate-950 hover:bg-amber-300">
                <SlidersHorizontal className="mr-2 size-4" /> Search & Filter Inventory
                {activeFilterCount ? <Badge className="ml-2 rounded-full bg-slate-950 px-2 text-white">{activeFilterCount}</Badge> : null}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-[28px] border-slate-700 bg-slate-950 p-0 text-white">
              <SheetHeader className="border-b border-slate-800 px-5 py-5 text-left">
                <SheetTitle className="flex items-center gap-2 text-xl font-black text-white"><SlidersHorizontal className="size-5 text-amber-400" /> Find a vehicle</SheetTitle>
                <SheetDescription className="text-xs text-slate-400">Search the live catalog by vehicle, yard section, or needed component.</SheetDescription>
              </SheetHeader>
              <div className="space-y-5 px-5 py-6">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">Vehicle search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3.5 size-4 text-slate-500" />
                    <Input value={search} onChange={(event) => updateQuery({ search: event.target.value, page: null })} placeholder="Year, make, model, or VIN" className="h-12 rounded-xl border-slate-700 bg-slate-900 pl-10 text-white" />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">Yard section</label>
                  <Select value={selectedSection} onValueChange={(value) => updateQuery({ section: value, page: null })}>
                    <SelectTrigger className="h-12 rounded-xl border-slate-700 bg-slate-900 text-white"><SelectValue placeholder="All yard sections" /></SelectTrigger>
                    <SelectContent className="border-slate-700 bg-slate-900 text-white">
                      <SelectItem value="ALL">All Yard Sections</SelectItem><SelectItem value="Domestic Trucks & SUVs">Domestic Trucks & SUVs</SelectItem><SelectItem value="Ford & Lincoln">Ford & Lincoln</SelectItem><SelectItem value="GM & Chevrolet">GM & Chevrolet</SelectItem><SelectItem value="Asian Imports">Asian Imports</SelectItem><SelectItem value="Chrysler & Dodge">Chrysler & Dodge</SelectItem><SelectItem value="European">European</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">Needed component</label>
                  <Select value={partFilter} onValueChange={(value) => updateQuery({ part: value, page: null })}>
                    <SelectTrigger className="h-12 rounded-xl border-slate-700 bg-slate-900 text-white"><SelectValue placeholder="All components" /></SelectTrigger>
                    <SelectContent className="border-slate-700 bg-slate-900 text-white">
                      <SelectItem value="ALL">All Available Components</SelectItem><SelectItem value="Engine">Engine / Short Block</SelectItem><SelectItem value="Transmission">Transmission</SelectItem><SelectItem value="Doors">Doors & Panels</SelectItem><SelectItem value="Wheels">Alloy Wheels & Rims</SelectItem><SelectItem value="Headlights">Headlights / Lenses</SelectItem><SelectItem value="Fenders">Fenders / Body</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <SheetFooter className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-slate-800 bg-slate-950 px-5 py-4 sm:space-x-0">
                <Button type="button" variant="outline" onClick={clearFilters} disabled={!activeFilterCount} className="h-11 rounded-xl border-slate-700 bg-slate-900 text-slate-200">Clear filters</Button>
                <SheetClose asChild><Button type="button" className="h-11 rounded-xl bg-amber-400 font-black text-slate-950 hover:bg-amber-300">Show {inventory.total} vehicles</Button></SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>

        <Card className="hidden border-slate-800 bg-slate-900 text-white shadow-xl md:block">
          <CardContent className="p-4">
            <div className="grid grid-cols-[1.2fr_1fr_1fr_auto] gap-3">
              <div className="relative"><Search className="absolute left-3 top-3 size-4 text-slate-500" /><Input placeholder="Search year, make, model, or VIN" value={search} onChange={(event) => updateQuery({ search: event.target.value, page: null })} className="h-10 border-slate-800 bg-slate-950 pl-9 text-xs text-white" /></div>
              <Select value={selectedSection} onValueChange={(value) => updateQuery({ section: value, page: null })}><SelectTrigger className="h-10 border-slate-800 bg-slate-950 text-xs text-white"><SelectValue placeholder="All Yard Sections" /></SelectTrigger><SelectContent className="border-slate-800 bg-slate-900 text-xs text-white"><SelectItem value="ALL">All Yard Sections</SelectItem><SelectItem value="Domestic Trucks & SUVs">Domestic Trucks & SUVs</SelectItem><SelectItem value="Ford & Lincoln">Ford & Lincoln</SelectItem><SelectItem value="GM & Chevrolet">GM & Chevrolet</SelectItem><SelectItem value="Asian Imports">Asian Imports</SelectItem><SelectItem value="Chrysler & Dodge">Chrysler & Dodge</SelectItem><SelectItem value="European">European</SelectItem></SelectContent></Select>
              <Select value={partFilter} onValueChange={(value) => updateQuery({ part: value, page: null })}><SelectTrigger className="h-10 border-slate-800 bg-slate-950 text-xs text-white"><SelectValue placeholder="All components" /></SelectTrigger><SelectContent className="border-slate-800 bg-slate-900 text-xs text-white"><SelectItem value="ALL">All Available Components</SelectItem><SelectItem value="Engine">Engine / Short Block</SelectItem><SelectItem value="Transmission">Transmission</SelectItem><SelectItem value="Doors">Doors & Panels</SelectItem><SelectItem value="Wheels">Alloy Wheels & Rims</SelectItem><SelectItem value="Headlights">Headlights / Lenses</SelectItem><SelectItem value="Fenders">Fenders / Body</SelectItem></SelectContent></Select>
              <Button type="button" variant="outline" onClick={clearFilters} disabled={!activeFilterCount} className="h-10 rounded-xl border-slate-700 bg-slate-950 px-5 text-xs font-black text-slate-200 hover:bg-slate-800">Clear filters</Button>
            </div>
          </CardContent>
        </Card>

        {activeFilterCount ? (
          <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Active filters</span>
            {search.trim() ? <button type="button" onClick={() => updateQuery({ search: null, page: null })} className="flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs text-sky-200">Search: {search.trim()} <X className="size-3" /></button> : null}
            {selectedSection !== "ALL" ? <button type="button" onClick={() => updateQuery({ section: null, page: null })} className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">{selectedSection} <X className="size-3" /></button> : null}
            {partFilter !== "ALL" ? <button type="button" onClick={() => updateQuery({ part: null, page: null })} className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">Part: {partFilter} <X className="size-3" /></button> : null}
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="h-7 rounded-full px-3 text-xs font-bold text-rose-300 hover:bg-rose-500/10 hover:text-rose-200">Clear all</Button>
          </div>
        ) : null}

        {recentVehicles.length > 0 && !favoritesOnly ? (
          <section aria-labelledby="recent-arrivals-heading" className="space-y-3">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-400">Fresh on the lot</p>
                <h2 id="recent-arrivals-heading" className="mt-1 text-xl font-black text-white">Recently arrived</h2>
              </div>
              <span className="text-xs text-slate-500">Added within the last 7 days</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {recentVehicles.map((vehicle) => (
                <button
                  key={`recent-${vehicle.id}`}
                  type="button"
                  onClick={() => openVehicle(vehicle)}
                  className="group flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-3 text-left transition hover:border-amber-500/60 hover:bg-slate-800"
                >
                  <img
                    src={vehicle.photoUrl || FALLBACK_VEHICLE_PHOTO}
                    alt=""
                    className="size-16 shrink-0 rounded-xl object-cover"
                    onError={(event) => { (event.currentTarget as HTMLImageElement).src = FALLBACK_VEHICLE_PHOTO; }}
                  />
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-black text-white group-hover:text-amber-300">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </span>
                    <span className="mt-1 block truncate text-xs text-slate-400">{vehicle.section}</span>
                    <div className="mt-2"><VehicleAvailabilityBadge vehicle={vehicle} showRecent={false} /></div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* Vehicle Catalog Cards Grid */}
        <div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-amber-400" /> {favoritesOnly ? "My Saved Vehicles" : "Currently Staged Vehicles"} ({favoritesOnly ? catalogVehicles.length : inventory.total})
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setFavoritesOnly((current) => !current)}
                className={favoritesOnly
                  ? "h-8 rounded-full border-rose-500 bg-rose-500/20 text-xs text-rose-200 hover:bg-rose-500/30"
                  : "h-8 rounded-full border-slate-700 bg-slate-900 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
                }
              >
                <Heart className={`mr-1.5 size-3.5 ${favoritesOnly ? "fill-current" : ""}`} />
                Saved ({favoriteIds.length})
              </Button>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-xs font-mono">
                {availableCount} Available Vehicles On Lot
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={loadData}
                disabled={isLoading}
                className="h-8 text-xs text-slate-400 hover:text-white"
                title="Refresh Inventory"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {loadError ? (
            <Card className="bg-slate-900 border-rose-800/70 text-slate-300 p-10 text-center space-y-3">
              <AlertCircle className="w-10 h-10 mx-auto text-rose-400" />
              <p className="text-sm font-semibold text-white">Inventory could not be loaded</p>
              <p className="text-xs text-slate-400">{loadError}</p>
              <Button size="sm" onClick={loadData} className="bg-amber-500 text-slate-950 hover:bg-amber-400">Try again</Button>
            </Card>
          ) : !isLoading && inventory.total === 0 ? (
            <Card className="bg-slate-900 border-slate-800 text-slate-400 p-12 text-center space-y-3">
              <AlertCircle className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-white">No vehicles found matching your criteria</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Try clearing your search filters or set a vehicle request alert to get notified when a matching car enters the intake station.
              </p>
              <Button
                size="sm"
                onClick={() => updateQuery({ search: null, section: null, part: null, page: null })}
                className="bg-slate-800 border-slate-700 text-slate-200 text-xs"
              >
                Clear All Filters
              </Button>
            </Card>
          ) : favoritesOnly && catalogVehicles.length === 0 ? (
            <Card className="rounded-3xl border-slate-800 bg-slate-900 p-12 text-center text-slate-400">
              <Heart className="mx-auto mb-3 size-10 text-slate-600" />
              <p className="font-bold text-white">No saved vehicles yet</p>
              <p className="mt-1 text-xs">Tap the heart on a vehicle to keep it in this browser.</p>
              <Button type="button" variant="outline" onClick={() => setFavoritesOnly(false)} className="mt-4 rounded-xl border-slate-700 bg-slate-950 text-slate-200">
                View all vehicles
              </Button>
            </Card>
          ) : (
            <div className="relative">
              {isLoading && (
                <div className="absolute inset-0 z-20 flex items-start justify-center rounded-2xl bg-slate-950/65 pt-24 backdrop-blur-sm" role="status">
                  <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-amber-300 shadow-xl">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading inventory…
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy={isLoading}>
                {catalogVehicles.map((veh) => {
                  const displayPhoto = veh.photoUrl || FALLBACK_VEHICLE_PHOTO;
                  const isFavorite = favoriteIds.includes(veh.id);
                  const isWatched = watchedIds.includes(veh.id);

                  return (
                    <Card
                    key={veh.id}
                    onClick={() => openVehicle(veh)}
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

                      <div className="absolute right-2 top-2 z-10 max-w-[72%]">
                        <VehicleAvailabilityBadge vehicle={veh} />
                      </div>

                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] font-mono font-bold text-white bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800">
                        <span>Color: {veh.color || "White"}</span>
                        <span>VIN: {veh.vin.slice(0, 11)}...</span>
                      </div>
                    </div>

                    <CardHeader className="py-3.5 px-4 bg-slate-950/60 border-b border-slate-800 flex flex-row items-center justify-between gap-3">
                      <CardTitle className="min-w-0 truncate text-lg font-black text-white group-hover:text-amber-400 transition-colors">
                        {veh.year} {veh.make} {veh.model}
                      </CardTitle>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={isFavorite ? "Remove from saved vehicles" : "Save vehicle"}
                          title={isFavorite ? "Remove from saved vehicles" : "Save vehicle"}
                          onClick={(event) => { event.stopPropagation(); toggleFavorite(veh); }}
                          className={`size-8 rounded-full ${isFavorite ? "bg-rose-500/20 text-rose-300" : "text-slate-400 hover:text-rose-300"}`}
                        >
                          <Heart className={`size-4 ${isFavorite ? "fill-current" : ""}`} />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={isWatched ? "Turn off status notifications" : "Notify me if status changes"}
                          title={isWatched ? "Status notifications on" : "Notify me if status changes"}
                          onClick={(event) => { event.stopPropagation(); void toggleWatch(veh); }}
                          className={`size-8 rounded-full ${isWatched ? "bg-amber-500/20 text-amber-300" : "text-slate-400 hover:text-amber-300"}`}
                        >
                          <BellRing className={`size-4 ${isWatched ? "fill-current" : ""}`} />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label="Share vehicle"
                          title="Share vehicle"
                          onClick={(event) => { event.stopPropagation(); void shareVehicle(veh); }}
                          className="size-8 rounded-full text-slate-400 hover:text-sky-300"
                        >
                          <Share2 className="size-4" />
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 space-y-3 flex-1">
                      {/* Available Parts checklist */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          {veh.status === "CRUSHED" ? "Component availability" : `Intact Components (${veh.partsRemaining.length}):`}
                        </span>
                        {veh.status === "CRUSHED" ? (
                          <p className="text-xs font-semibold text-rose-300">This vehicle is no longer available for parts.</p>
                        ) : (
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
                        )}
                      </div>
                    </CardContent>

                    <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-amber-400 font-semibold group-hover:bg-amber-950/30 transition-colors">
                      <span className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" /> View vehicle details
                      </span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Card>
                  );
                })}
              </div>

              {!favoritesOnly ? (
                <div className="mt-8 flex flex-col items-center gap-3 border-t border-slate-800 pt-6">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={inventory.page <= 1 || isLoading}
                      onClick={() => updateQuery({ page: String(inventory.page - 1) })}
                      className="rounded-xl border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                    </Button>
                    <span className="min-w-28 text-center text-sm font-semibold text-slate-300">
                      Page {inventory.page} of {inventory.totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={inventory.page >= inventory.totalPages || isLoading}
                      onClick={() => updateQuery({ page: String(inventory.page + 1) })}
                      className="rounded-xl border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                    >
                      Next <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                  <span className="text-xs text-slate-500">
                    Showing {inventory.total ? (inventory.page - 1) * inventory.limit + 1 : 0}–{Math.min(inventory.page * inventory.limit, inventory.total)} of {inventory.total} matches
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>

      </main>

      <footer className="mt-8 border-t border-slate-800 bg-slate-900/70">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <div>
            <p className="text-sm font-black text-white">{yardName}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              {[yardSettings.address, yardSettings.cityStateZip].filter(Boolean).join(", ") || "Call for yard location details."}
            </p>
          </div>
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-300"><CalendarClock className="size-4" /> Yard hours</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">{yardSettings.publicHours || "Call for current operating hours."}</p>
          </div>
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-300"><Phone className="size-4" /> Contact & admission</p>
            {yardSettings.phone ? <a href={`tel:${yardSettings.phone}`} className="mt-2 block text-xs font-bold text-white hover:text-amber-300">{yardSettings.phone}</a> : <p className="mt-2 text-xs text-slate-400">Phone number not listed</p>}
            <p className="mt-1 text-xs text-slate-400">Admission: {yardSettings.admissionFeeUsd ? `$${yardSettings.admissionFeeUsd.toFixed(2)}` : "Free"}</p>
          </div>
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-300"><ShieldCheck className="size-4" /> Safety requirements</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              {yardSettings.safetyRequirements || "Closed-toe boots and safety glasses are required."}
            </p>
          </div>
        </div>
      </footer>

      {/* Request Vehicle Alert Modal */}
      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-400" /> Save Vehicle Request
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Save the vehicle you need and your preferred contact information on this device for quick reference.
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
              <label className="text-slate-300 font-semibold block mb-1">Phone or Email *</label>
              <Input
                value={reqPhone}
                onChange={(e) => setReqPhone(e.target.value)}
                placeholder="Phone number or email"
                className="bg-slate-900 border-slate-800 text-white text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-800">
            <Button variant="ghost" onClick={() => setNotifyOpen(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button onClick={handleSendNotifyRequest} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs">
              Save Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Parts Interchange Search Modal */}
      {interchangeOpen && (
        <Suspense fallback={null}>
          <PartsInterchangeModal
            isOpen
            onClose={() => setInterchangeOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
