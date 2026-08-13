"use client";

import { lazy, memo, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Car, Search, Calendar, MapPin, Wrench, Clock, RefreshCw } from "lucide-react";
import { storageService } from "@/services/storageService";
import { sharedStorage } from "@/services/sharedStorage";
import { PullYardVehicle, PullYardVehicleStatus } from "@/types/scrap";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const PartsInterchangeModal = lazy(() =>
  import("@/components/inventory/PartsInterchangeModal").then((module) => ({
    default: module.PartsInterchangeModal,
  })),
);
const INVENTORY_PAGE_SIZE = 24;

const VehicleCard = memo(({ vehicle, onInterchangeClick }: { vehicle: PullYardVehicle, onInterchangeClick: (vehicle: PullYardVehicle) => void }) => {
  const daysInYard = Math.floor((Date.now() - new Date(vehicle.dateSetInYard).getTime()) / 86_400_000);
  const isNewArrival = daysInYard <= 7;

  return (
    <Card className="flex flex-col overflow-hidden transition-all hover:shadow-lg [content-visibility:auto] [contain-intrinsic-size:380px]">
      <CardHeader className="p-0">
        <div className="relative">
          <img
            src={vehicle.photoUrl || '/placeholder.svg'}
            alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
            loading="lazy"
            decoding="async"
            className="w-full h-48 object-cover"
          />
          <div className="absolute right-2 top-2 flex flex-col items-end gap-1.5">
            <Badge className={vehicle.status === "PENDING" ? "rounded-full bg-amber-500 text-slate-950 hover:bg-amber-500" : "rounded-full bg-emerald-600 text-white hover:bg-emerald-600"}>
              {vehicle.status === "PENDING" ? "Pending intake" : "Available"}
            </Badge>
            {isNewArrival ? <Badge variant="outline" className="rounded-full border-white/40 bg-slate-950/80 text-white">New arrival</Badge> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        <h3 className="text-lg font-bold">{vehicle.year} {vehicle.make} {vehicle.model}{vehicle.trim ? ` ${vehicle.trim}` : ""}</h3>
        <p className="text-sm text-muted-foreground">{vehicle.color}</p>
        <div className="mt-2 space-y-1 text-sm">
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-2" />
            <span>Arrived: {new Date(vehicle.dateSetInYard).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
          <div className="flex items-center">
            <MapPin className="w-4 h-4 mr-2" />
            <span>Location: {vehicle.section}{vehicle.rowNumber ? `, Row ${vehicle.rowNumber}` : ''}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-2 p-4 bg-gray-50 dark:bg-gray-800">
        {vehicle.status === "PENDING" ? (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <Clock className="h-3.5 w-3.5" /> Awaiting yard processing
          </p>
        ) : null}
        <Button variant="outline" className="w-full" onClick={() => onInterchangeClick(vehicle)}>
          <Wrench className="w-4 h-4 mr-2" />
          Find Interchangeable Parts
        </Button>
      </CardFooter>
    </Card>
  );
});

VehicleCard.displayName = "VehicleCard";

export default function PublicVehicleInventoryPage() {
  const [vehicles, setVehicles] = useState<PullYardVehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | PullYardVehicleStatus>("ALL");
  const [sortBy, setSortBy] = useState("dateSetInYard_desc");
  const [visibleCount, setVisibleCount] = useState(INVENTORY_PAGE_SIZE);
  const [selectedVehicleForInterchange, setSelectedVehicleForInterchange] = useState<PullYardVehicle | null>(null);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const loadVehicles = useCallback(() => {
    setVehicles(storageService.getInventoryVehicles().filter((vehicle) => vehicle.status !== "CRUSHED"));
  }, []);

  useEffect(() => {
    loadVehicles();
    const handleStorageChange = (event: StorageEvent) => {
      if (!event.key || event.key === "mahaffeys_pull_yard_vehicles" || event.key === "mahaffeys_tickets") loadVehicles();
    };
    window.addEventListener("storage", handleStorageChange);
    const unsubscribe = sharedStorage.subscribe((status) => {
      if (status === "connected") loadVehicles();
    });
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      unsubscribe();
    };
  }, [loadVehicles]);

  const filteredAndSortedVehicles = useMemo(() => {
    const query = deferredSearchTerm.trim().toLowerCase();
    const result = vehicles.filter((vehicle) => {
      const matchesSearch = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ""} ${vehicle.vin}`.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "ALL" || vehicle.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    const [sortField, sortDir] = sortBy.split('_');

    result.sort((a, b) => {
      let valA, valB;
      if (sortField === 'dateSetInYard') {
        valA = new Date(a.dateSetInYard).getTime();
        valB = new Date(b.dateSetInYard).getTime();
      } else if (sortField === 'year') {
        valA = a.year;
        valB = b.year;
      } else {
        valA = a.make.toLowerCase();
        valB = b.make.toLowerCase();
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [deferredSearchTerm, sortBy, statusFilter, vehicles]);

  const visibleVehicles = useMemo(
    () => filteredAndSortedVehicles.slice(0, visibleCount),
    [filteredAndSortedVehicles, visibleCount],
  );

  useEffect(() => {
    setVisibleCount(INVENTORY_PAGE_SIZE);
  }, [deferredSearchTerm, sortBy, statusFilter]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Yard Inventory</h1>
          <p className="text-lg text-muted-foreground mt-2">Track pending intake vehicles and cars currently available for parts.</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-md mb-8 sticky top-4 z-10">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by Year, Make, Model, Trim, or VIN..."
                className="pl-10 rounded-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "ALL" | PullYardVehicleStatus)}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Vehicle status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All active ({vehicles.length})</SelectItem>
                <SelectItem value="PENDING">Pending intake ({vehicles.filter((vehicle) => vehicle.status === "PENDING").length})</SelectItem>
                <SelectItem value="AVAILABLE">Available ({vehicles.filter((vehicle) => vehicle.status === "AVAILABLE").length})</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Sort by..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dateSetInYard_desc">Newest Arrivals</SelectItem>
                <SelectItem value="dateSetInYard_asc">Oldest Arrivals</SelectItem>
                <SelectItem value="year_desc">Year (Newest First)</SelectItem>
                <SelectItem value="year_asc">Year (Oldest First)</SelectItem>
                <SelectItem value="make_asc">Make (A-Z)</SelectItem>
                <SelectItem value="make_desc">Make (Z-A)</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={loadVehicles} className="rounded-xl">
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </div>
        </div>

        {filteredAndSortedVehicles.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {visibleVehicles.map(vehicle => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} onInterchangeClick={setSelectedVehicleForInterchange} />
              ))}
            </div>

            {visibleVehicles.length < filteredAndSortedVehicles.length && (
              <div className="mt-8 flex flex-col items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setVisibleCount((count) => count + INVENTORY_PAGE_SIZE)}
                >
                  Load {Math.min(INVENTORY_PAGE_SIZE, filteredAndSortedVehicles.length - visibleVehicles.length)} more vehicles
                </Button>
                <span className="text-sm text-muted-foreground">
                  Showing {visibleVehicles.length} of {filteredAndSortedVehicles.length} vehicles
                </span>
              </div>
            )}
          </>
        ) : (
          <Alert className="max-w-2xl mx-auto">
            <Car className="h-4 w-4" />
            <AlertTitle>No Vehicles Found</AlertTitle>
            <AlertDescription>
              Your search returned no results. Try a different search term or check back later for new arrivals.
            </AlertDescription>
          </Alert>
        )}
      </main>
      <Footer />
      {selectedVehicleForInterchange && (
        <Suspense fallback={null}>
          <PartsInterchangeModal
            isOpen
            onClose={() => setSelectedVehicleForInterchange(null)}
            initialMake={selectedVehicleForInterchange.make}
            initialModel={selectedVehicleForInterchange.model}
            initialYear={selectedVehicleForInterchange.year}
          />
        </Suspense>
      )}
    </div>
  );
}