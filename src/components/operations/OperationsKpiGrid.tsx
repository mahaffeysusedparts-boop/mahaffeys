import { Card, CardContent } from '@/components/ui/card';
import { OperationsMetrics } from '@/types/operations';
import { Activity, DollarSign, Gauge, Scale, TrendingUp } from 'lucide-react';

export function OperationsKpiGrid({ metrics }: { metrics: OperationsMetrics }) {
  const cards = [
    { label: 'Throughput', value: `${metrics.completedTickets} tickets`, meta: `${metrics.inboundLbs.toLocaleString()} inbound lbs · ${metrics.vehiclesProcessed} vehicles`, icon: Activity, tone: 'text-emerald-400' },
    { label: 'Speed', value: `${metrics.openQueueCount} open queue`, meta: metrics.averageIntakeCycleMinutes === null ? 'Cycle time unavailable' : `${metrics.averageIntakeCycleMinutes} min avg. intake cycle`, icon: Gauge, tone: 'text-amber-400' },
    { label: 'Profit', value: `$${metrics.grossMargin.toLocaleString()}`, meta: `$${metrics.shipmentRevenue.toLocaleString()} revenue · $${metrics.payouts.toLocaleString()} payouts`, icon: TrendingUp, tone: metrics.grossMargin >= 0 ? 'text-emerald-400' : 'text-rose-400' },
    { label: 'Inventory flow', value: metrics.sellThrough === null ? '—' : `${metrics.sellThrough}%`, meta: `${metrics.agingVehicleCount} aging units · ${metrics.delayedTaskCount} delayed tasks`, icon: Scale, tone: 'text-sky-400' },
  ];
  return <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">{cards.map(({ label, value, meta, icon: Icon, tone }) => <Card key={label} className="rounded-2xl border-slate-800 bg-slate-900 shadow-lg"><CardContent className="p-4"><div className="flex items-start justify-between"><p className="text-[11px] uppercase tracking-widest font-bold text-slate-400">{label}</p><Icon className={`w-4 h-4 ${tone}`}/></div><p className={`mt-3 font-mono text-2xl font-black ${tone}`}>{value}</p><p className="mt-1 text-xs leading-5 text-slate-400">{meta}</p></CardContent></Card>)}</div>;
}
