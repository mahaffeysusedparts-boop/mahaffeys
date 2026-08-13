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
    <Card className="flex flex-col overflow-hidden transition-all hover:shadow-lg">
      <CardHeader className="p-0">
        <div className="relative">
          <img src={vehicle.photoUrl || '/placeholder.svg'} alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} className="w-full h-48 object-cover" />
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
            <span>Arrived: {format(new Date(vehicle.dateSetInYard), 'MMM d, yyyy')}</span>
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
};

export default function PublicVehicleInventoryPage() {
  const [vehicles, setVehicles] = useState<PullYardVehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("dateSetInYard_desc");
  const [selectedVehicleForInterchange, setSelectedVehicleForInterchange] = useState<PullYardVehicle | null>(null);

  useEffect(() => {
    const allVehicles = storageService.getPullYardVehicles();
    const availableVehicles = allVehicles.filter(v => v.status === 'AVAILABLE');
    setVehicles(availableVehicles);
  }, []);

  const filteredAndSortedVehicles = useMemo(() => {
    let result = vehicles.filter(v =>
      `${v.year} ${v.make} ${v.model} ${v.vin}`.toLowerCase().includes(searchTerm.toLowerCase())
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
      } else { // make
        valA = a.make.toLowerCase();
        valB = b.make.toLowerCase();
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [vehicles, searchTerm, sortBy]);

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAndSortedVehicles.map(vehicle => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} onInterchangeClick={setSelectedVehicleForInterchange} />
            ))}
          </div>
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
        <PartsInterchangeModal
          vehicle={selectedVehicleForInterchange}
          onClose={() => setSelectedVehicleForInterchange(null)}
        />
      )}
    </div>
  );
}