import { useQuery } from '@tanstack/react-query';
import { binInspectionService } from '@/services/binInspectionService';
export function useBinInspection(cycleId?: string) {
  return useQuery({ queryKey: ['bin-inspections', cycleId], queryFn: () => binInspectionService.queue(cycleId), enabled: !!cycleId, refetchInterval: 1000, refetchIntervalInBackground: false, refetchOnWindowFocus: 'always', refetchOnReconnect: 'always', retry: false });
}
export function useBinCatalog() {
  return useQuery({ queryKey: ['bin-catalog'], queryFn: binInspectionService.catalog, refetchInterval: 1000, refetchOnWindowFocus: 'always', refetchOnReconnect: 'always', retry: false });
}
