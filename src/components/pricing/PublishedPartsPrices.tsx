import { useQuery } from '@tanstack/react-query';
import { priceSheetService } from '@/services/priceSheetService';
import { PartsPricesContent } from './PartsPricesContent';
import { Button } from '@/components/ui/button';

export function PublishedPartsPrices() {
  const prices = useQuery({queryKey:['published-parts-prices'],queryFn:priceSheetService.publicPrices,refetchInterval:30000});
  if (prices.isPending) return <p role="status" className="rounded-xl border border-emerald-800 bg-emerald-950 p-4 text-emerald-100">Loading published prices…</p>;
  if (prices.isError && !prices.data) return <div role="alert" className="rounded-xl border border-amber-700 bg-amber-950 p-4 text-amber-100">Prices could not be refreshed: {prices.error.message}<Button onClick={() => void prices.refetch()} className="ml-3 rounded-xl bg-emerald-700 text-white">Retry</Button></div>;
  return <>{prices.isError && <p role="status" className="mb-4 rounded-xl border border-amber-700 bg-amber-950 p-3 text-amber-100">Refresh failed — showing the last loaded published snapshot, not a new publication.</p>}<PartsPricesContent data={prices.data!}/></>;
}
