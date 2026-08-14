"use client";

import { lazy, memo, Suspense, useCallback, useDeferredValue, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Car, Search, Calendar, MapPin, Wrench, Clock, RefreshCw, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { fetchInventory, type InventoryResponse } from "@/services/inventoryService";
import { PullYardVehicle, PullYardVehicleStatus } from "@/types/scrap";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const PartsInterchangeModal = lazy(() =>
  import("@/components/inventory/PartsInterchangeModal").then((module) => ({
    default: module.PartsInterchangeModal,
  })),
);
const INVENTORY_PAGE_SIZE = 24;
const EMPTY_INVENTORY: InventoryResponse = {
  items: [], total: 0, page: 1, limit: INVENTORY_PAGE_SIZE, totalPages: 1,
  counts: { available: 0, pending: 0, crushed: 0 }, updatedAt: null,
};

const VehicleCard = memo(({ vehicle, onInterchangeClick }: { vehicle: PullYardVehicle, onInterchangeClick: (vehicle: PullYardVehicle) => void }) => {
  const daysInYard = Math.floor((Date.now() - new Date(vehicle.dateSetInYard).getTime()) / 86_400_000);
  const isNewArrival = daysInYard <= 7;

  return (
    <Card className="flex flex-col overflow-hidden rounded-2xl border-slate-200 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-700">
      <CardHeader className="p-0">
        <div className="relative">
          <img
            src={vehicle.photoUrl || "/placeholder.svg"}
            alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
            loading="lazy"
            decoding="async"
            className="h-48 w-full object-cover"
          />
          <div className="absolute right-2 top-2 flex flex-col items-end gap-1.5">
            <Badge className={vehicle.status === "PENDING" ? "rounded-full bg-amber-500 text-slate-950 hover:bg-amber-500" : "rounded-full bg-emerald-600 text-white hover:bg-emerald-600"}>
              {vehicle.status === "PENDING" ? "Pending intake" : "Available"}
            </Badge>
            {isNewArrival ? <Badge variant="outline" className="rounded-full border-white/40 bg-slate-950/80 text-white">New arrival</Badge> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow p-4">
        <h3 className="text-lg font-bold">{vehicle.year} {vehicle.make} {vehicle.model}{vehicle.trim ? ` ${vehicle.trim}` : ""}</h3>
        <p className="text-sm text-muted-foreground">{vehicle.color}</p>
        <div className="mt-2 space-y-1 text-sm">
          <div className="flex items-center">
            <Calendar className="mr-2 h-4 w-4" />
            <span>Arrived: {new Date(vehicle.dateSetInYard).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
          <div className="flex items-center">
            <MapPin className="mr-2 h-4 w-4" />
            <span>Location: {vehicle.section}{vehicle.rowNumber ? `, Row ${vehicle.rowNumber}` : ""}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-2 bg-slate-50 p-4 dark:bg-slate-800">
        {vehicle.status === "PENDING" ? (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <Clock className="h-3.5 w-3.5" /> Awaiting yard processing
          </p>
        ) : null}
        <Button variant="outline" className="w-full rounded-xl" onClick={() => onInterchangeClick(vehicle)}>
          <Wrench className="mr-2 h-4 w-4" /> Find Interchangeable Parts
        </Button>
      </CardFooter>
    </Card>
  );
});
VehicleCard.displayName = "VehicleCard";

export default function PublicVehicleInventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [inventory, setInventory] = useState<InventoryResponse>(EMPTY_INVENTORY);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [selectedVehicleForInterchange, setSelectedVehicleForInterchange] = useState<PullYardVehicle | null>(null);
  const searchTerm = searchParams.get("search") || "";
  const statusFilter = (searchParams.get("status") || "ALL") as "ALL" | PullYardVehicleStatus;
  const sortBy = searchParams.get("sort") || "dateSetInYard_desc";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const updateQuery = useCallback((updates: Record<string, string | null>) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(updates).forEach(([key, value]) => {
        const isDefault = value === "ALL" || (key === "page" && value === "1") || (key === "sort" && value === "dateSetInYard_desc");
        if (!value || isDefault) next.delete(key);
        else next.set(key, value);
      });
      return next;
    });
  }, [setSearchParams]);

  const loadVehicles = useCallback(() => setRefreshToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(page),
      limit: String(INVENTORY_PAGE_SIZE),
      sort: sortBy,
      excludeCrushed: "true",
    });
    if (deferredSearchTerm.trim()) params.set("search", deferredSearchTerm.trim());
    if (statusFilter !== "ALL") params.set("status", statusFilter);
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
  }, [deferredSearchTerm, page, refreshToken, sortBy, statusFilter, updateQuery]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-900">
      <Header />
      <main className="container mx-auto flex-grow px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Yard Inventory</h1>
          <p className="mt-2 text-lg text-muted-foreground">Track pending intake vehicles and cars currently available for parts.</p>
        </div>

        <div className="sticky top-4 z-10 mb-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-md dark:border-slate-700 dark:bg-slate-800">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by Year, Make, Model, Trim, or VIN..."
                className="rounded-xl pl-10"
                value={searchTerm}
                onChange={(event) => updateQuery({ search: event.target.value, page: null })}
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => updateQuery({ status: value, page: null })}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Vehicle status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All active ({inventory.total})</SelectItem>
                <SelectItem value="PENDING">Pending intake ({inventory.counts.pending})</SelectItem>
                <SelectItem value="AVAILABLE">Available ({inventory.counts.available})</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(value) => updateQuery({ sort: value, page: null })}>
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
            <Button type="button" variant="outline" onClick={loadVehicles} disabled={isLoading} className="rounded-xl">
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>

        {loadError ? (
          <Alert variant="destructive" className="mx-auto max-w-2xl rounded-2xl">
            <Car className="h-4 w-4" />
            <AlertTitle>Inventory could not be loaded</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3">
              <span>{loadError}</span><Button size="sm" variant="outline" onClick={loadVehicles}>Try again</Button>
            </AlertDescription>
          </Alert>
        ) : !isLoading && inventory.total === 0 ? (
          <Alert className="mx-auto max-w-2xl rounded-2xl">
            <Car className="h-4 w-4" />
            <AlertTitle>No Vehicles Found</AlertTitle>
            <AlertDescription>Your search returned no results. Try a different search term or check back later for new arrivals.</AlertDescription>
          </Alert>
        ) : (
          <div className="relative">
            {isLoading && (
              <div className="absolute inset-0 z-20 flex items-start justify-center rounded-2xl bg-slate-50/75 pt-24 backdrop-blur-sm dark:bg-slate-900/75" role="status">
                <div className="flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-semibold shadow-lg dark:bg-slate-800">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> Loading inventory…
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy={isLoading}>
              {inventory.items.map((vehicle) => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} onInterchangeClick={setSelectedVehicleForInterchange} />
              ))}
            </div>

            <div className="mt-8 flex flex-col items-center gap-3 border-t border-slate-200 pt-6 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Button variant="outline" className="rounded-xl" disabled={inventory.page <= 1 || isLoading} onClick={() => updateQuery({ page: String(inventory.page - 1) })}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                </Button>
                <span className="min-w-28 text-center text-sm font-semibold">Page {inventory.page} of {inventory.totalPages}</span>
                <Button variant="outline" className="rounded-xl" disabled={inventory.page >= inventory.totalPages || isLoading} onClick={() => updateQuery({ page: String(inventory.page + 1) })}>
                  Next <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
              <span className="text-sm text-muted-foreground">
                Showing {inventory.total ? (inventory.page - 1) * inventory.limit + 1 : 0}–{Math.min(inventory.page * inventory.limit, inventory.total)} of {inventory.total} vehicles
              </span>
            </div>
          </div>
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
