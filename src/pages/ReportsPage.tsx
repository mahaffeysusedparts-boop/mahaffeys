import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { storageService } from '@/services/storageService';
import { deriveOperationsMetrics, ticketWeight } from '@/services/operationsMetrics';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { downloadCsv } from '@/utils/exportUtils';
import {
  Activity, CarFront, Download, FileText, Printer, Receipt, Scale, TrendingDown, TrendingUp, Users, Wallet,
} from 'lucide-react';
import { CustomReportModal } from '@/components/reports/CustomReportModal';

const money = (value: number) => value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
const colors = ['#34d399', '#fbbf24', '#60a5fa', '#f472b6', '#a78bfa'];

const deltaPct = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

export default function ReportsPage() {
  const [range, setRange] = useState('30');
  const [customReportOpen, setCustomReportOpen] = useState(false);
  const days = Number(range);

  // Live data — reports refresh automatically as workstations record activity.
  const [tickets, setTickets] = useState(() => storageService.getTickets());
  const [shipments, setShipments] = useState(() => storageService.getShipments());
  const [vehicles, setVehicles] = useState(() => storageService.getPullYardVehicles());
  const [scaleEvents, setScaleEvents] = useState(() => storageService.getScaleEvents());

  useEffect(() => {
    const refresh = () => {
      setTickets([...storageService.getTickets()]);
      setShipments([...storageService.getShipments()]);
      setVehicles([...storageService.getPullYardVehicles()]);
      setScaleEvents([...storageService.getScaleEvents()]);
    };
    const keys = ['mahaffeys_tickets', 'mahaffeys_shipments', 'mahaffeys_pull_yard_vehicles', 'mahaffeys_scale_events'];
    const unsubscribers = keys.map((key) => storageService.subscribe(key, refresh));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  const { active, previousActive, settled, metrics, windowLabel } = useMemo(() => {
    const now = Date.now();
    const windowMs = days * 86400000;
    const completed = tickets.filter((ticket) => ticket.status === 'COMPLETED');
    const activeTickets = completed.filter((ticket) => new Date(ticket.createdAt).getTime() >= now - windowMs);
    const previousTickets = completed.filter((ticket) => {
      const timestamp = new Date(ticket.createdAt).getTime();
      return timestamp >= now - 2 * windowMs && timestamp < now - windowMs;
    });
    const settledShipments = shipments.filter(
      (shipment) => shipment.settlement && new Date(shipment.settlement.settledAt).getTime() >= now - windowMs,
    );
    const derived = deriveOperationsMetrics({ tickets: activeTickets, shipments: settledShipments, vehicles, openQueueCount: 0, delayedTaskCount: 0 });
    return {
      active: activeTickets,
      previousActive: previousTickets,
      settled: settledShipments,
      metrics: derived,
      windowLabel: days === 1 ? 'today' : days === 365 ? 'this year' : `last ${days} days`,
    };
  }, [tickets, shipments, vehicles, days]);

  const trend = useMemo(() => {
    const points = Math.min(days, 30);
    return Array.from({ length: points }, (_, index) => {
      const date = new Date(Date.now() - (points - 1 - index) * 86400000).toDateString();
      return {
        day: index === points - 1 ? 'Today' : new Date(date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }),
        payout: active.filter((ticket) => new Date(ticket.createdAt).toDateString() === date).reduce((total, ticket) => total + ticket.finalPayout, 0),
        revenue: settled.filter((shipment) => new Date(shipment.settlement!.settledAt).toDateString() === date).reduce((total, shipment) => total + shipment.settlement!.amountPaid, 0),
      };
    });
  }, [active, settled, days]);

  const cats = useMemo(() => (
    Object.entries(
      active
        .flatMap((ticket) => ticket.scrapLines || [])
        .reduce<Record<string, number>>((result, line) => ({ ...result, [line.metalCategory]: (result[line.metalCategory] || 0) + line.lineTotal }), {}),
    ).map(([name, value]) => ({ name, value }))
  ), [active]);

  // Material profitability — payout and $/lb per grade, ranked by total payout.
  const materialRates = useMemo(() => {
    const map = new Map<string, { name: string; category: string; lbs: number; payout: number }>();
    active.flatMap((ticket) => ticket.scrapLines || []).forEach((line) => {
      const entry = map.get(line.metalName) ?? { name: line.metalName, category: line.metalCategory, lbs: 0, payout: 0 };
      entry.lbs += line.billableWeight;
      entry.payout += line.lineTotal;
      map.set(line.metalName, entry);
    });
    return [...map.values()]
      .map((entry) => ({ ...entry, perLb: entry.lbs > 0 ? entry.payout / entry.lbs : 0 }))
      .sort((a, b) => b.payout - a.payout);
  }, [active]);

  // Top sellers leaderboard — relationship value at a glance.
  const sellers = useMemo(() => {
    const map = new Map<string, { name: string; tickets: number; lbs: number; payout: number; last: string }>();
    active.forEach((ticket) => {
      const name = ticket.customerName || 'Unknown seller';
      const entry = map.get(name) ?? { name, tickets: 0, lbs: 0, payout: 0, last: ticket.createdAt };
      entry.tickets += 1;
      entry.lbs += ticketWeight(ticket);
      entry.payout += ticket.finalPayout;
      if (ticket.createdAt > entry.last) entry.last = ticket.createdAt;
      map.set(name, entry);
    });
    return [...map.values()].sort((a, b) => b.payout - a.payout).slice(0, 15);
  }, [active]);

  const scaleReadings = useMemo(() => {
    const byName = new Map<string, { name: string; scaleIn: number; scaleOut: number }>();
    active.forEach((ticket) => (ticket.weightTransactions || []).forEach((tx) => {
      const name = tx.scaleName || 'Unstamped';
      const entry = byName.get(name) ?? { name, scaleIn: 0, scaleOut: 0 };
      if (tx.type === 'SCALE_IN') entry.scaleIn += 1; else entry.scaleOut += 1;
      byName.set(name, entry);
    }));
    return [...byName.values()].sort((a, b) => (b.scaleIn + b.scaleOut) - (a.scaleIn + a.scaleOut));
  }, [active]);

  const scaleTraffic = useMemo(() => {
    const windowMs = days * 86400000;
    const events = scaleEvents.filter((event) => new Date(event.detectedAt).getTime() >= Date.now() - windowMs);
    const points = Math.min(days, 30);
    return Array.from({ length: points }, (_, index) => {
      const date = new Date(Date.now() - (points - 1 - index) * 86400000).toDateString();
      const dayEvents = events.filter((event) => new Date(event.detectedAt).toDateString() === date);
      return {
        day: index === points - 1 ? 'Today' : new Date(date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }),
        onLbs: dayEvents.filter((e) => e.direction === 'ADDED').reduce((total, e) => total + e.deltaLbs, 0),
        offLbs: dayEvents.filter((e) => e.direction === 'REMOVED').reduce((total, e) => total + e.deltaLbs, 0),
      };
    });
  }, [scaleEvents, days]);

  const totalLbsOn = scaleTraffic.reduce((total, day) => total + day.onLbs, 0);
  const previousPayout = previousActive.reduce((total, ticket) => total + ticket.finalPayout, 0);
  const currentPayout = active.reduce((total, ticket) => total + ticket.finalPayout, 0);
  const totalLbs = active.reduce((total, ticket) => total + ticketWeight(ticket), 0);

  const kpis = [
    { label: 'Tickets', value: String(metrics.completedTickets), icon: Receipt, delta: deltaPct(active.length, previousActive.length) },
    { label: 'Payouts', value: money(currentPayout), icon: Wallet, delta: deltaPct(currentPayout, previousPayout) },
    { label: 'Revenue', value: money(metrics.shipmentRevenue), icon: TrendingUp, delta: undefined },
    { label: 'Gross margin', value: money(metrics.grossMargin), icon: Activity, delta: undefined },
    { label: 'Lbs in', value: totalLbs.toLocaleString(), icon: Scale, delta: undefined },
    { label: 'Vehicles', value: String(metrics.vehiclesProcessed), icon: CarFront, delta: undefined },
  ];

  const handleSummaryCsv = () => {
    downloadCsv(`Mahaffeys_Summary_${new Date().toISOString().slice(0, 10)}.csv`, [
      { Metric: 'Period', Value: windowLabel },
      { Metric: 'Completed tickets', Value: metrics.completedTickets },
      { Metric: 'Payouts', Value: currentPayout.toFixed(2) },
      { Metric: 'Shipment revenue', Value: metrics.shipmentRevenue.toFixed(2) },
      { Metric: 'Gross margin', Value: metrics.grossMargin.toFixed(2) },
      { Metric: 'Total lbs in', Value: Math.round(totalLbs) },
      { Metric: 'Vehicles processed', Value: metrics.vehiclesProcessed },
      ...sellers.map((seller, index) => ({ Metric: `Top seller #${index + 1}`, Value: `${seller.name} — ${seller.payout.toFixed(2)} USD across ${seller.tickets} tickets` })),
    ]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <main className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-xs tracking-widest text-emerald-400">BUSINESS INTELLIGENCE</p>
            <h1 className="text-2xl font-black sm:text-3xl">Reports &amp; analytics</h1>
            <p className="text-sm text-slate-400">Live shared metrics for management reporting.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/operations">
              <Button className="bg-emerald-600 hover:bg-emerald-500 text-xs sm:text-sm"><Activity className="w-4 h-4 mr-2" />Operations</Button>
            </Link>
            <select value={range} onChange={(event) => setRange(event.target.value)} aria-label="Report date range" className="h-9 rounded-xl bg-slate-900 border border-slate-700 px-3 text-sm text-slate-200">
              <option value="1">Today</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="365">YTD</option>
            </select>
            <Button onClick={handleSummaryCsv} variant="outline" className="border-slate-700 text-xs sm:text-sm"><Download className="w-4 h-4 mr-2" />Summary</Button>
            <Button onClick={() => setCustomReportOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-xs sm:text-sm">
              <FileText className="w-4 h-4 mr-2" />Custom Report
            </Button>
            <Button onClick={() => window.print()} variant="outline" className="border-slate-700" aria-label="Print reports"><Printer className="w-4 h-4" /></Button>
          </div>
        </section>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpis.map(({ label, value, icon: Icon, delta }) => (
            <Card key={label} className="bg-slate-900 border-slate-800 rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-400">{label}</p>
                  <Icon className="h-3.5 w-3.5 text-emerald-400/70" />
                </div>
                <p className="font-mono font-black text-base sm:text-lg mt-2 break-all">{value}</p>
                {delta !== undefined && (
                  <p className={`mt-1 flex items-center gap-1 text-[10px] font-bold ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(delta)}% vs prior
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="bg-slate-900 h-auto flex-wrap gap-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="materials">Material mix</TabsTrigger>
            <TabsTrigger value="sellers">Top sellers</TabsTrigger>
            <TabsTrigger value="scales">Scale traffic</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="grid gap-5 mt-5 lg:grid-cols-2">
            <Card className="bg-slate-900 border-slate-800 rounded-2xl">
              <CardHeader><CardTitle className="text-sm sm:text-base">Daily payout vs revenue</CardTitle></CardHeader>
              <CardContent className="h-56 sm:h-72">
                <ResponsiveContainer>
                  <AreaChart data={trend}>
                    <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip />
                    <Area dataKey="payout" stroke="#fbbf24" fill="#fbbf2422" />
                    <Area dataKey="revenue" stroke="#34d399" fill="#34d39922" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800 rounded-2xl">
              <CardHeader><CardTitle className="text-sm sm:text-base">Ticket volume by type</CardTitle></CardHeader>
              <CardContent className="h-56 sm:h-72">
                <ResponsiveContainer>
                  <BarChart data={['CAR_SALVAGE', 'SCRAP_METAL', 'MOBILE_SCRAP'].map((type) => ({ type: type.replace('_', ' '), count: active.filter((ticket) => ticket.ticketType === type).length }))}>
                    <XAxis dataKey="type" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Bar dataKey="count" fill="#34d399" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="materials" className="grid gap-5 mt-5 lg:grid-cols-2">
            <Card className="bg-slate-900 border-slate-800 rounded-2xl">
              <CardHeader className="flex-row justify-between">
                <CardTitle className="text-sm sm:text-base">Payout mix by material</CardTitle>
                <Button onClick={() => downloadCsv('material-summary.csv', cats.map((item) => ({ Material: item.name, Payout: item.value.toFixed(2) })))} className="bg-emerald-600 h-8 text-xs">
                  <Download className="w-3.5 h-3.5 mr-1.5" />CSV
                </Button>
              </CardHeader>
              <CardContent className="h-56 sm:h-72">
                {cats.length ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={cats} dataKey="value" nameKey="name" innerRadius={55} outerRadius={92}>
                        {cats.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <Empty />}
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800 rounded-2xl">
              <CardHeader className="flex-row justify-between">
                <CardTitle className="text-sm sm:text-base">Grade profitability ($ / lb)</CardTitle>
                <Button
                  onClick={() => downloadCsv('material-profitability.csv', materialRates.map((row) => ({ Grade: row.name, Category: row.category, 'Billable lb': Math.round(row.lbs), Payout: row.payout.toFixed(2), 'USD per lb': row.perLb.toFixed(3) })))}
                  disabled={materialRates.length === 0}
                  className="bg-emerald-600 h-8 text-xs"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />CSV
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {materialRates.length ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-950/80">
                        <TableRow className="border-slate-800 hover:bg-slate-950 text-xs">
                          <TableHead className="text-slate-400">Grade</TableHead>
                          <TableHead className="text-right text-slate-400">Billable lb</TableHead>
                          <TableHead className="text-right text-slate-400">Payout</TableHead>
                          <TableHead className="text-right text-slate-400">$ / lb</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {materialRates.map((row) => (
                          <TableRow key={row.name} className="border-slate-800 text-xs font-mono hover:bg-slate-800/40">
                            <TableCell className="font-sans font-semibold text-white">
                              {row.name}
                              <span className="block text-[10px] font-normal text-slate-500">{row.category}</span>
                            </TableCell>
                            <TableCell className="text-right text-slate-300">{Math.round(row.lbs).toLocaleString()}</TableCell>
                            <TableCell className="text-right text-amber-400">{money(row.payout)}</TableCell>
                            <TableCell className="text-right font-bold text-emerald-400">${row.perLb.toFixed(3)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : <Empty text="Grade profitability appears once scrap tickets are recorded." />}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sellers" className="mt-5">
            <Card className="bg-slate-900 border-slate-800 rounded-2xl">
              <CardHeader className="flex-row justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base"><Users className="w-4 h-4 text-emerald-400" />Top sellers — {windowLabel}</CardTitle>
                  <p className="text-xs text-slate-400 mt-1">Ranked by total payout. Compare against the prior period on the cards above.</p>
                </div>
                <Button
                  onClick={() => downloadCsv('top-sellers.csv', sellers.map((seller, index) => ({ Rank: index + 1, Seller: seller.name, Tickets: seller.tickets, 'Total lb': Math.round(seller.lbs), 'Payout USD': seller.payout.toFixed(2), 'Last visit': new Date(seller.last).toLocaleString() })))}
                  disabled={sellers.length === 0}
                  className="bg-emerald-600 h-8 text-xs"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />CSV
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {sellers.length ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-950/80">
                        <TableRow className="border-slate-800 hover:bg-slate-950 text-xs">
                          <TableHead className="text-slate-400 w-10">#</TableHead>
                          <TableHead className="text-slate-400">Seller</TableHead>
                          <TableHead className="text-right text-slate-400">Tickets</TableHead>
                          <TableHead className="text-right text-slate-400">Total lb</TableHead>
                          <TableHead className="text-right text-slate-400">Payout</TableHead>
                          <TableHead className="text-right text-slate-400">Last visit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sellers.map((seller, index) => (
                          <TableRow key={seller.name} className="border-slate-800 text-xs font-mono hover:bg-slate-800/40">
                            <TableCell className={index === 0 ? 'font-black text-amber-400' : 'text-slate-500'}>{index + 1}</TableCell>
                            <TableCell className="font-sans font-semibold text-white">{seller.name}</TableCell>
                            <TableCell className="text-right text-slate-300">{seller.tickets}</TableCell>
                            <TableCell className="text-right text-slate-300">{Math.round(seller.lbs).toLocaleString()}</TableCell>
                            <TableCell className="text-right font-bold text-emerald-400">{money(seller.payout)}</TableCell>
                            <TableCell className="text-right text-slate-400">{new Date(seller.last).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : <Empty text="Seller leaderboards appear once completed tickets exist in this range." />}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scales" className="grid gap-5 mt-5 lg:grid-cols-2">
            <Card className="bg-slate-900 border-slate-800 rounded-2xl">
              <CardHeader className="flex-row justify-between">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base"><Scale className="w-4 h-4 text-emerald-400" />Readings by platform</CardTitle>
                <Button
                  onClick={() => downloadCsv('scale-readings.csv', scaleReadings.map((row) => ({ Platform: row.name, 'SCALE_IN readings': row.scaleIn, 'SCALE_OUT readings': row.scaleOut })))}
                  disabled={scaleReadings.length === 0}
                  className="bg-emerald-600 h-8 text-xs"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />CSV
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {scaleReadings.length ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-950/80">
                        <TableRow className="border-slate-800 hover:bg-slate-950 text-xs">
                          <TableHead className="text-slate-400">Platform</TableHead>
                          <TableHead className="text-right text-slate-400">SCALE_IN</TableHead>
                          <TableHead className="text-right text-slate-400">SCALE_OUT</TableHead>
                          <TableHead className="text-right text-slate-400">Total readings</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scaleReadings.map((row) => (
                          <TableRow key={row.name} className="border-slate-800 text-xs font-mono hover:bg-slate-800/40">
                            <TableCell className="font-sans font-semibold text-white">{row.name}</TableCell>
                            <TableCell className="text-right text-emerald-400">{row.scaleIn}</TableCell>
                            <TableCell className="text-right text-amber-400">{row.scaleOut}</TableCell>
                            <TableCell className="text-right font-bold text-white">{row.scaleIn + row.scaleOut}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : <Empty text="Stamped readings appear once weighings record a platform name." />}
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800 rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base"><Scale className="w-4 h-4 text-amber-400" />LBS crossed the platform</CardTitle>
                <p className="text-xs text-slate-400">{totalLbsOn.toLocaleString()} LBS ON across all platforms in this range</p>
              </CardHeader>
              <CardContent className="h-56 sm:h-72">
                <ResponsiveContainer>
                  <BarChart data={scaleTraffic}>
                    <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="onLbs" name="LBS ON" stackId="traffic" fill="#34d399" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="offLbs" name="LBS OFF" stackId="traffic" fill="#fbbf24" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <CustomReportModal open={customReportOpen} onOpenChange={setCustomReportOpen} />
    </div>
  );
}

function Empty({ text }: { text?: string }) {
  return (
    <div className="h-full flex items-center justify-center text-slate-500 text-sm px-6 py-10 text-center">
      <TrendingUp className="w-5 h-5 mr-2 shrink-0" />
      {text ?? 'Data will appear as transactions are recorded.'}
    </div>
  );
}
