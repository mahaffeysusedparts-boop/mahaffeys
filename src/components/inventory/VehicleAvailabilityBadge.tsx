import { AlertTriangle, CheckCircle2, Clock3, Sparkles, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PullYardVehicle } from '@/types/scrap';

interface VehicleAvailabilityBadgeProps {
  vehicle: Pick<PullYardVehicle, 'status' | 'partsRemaining' | 'dateSetInYard'>;
  showRecent?: boolean;
}

export const isRecentlyArrived = (dateSetInYard: string) => (
  Date.now() - new Date(dateSetInYard).getTime() <= 7 * 86_400_000
);

export const VehicleAvailabilityBadge = ({ vehicle, showRecent = true }: VehicleAvailabilityBadgeProps) => {
  const recent = showRecent && isRecentlyArrived(vehicle.dateSetInYard);
  const partsLimited = vehicle.status === 'AVAILABLE' && vehicle.partsRemaining.length <= 3;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {vehicle.status === 'CRUSHED' ? (
        <Badge className="border-rose-500/50 bg-rose-950/90 text-[10px] font-black uppercase tracking-wide text-rose-200">
          <XCircle className="mr-1 size-3" /> No longer available
        </Badge>
      ) : vehicle.status === 'PENDING' ? (
        <Badge className="border-amber-500/50 bg-amber-950/90 text-[10px] font-black uppercase tracking-wide text-amber-200">
          <Clock3 className="mr-1 size-3" /> Pending processing
        </Badge>
      ) : partsLimited ? (
        <Badge className="border-orange-500/50 bg-orange-950/90 text-[10px] font-black uppercase tracking-wide text-orange-200">
          <AlertTriangle className="mr-1 size-3" /> Parts limited
        </Badge>
      ) : (
        <Badge className="border-emerald-500/50 bg-emerald-950/90 text-[10px] font-black uppercase tracking-wide text-emerald-200">
          <CheckCircle2 className="mr-1 size-3" /> Available
        </Badge>
      )}

      {recent && vehicle.status !== 'CRUSHED' ? (
        <Badge className="border-sky-500/50 bg-sky-950/90 text-[10px] font-black uppercase tracking-wide text-sky-200">
          <Sparkles className="mr-1 size-3" /> Recently arrived
        </Badge>
      ) : null}
    </div>
  );
};
