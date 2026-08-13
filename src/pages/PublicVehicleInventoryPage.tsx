"use client";

import { lazy, memo, Suspense, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Car, Search, Calendar, MapPin, Wrench } from "lucide-react";
import { storageService } from "@/services/storageService";
import { PullYardVehicle } from "@/types/scrap";
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
          {isNewArrival && (
            <Badge className="absolute top-2 right-2 bg-green-500 text-white">New Arrival</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        <h3 className="text-lg font-bold">{vehicle.year} {vehicle.make} {vehicle.model}</h3>
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
      <CardFooter className="p-4 bg-gray-50 dark:bg-gray-800">
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
  const [sortBy, setSortBy] = useState("dateSetInYard_desc");
  const [visibleCount, setVisibleCount] = useState(INVENTORY_PAGE_SIZE);
  const [selectedVehicleForInterchange, setSelectedVehicleForInterchange] = useState<PullYardVehicle | null>(null);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  useEffect(() => {
    const allVehicles = storageService.getPullYardVehicles();
    const availableVehicles = allVehicles.filter(v => v.status === 'AVAILABLE');
    setVehicles(availableVehicles);
  }, []);

  const filteredAndSortedVehicles = useMemo(() => {
    const query = deferredSearchTerm.trim().toLowerCase();
    const result = vehicles.filter(v =>
      `${v.year} ${v.make} ${v.model} ${v.vin}`.toLowerCase().includes(query)
    );

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
  }, [deferredSearchTerm, sortBy, vehicles]);

  const visibleVehicles = useMemo(
    () => filteredAndSortedVehicles.slice(0, visibleCount),
    [filteredAndSortedVehicles, visibleCount],
  );

  useEffect(() => {
    setVisibleCount(INVENTORY_PAGE_SIZE);
  }, [deferredSearchTerm, sortBy]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Yard Inventory</h1>
          <p className="text-lg text-muted-foreground mt-2">Browse vehicles currently available for parts.</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md mb-8 sticky top-4 z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by Year, Make, Model, or VIN..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dateSetInYard_desc">Newest Arrivals</SelectItem>
                  <SelectItem value="dateSetInYard_asc">Oldest Arrivals</SelectItem>
                  <SelectItem value="year_desc">Year (Newest First)</SelectItem>
                  <SelectItem value="year_asc">Year (Oldest First)</SelectItem>
                  <SelectItem value="make_asc">Make (A-Z)</SelectItem>
                  <SelectItem value="make_desc">Make (Z-A)</SelectItem>
                </SelectContent>
              </Select>
            </div>
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