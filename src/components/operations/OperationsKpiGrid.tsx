import { Card, CardContent } from '@/components/ui/card';
import { OperationsMetrics } from '@/types/operations';
import { Activity, Gauge, Scale, TrendingUp } from 'lucide-react';

export function OperationsKpiGrid({ metrics }: { metrics: OperationsMetrics }) {
  const cards = [
    { label: 'Throughput', value: `${metrics.completedTickets} tickets`, meta: `${metrics.inboundLbs.toLocaleString()} inbound lbs · ${metrics.vehiclesProcessed} vehicles`, icon: Activity, tone: 'text-emerald-400' },
    { label: 'Speed', value: `${metrics.openQueueCount} open queue`, meta: metrics.averageIntakeCycleMinutes === null ? 'Cycle time unavailable' : `${metrics.averageIntakeCycleMinutes} min avg. intake cycle`, icon: Gauge, tone: 'text-amber-400' },
    { label: 'Profit', value: `$${metrics.grossMargin.toLocaleString()}`, meta: `$${metrics.shipmentRevenue.toLocaleString()} revenue · $${metrics.payouts.toLocaleString()} payouts`, icon: TrendingUp, tone: metrics.grossMargin >= 0 ? 'text-emerald-400' : 'text-rose-400' },
    { label: 'Inventory flow', value: metrics.sellThrough === null ? '—' : `${metrics.sellThrough}%`, meta: `${metrics.agingVehicleCount} aging units · ${metrics.delayedTaskCount} delayed tasks`, icon: Scale, tone: 'text-sky-400' },
  ];
  return <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">{cards.map(({ label, value, meta, icon: Icon, tone }) => <Card key={label} className="min-w-0 rounded-2xl border-slate-800 bg-slate-900 shadow-lg"><CardContent className="p-3.5 sm:p-4"><div className="flex items-start justify-between gap-2"><p className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold text-slate-400">{label}</p><Icon className={`w-4 h-4 shrink-0 ${tone}`}/></div><p className={`mt-2.5 font-mono text-lg sm:text-2xl font-black break-words ${tone}`}>{value}</p><p className="mt-1 text-[11px] sm:text-xs leading-4 sm:leading-5 text-slate-400">{meta}</p></CardContent></Card>)}</div>;
}
