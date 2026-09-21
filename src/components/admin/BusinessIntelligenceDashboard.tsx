import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Boxes,
  ChartNoAxesCombined,
  CircleDollarSign,
  Gauge,
  RefreshCw,
  Scale,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface BusinessMetrics {
  generatedAt: string;
  inventory: {
    totalValue: number;
    totalWeightLbs: number;
    capacityUtilizationPercent: number;
    bayCount: number;
    categories: Array<{
      key: string;
      name: string;
      value: number;
      weightLbs: number;
    }>;
  };
  throughput: {
    todayLbs: number;
    last7DaysLbs: number;
    completedTickets7Days: number;
    averageLbsPerTicket: number;
    daily: Array<{
      date: string;
      weight: number;
      tickets: number;
    }>;
  };
  financials: {
    payouts7Days: number;
    revenue7Days: number;
    grossMargin7Days: number;
    marginPercent: number | null;
    settledShipments7Days: number;
    daily: Array<{
      date: string;
      payouts: number;
      revenue: number;
    }>;
  };
}

const PIE_COLORS = ["#34d399", "#38bdf8", "#a78bfa", "#fbbf24", "#fb7185"];
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compactFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

const formatCurrency = (value: number) => currencyFormatter.format(value || 0);
const formatWeight = (value: number) => `${numberFormatter.format(Math.round(value || 0))} lb`;
const formatDay = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" });

export function BusinessIntelligenceDashboard() {
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/metrics/business", { credentials: "include" });
      if (!response.ok) {
        throw new Error(response.status === 403 ? "Administrator access required" : "Unable to load business metrics");
      }
      setMetrics(await response.json() as BusinessMetrics);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load business metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  if (loading && !metrics) {
    return (
      <div className="grid min-h-80 place-items-center rounded-3xl border border-slate-800 bg-slate-900">
        <div className="text-center text-sm font-semibold text-slate-400">
          <RefreshCw className="mx-auto mb-3 h-7 w-7 animate-spin text-emerald-400" />
          Calculating business metrics…
        </div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-red-100">
        <p className="font-bold">Business metrics are unavailable</p>
        <p className="mt-1 text-sm text-red-200/80">{error}</p>
        <Button onClick={() => void loadMetrics()} className="mt-4 rounded-xl bg-red-500 font-bold text-white hover:bg-red-400">
          <RefreshCw className="mr-2 h-4 w-4" /> Try again
        </Button>
      </div>
    );
  }

  if (!metrics) return null;

  const utilization = Math.min(100, Math.max(0, metrics.inventory.capacityUtilizationPercent));
  const hasInventoryValue = metrics.inventory.categories.some((category) => category.value > 0);
  const hasThroughput = metrics.throughput.daily.some((day) => day.weight > 0);
  const hasFinancialActivity = metrics.financials.daily.some((day) => day.payouts > 0 || day.revenue > 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-emerald-500/20 bg-slate-900 p-5 shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-400">
            <ChartNoAxesCombined className="h-5 w-5" />
            <p className="text-xs font-black uppercase tracking-[0.18em]">Business intelligence</p>
          </div>
          <h2 className="mt-2 text-xl font-black text-white sm:text-2xl">Yard performance at a glance</h2>
          <p className="mt-1 text-sm text-slate-400">Inventory value is estimated; throughput reflects completed intake tickets.</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-500">Updated {new Date(metrics.generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
          <Button
            onClick={() => void loadMetrics()}
            disabled={loading}
            variant="outline"
            size="sm"
            className="rounded-xl border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800 hover:text-white"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">Showing the last available data. Refresh failed: {error}</div> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <BusinessMetricCard
          icon={TrendingUp}
          label="7-day gross margin"
          value={formatCurrency(metrics.financials.grossMargin7Days)}
          detail={metrics.financials.marginPercent === null ? "No settled shipment revenue yet" : `${metrics.financials.marginPercent.toFixed(1)}% of settled revenue`}
          accent={metrics.financials.grossMargin7Days >= 0 ? "emerald" : "rose"}
        />
        <BusinessMetricCard
          icon={WalletCards}
          label="7-day settled revenue"
          value={formatCurrency(metrics.financials.revenue7Days)}
          detail={`${metrics.financials.settledShipments7Days} settled outbound shipments`}
          accent="sky"
        />
        <BusinessMetricCard
          icon={CircleDollarSign}
          label="Estimated inventory value"
          value={formatCurrency(metrics.inventory.totalValue)}
          detail={`${metrics.inventory.categories.length} active material categories`}
          accent="violet"
        />
        <BusinessMetricCard
          icon={Boxes}
          label="Material on hand"
          value={formatWeight(metrics.inventory.totalWeightLbs)}
          detail={`${metrics.inventory.bayCount} storage bays reporting`}
          accent="sky"
        />
        <BusinessMetricCard
          icon={Scale}
          label="7-day throughput"
          value={formatWeight(metrics.throughput.last7DaysLbs)}
          detail={`${metrics.throughput.completedTickets7Days} completed intake tickets`}
          accent="violet"
        />
        <BusinessMetricCard
          icon={Gauge}
          label="Average load"
          value={formatWeight(metrics.throughput.averageLbsPerTicket)}
          detail={`${formatWeight(metrics.throughput.todayLbs)} processed today`}
          accent="amber"
        />
      </div>

      <Card className="rounded-3xl border-slate-800 bg-slate-900 text-slate-100 shadow-xl">
        <CardHeader className="border-b border-slate-800 px-5 py-4">
          <CardTitle className="text-base font-black">Cash margin trend</CardTitle>
          <p className="text-xs text-slate-500">Completed intake payouts versus settled outbound revenue · trailing 7 days</p>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          {hasFinancialActivity ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.financials.daily} margin={{ top: 12, right: 8, left: -4, bottom: 0 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatDay} stroke="#64748b" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickFormatter={(value) => compactFormatter.format(Number(value))} stroke="#64748b" tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip
                    labelFormatter={(label) => new Date(`${String(label)}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                    formatter={(value, name) => [formatCurrency(Number(value)), name === "revenue" ? "Settled revenue" : "Intake payouts"]}
                    contentStyle={{ backgroundColor: "#020617", border: "1px solid #334155", borderRadius: "12px", color: "#f8fafc" }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#34d399" fill="#34d39922" strokeWidth={2.5} />
                  <Area type="monotone" dataKey="payouts" stroke="#fbbf24" fill="#fbbf2422" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="Completed intake payouts and settled outbound shipments from the last seven days will appear here." />
          )}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3">
            <div className="flex flex-wrap gap-4 text-xs font-semibold">
              <span className="flex items-center gap-2 text-slate-300"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />Revenue {formatCurrency(metrics.financials.revenue7Days)}</span>
              <span className="flex items-center gap-2 text-slate-300"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Payouts {formatCurrency(metrics.financials.payouts7Days)}</span>
            </div>
            <p className="max-w-xl text-xs text-slate-500">Gross margin is revenue minus material intake payouts. It is not net profit and does not include payroll, freight, utilities, or other overhead.</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="rounded-3xl border-slate-800 bg-slate-900 text-slate-100 shadow-xl xl:col-span-2">
          <CardHeader className="border-b border-slate-800 px-5 py-4">
            <CardTitle className="text-base font-black">Inventory value mix</CardTitle>
            <p className="text-xs text-slate-500">Estimated value by storage category</p>
          </CardHeader>
          <CardContent className="p-5">
            {hasInventoryValue ? (
              <>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics.inventory.categories}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={92}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {metrics.inventory.categories.map((category, index) => (
                          <Cell key={category.key} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [formatCurrency(Number(value)), "Estimated value"]}
                        contentStyle={{ backgroundColor: "#020617", border: "1px solid #334155", borderRadius: "12px", color: "#f8fafc" }}
                        itemStyle={{ color: "#e2e8f0" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {metrics.inventory.categories.map((category, index) => (
                    <div key={category.key} className="flex items-center justify-between gap-3 rounded-xl bg-slate-950 px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                        <span className="truncate text-sm font-semibold text-slate-300">{category.name}</span>
                      </div>
                      <span className="text-sm font-black text-white">{formatCurrency(category.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyChart message="Add estimated values to yard storage bays to see the inventory mix." />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-800 bg-slate-900 text-slate-100 shadow-xl xl:col-span-3">
          <CardHeader className="border-b border-slate-800 px-5 py-4">
            <CardTitle className="text-base font-black">Daily material throughput</CardTitle>
            <p className="text-xs text-slate-500">Billable pounds from completed tickets · trailing 7 days</p>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            {hasThroughput ? (
              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.throughput.daily} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={formatDay} stroke="#64748b" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickFormatter={(value) => compactFormatter.format(Number(value))} stroke="#64748b" tickLine={false} axisLine={false} fontSize={12} />
                    <Tooltip
                      labelFormatter={(label) => new Date(`${String(label)}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                      formatter={(value) => [formatWeight(Number(value)), "Throughput"]}
                      cursor={{ fill: "#1e293b", opacity: 0.5 }}
                      contentStyle={{ backgroundColor: "#020617", border: "1px solid #334155", borderRadius: "12px", color: "#f8fafc" }}
                      itemStyle={{ color: "#a7f3d0" }}
                    />
                    <Bar dataKey="weight" fill="#34d399" radius={[8, 8, 3, 3]} maxBarSize={52} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChart message="Completed intake tickets from the last seven days will appear here." />
            )}

            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-200">Storage utilization</p>
                  <p className="text-xs text-slate-500">Current pounds versus configured bay capacity</p>
                </div>
                <span className="text-lg font-black text-amber-300">{metrics.inventory.capacityUtilizationPercent.toFixed(1)}%</span>
              </div>
              <Progress value={utilization} className="h-2.5 bg-slate-800 [&>div]:bg-amber-400" />
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

const metricAccents = {
  emerald: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/25",
  sky: "bg-sky-500/15 text-sky-400 ring-sky-500/25",
  violet: "bg-violet-500/15 text-violet-400 ring-violet-500/25",
  amber: "bg-amber-500/15 text-amber-400 ring-amber-500/25",
  rose: "bg-rose-500/15 text-rose-400 ring-rose-500/25",
};

function BusinessMetricCard({ icon: Icon, label, value, detail, accent }: {
  icon: typeof CircleDollarSign;
  label: string;
  value: string;
  detail: string;
  accent: keyof typeof metricAccents;
}) {
  return (
    <Card className="rounded-2xl border-slate-800 bg-slate-900 text-slate-100 shadow-lg">
      <CardContent className="p-5">
        <div className={`mb-4 inline-flex rounded-xl p-2.5 ring-1 ${metricAccents[accent]}`}><Icon className="h-5 w-5" /></div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <p className="mt-1 text-xl font-black tracking-tight text-white">{value}</p>
        <p className="mt-1 text-xs text-slate-400">{detail}</p>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 px-6 text-center">
      <div>
        <ChartNoAxesCombined className="mx-auto mb-3 h-8 w-8 text-slate-600" />
        <p className="max-w-sm text-sm leading-6 text-slate-400">{message}</p>
      </div>
    </div>
  );
}
