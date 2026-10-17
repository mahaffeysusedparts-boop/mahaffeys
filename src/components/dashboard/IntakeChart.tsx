import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Ticket } from '@/types/scrap';

export function ticketWeight(ticket: Ticket) {
  return ticket.ticketType === 'CAR_SALVAGE' && ticket.carRecord
    ? ticket.carRecord.vehicleWeightLbs
    : ticket.scrapLines?.reduce((total, line) => total + line.billableWeight, 0) ?? 0;
}

export function IntakeChart({ tickets, now }: { tickets: Ticket[]; now: Date }) {
  const [days, setDays] = useState('7');
  const [metric, setMetric] = useState<'both' | 'payout' | 'scrapLbs'>('both');
  const data = useMemo(() => {
    const totals = new Map<string, { payout: number; scrapLbs: number; count: number }>();
    tickets.filter(ticket => ticket.status === 'COMPLETED').forEach(ticket => {
      const key = new Date(ticket.createdAt).toDateString();
      const total = totals.get(key) ?? { payout: 0, scrapLbs: 0, count: 0 };
      total.payout += ticket.finalPayout;
      total.scrapLbs += ticketWeight(ticket);
      total.count += 1;
      totals.set(key, total);
    });
    return Array.from({ length: Number(days) }, (_, index) => {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (Number(days) - 1 - index));
      return { day: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), ...(totals.get(date.toDateString()) ?? { payout: 0, scrapLbs: 0, count: 0 }) };
    });
  }, [tickets, days, now]);
  const showPayout = metric !== 'scrapLbs';
  const showWeight = metric !== 'payout';
  const hasActivity = data.some(day => day.count > 0);

  return <Card className="lg:col-span-2 rounded-2xl border-slate-800 bg-slate-900 text-white shadow-xl">
    <CardHeader className="gap-4 border-b border-slate-800 bg-slate-950/60 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base font-bold"><TrendingUp className="h-5 w-5 text-emerald-400" /> Scrap volume & cash stream</CardTitle><CardDescription className="mt-1 text-xs text-slate-400">Completed intake · separate dollar and weight axes</CardDescription></div>
        <Select value={days} onValueChange={setDays}><SelectTrigger aria-label="Chart date range" className="h-9 w-36 rounded-xl border-slate-700 bg-slate-800 text-xs"><SelectValue /></SelectTrigger><SelectContent className="border-slate-700 bg-slate-900 text-white">{['7', '14', '30'].map(value => <SelectItem key={value} value={value}>Last {value} days</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="flex flex-wrap gap-2">{([['both', 'Both metrics'], ['payout', 'Payout ($)'], ['scrapLbs', 'Scrap (lbs)']] as const).map(([value, label]) => <Button key={value} size="sm" variant="outline" aria-pressed={metric === value} onClick={() => setMetric(value)} className={`h-8 rounded-lg text-xs ${metric === value ? 'border-emerald-500/40 bg-emerald-950 text-emerald-200 hover:bg-emerald-900' : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{label}</Button>)}</div>
    </CardHeader>
    <CardContent className="p-4 sm:p-5">
      {!hasActivity && <p role="status" className="mb-3 rounded-xl bg-slate-800 px-3 py-2 text-xs text-slate-300">No completed intake in this period.</p>}
      <div className="h-64 w-full" role="img" aria-label={`Intake chart for the last ${days} days. Exact daily totals are available in the table below.`}>
        <ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }} accessibilityLayer>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} minTickGap={28} />
          <YAxis yAxisId="cash" hide={!showPayout} stroke="#6ee7b7" fontSize={10} width={52} tickFormatter={value => `$${Number(value).toLocaleString()}`} />
          <YAxis yAxisId="weight" orientation="right" hide={!showWeight} stroke="#fcd34d" fontSize={10} width={58} tickFormatter={value => Number(value).toLocaleString()} />
          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#475569', color: '#f8fafc', fontSize: 12, borderRadius: 12 }} formatter={(value, name) => [name === 'Payout' ? `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${Number(value).toLocaleString()} lbs`, name]} />
          {showPayout && <Area yAxisId="cash" type="monotone" dataKey="payout" name="Payout" stroke="#34d399" fill="#34d399" fillOpacity={0.12} strokeWidth={2} activeDot={{ r: 5 }} />}
          {showWeight && <Area yAxisId="weight" type="monotone" dataKey="scrapLbs" name="Scrap" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.08} strokeWidth={2} activeDot={{ r: 5 }} />}
        </AreaChart></ResponsiveContainer>
      </div>
      <details className="mt-4 text-xs text-slate-300"><summary className="cursor-pointer rounded-lg py-2 font-semibold focus-visible:outline-emerald-400">View daily totals</summary><div className="mt-2 max-h-56 overflow-auto"><table className="w-full text-left"><caption className="sr-only">Daily completed ticket totals</caption><thead><tr className="border-b border-slate-700"><th className="p-2">Day</th><th className="p-2">Tickets</th><th className="p-2">Payout</th><th className="p-2">Scrap (lbs)</th></tr></thead><tbody>{data.map(day => <tr key={day.day} className="border-b border-slate-800"><td className="p-2">{day.day}</td><td className="p-2">{day.count}</td><td className="p-2">${day.payout.toFixed(2)}</td><td className="p-2">{day.scrapLbs.toLocaleString()}</td></tr>)}</tbody></table></div></details>
    </CardContent>
  </Card>;
}
