import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Car,
  CheckCircle2,
  Fuel,
  MapPin,
  Phone,
  Scale,
  Share2,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { VehicleAvailabilityBadge } from '@/components/inventory/VehicleAvailabilityBadge';
import { fetchInventory } from '@/services/inventoryService';
import { storageService } from '@/services/storageService';
import { PullYardVehicle } from '@/types/scrap';
import { generateSamplePhoto } from '@/utils/complianceUtils';
import { toast } from 'sonner';

const FALLBACK_VEHICLE_PHOTO = generateSamplePhoto('vehicle');

export default function PublicVehicleDetailPage() {
  const { vin = '' } = useParams();
  const settings = storageService.getSettings();
  const [vehicle, setVehicle] = useState<PullYardVehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      search: vin,
      page: '1',
      limit: '100',
      sort: 'dateSetInYard_desc',
    });

    setIsLoading(true);
    setError('');
    fetchInventory(params, controller.signal)
      .then((response) => {
        const match = response.items.find((item) => item.vin.toUpperCase() === vin.toUpperCase());
        if (!match) throw new Error('This vehicle is not currently listed in the public inventory.');
        setVehicle(match);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : 'Unable to load this vehicle.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [vin]);

  const shareVehicle = async () => {
    if (!vehicle) return;
    const shareData = {
      title: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      text: `View this vehicle at ${settings.yardName}`,
      url: window.location.href,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Vehicle link copied');
      }
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      toast.error('Could not share this vehicle');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/inventory" className="flex items-center gap-3 rounded-xl text-slate-200 transition hover:text-amber-300">
            <span className="flex size-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-900">
              <ArrowLeft className="size-4" />
            </span>
            <span>
              <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Back to catalog</span>
              <span className="block max-w-[190px] truncate text-xs font-semibold text-slate-400 sm:max-w-sm">{settings.yardName}</span>
            </span>
          </Link>
          <Badge className="rounded-full border-emerald-500/40 bg-emerald-500/15 text-[10px] font-black uppercase tracking-widest text-emerald-300">
            <Scale className="mr-1.5 size-3" /> Public catalog
          </Badge>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        {isLoading ? (
          <div className="grid min-h-[60vh] place-items-center">
            <div className="text-center">
              <Car className="mx-auto size-10 animate-pulse text-amber-400" />
              <p className="mt-3 text-sm font-semibold text-slate-400">Loading vehicle details…</p>
            </div>
          </div>
        ) : error || !vehicle ? (
          <Card className="mx-auto max-w-xl rounded-3xl border-rose-500/30 bg-slate-900 text-center text-white">
            <CardContent className="p-10">
              <Car className="mx-auto size-12 text-slate-600" />
              <h1 className="mt-4 text-xl font-black">Vehicle unavailable</h1>
              <p className="mt-2 text-sm text-slate-400">{error}</p>
              <Button asChild className="mt-6 rounded-xl bg-amber-400 font-black text-slate-950 hover:bg-amber-300">
                <Link to="/inventory">Return to inventory</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-end md:justify-between">
              <div>
                <VehicleAvailabilityBadge vehicle={vehicle} />
                <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </h1>
                <p className="mt-2 font-mono text-xs tracking-wider text-slate-400">VIN {vehicle.vin}</p>
              </div>
              <Button onClick={() => void shareVehicle()} className="w-full rounded-xl bg-sky-600 font-black text-white hover:bg-sky-500 md:w-auto">
                <Share2 className="mr-2 size-4" /> Share vehicle
              </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.45fr_0.8fr]">
              <div className="space-y-6">
                <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
                  <img
                    src={vehicle.photoUrl || FALLBACK_VEHICLE_PHOTO}
                    alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                    className="max-h-[620px] min-h-[280px] w-full object-cover"
                    onError={(event) => { event.currentTarget.src = FALLBACK_VEHICLE_PHOTO; }}
                  />
                </div>

                <Card className="rounded-3xl border-slate-800 bg-slate-900 text-white">
                  <CardContent className="p-5 sm:p-6">
                    <div className="mb-4 flex items-center gap-2">
                      <Wrench className="size-5 text-amber-400" />
                      <h2 className="text-lg font-black">Available components</h2>
                    </div>
                    {vehicle.status !== 'CRUSHED' && vehicle.partsRemaining.length ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {vehicle.partsRemaining.map((part) => (
                          <div key={part} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-200">
                            <CheckCircle2 className="size-4 shrink-0 text-emerald-400" /> {part}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl bg-slate-950 p-4 text-sm text-slate-400">
                        {vehicle.status === 'CRUSHED' ? 'This vehicle is no longer available for parts.' : 'No components are currently listed as available.'}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <aside className="space-y-4">
                <Card className="rounded-3xl border-slate-800 bg-slate-900 text-white">
                  <CardContent className="space-y-5 p-5">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Yard location</p>
                      <p className="mt-1 flex items-start gap-2 text-lg font-black text-amber-300">
                        <MapPin className="mt-1 size-4 shrink-0" />
                        <span>{vehicle.section}{vehicle.rowNumber ? ` · Row ${vehicle.rowNumber}` : ''}</span>
                      </p>
                    </div>
                    <div className="border-t border-slate-800 pt-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Arrival date</p>
                      <p className="mt-1 flex items-center gap-2 font-bold text-slate-200">
                        <CalendarDays className="size-4 text-sky-400" />
                        {new Date(vehicle.dateSetInYard).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 border-t border-slate-800 pt-4 text-sm">
                      <div><p className="text-[10px] uppercase tracking-wider text-slate-500">Color</p><p className="mt-1 font-bold">{vehicle.color || 'Not listed'}</p></div>
                      <div><p className="text-[10px] uppercase tracking-wider text-slate-500">Trim</p><p className="mt-1 font-bold">{vehicle.trim || 'Not listed'}</p></div>
                    </div>
                    {(vehicle.engineSizeLiters || vehicle.engineCylinders || vehicle.fuelType) ? (
                      <div className="border-t border-slate-800 pt-4">
                        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500"><Fuel className="size-3" /> Powertrain</p>
                        <p className="mt-1 text-sm font-bold text-slate-200">
                          {[vehicle.engineSizeLiters ? `${vehicle.engineSizeLiters}L` : null, vehicle.engineCylinders ? `${vehicle.engineCylinders}-cylinder` : null, vehicle.fuelType].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border-amber-500/30 bg-amber-500/10 text-white">
                  <CardContent className="p-5">
                    <h2 className="flex items-center gap-2 text-sm font-black text-amber-200"><ShieldCheck className="size-4" /> Before visiting</h2>
                    <p className="mt-2 text-xs leading-relaxed text-slate-300">
                      {settings.safetyRequirements || 'Closed-toe boots and safety glasses are required.'}
                    </p>
                    {settings.phone ? (
                      <Button asChild variant="outline" className="mt-4 w-full rounded-xl border-amber-500/40 bg-slate-950 text-amber-200 hover:bg-slate-900 hover:text-amber-100">
                        <a href={`tel:${settings.phone}`}><Phone className="mr-2 size-4" /> Call to confirm availability</a>
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              </aside>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
