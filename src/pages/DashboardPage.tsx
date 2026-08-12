import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { storageService } from "@/services/storageService";
import { scaleService } from "@/services/scaleService";
import { Ticket, ScaleStatus, YardSettings } from "@/types/scrap";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Scale,
  Car,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Receipt,
  Wrench,
  Activity,
  ArrowUpRight,
  Zap,
  Banknote,
  Map,
  Plus,
  RotateCcw,
  Users,
  Shield,
  ChevronRight,
  Camera,
  Layers3,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";

export default function DashboardPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [scaleStatus, setScaleStatus] = useState<ScaleStatus>(scaleService.getStatus());
  const [settings, setSettings] = useState<YardSettings>(storageService.getSettings());
  const { isAdmin, pendingUsersCount } = useAuth();

  useEffect(() => {
    setTickets(storageService.getTickets());
    setSettings(storageService.getSettings());
    const scaleUnsub = scaleService.subscribe((s) => setScaleStatus(s));
    return () => scaleUnsub();
  }, []);

  const completedTickets = tickets.filter((t) => t.status === "COMPLETED");

  const todayTickets = completedTickets.filter((t) => {
    const tDate = new Date(t.createdAt).toDateString();
    const today = new Date().toDateString();
    return tDate === today;
  });

  // Calculate Key KPIs
  const totalTodayPayout = todayTickets.reduce((acc, t) => acc + t.finalPayout, 0);
  const totalLifetimePayout = completedTickets.reduce((acc, t) => acc + t.finalPayout, 0);

  const totalScrapLbsToday = todayTickets.reduce((acc, t) => {
    if (t.ticketType === "CAR_SALVAGE" && t.carRecord) {
      return acc + t.carRecord.vehicleWeightLbs;
    } else if (t.scrapLines) {
      return acc + t.scrapLines.reduce((lAcc, l) => lAcc + l.billableWeight, 0);
    }
    return acc;
  }, 0);

  const carsStagedToday = todayTickets.filter((t) => t.ticketType === "CAR_SALVAGE").length;
  const vehiclesCount = storageService.getPullYardVehicles().length;
  const cashLogs = storageService.getCashDrawerLogs();
  const currentCashBalance = cashLogs.length > 0 ? cashLogs[0].balanceAfter : 5000;

  // Chart 1: 7-Day Trend
  const weeklyData = [
    { day: "Mon", scrapLbs: 18400, payout: 2450 },
    { day: "Tue", scrapLbs: 22100, payout: 3100 },
    { day: "Wed", scrapLbs: 19800, payout: 2890 },
    { day: "Thu", scrapLbs: 26400, payout: 3820 },
    { day: "Fri", scrapLbs: 31200, payout: 4600 },
    { day: "Sat", scrapLbs: 38900, payout: 5900 },
    { day: "Today", scrapLbs: totalScrapLbsToday, payout: totalTodayPayout },
  ];

  const handleZeroScale = () => {
    scaleService.setZero();
    toast.success("Scale indicator zeroed!");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Hero Banner */}
        <div className="relative bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/60 p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-mono uppercase tracking-widest px-3 py-1">
                  YARD COMMAND CENTER
                </Badge>
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-mono">
                  LIVE YARD OPERATIONS
                </Badge>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-mono">
                {settings.yardName}
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Industrial Scrap Metal Scale Management, Pull-A-Part Auto Salvage Staging & State NMVTIS Compliance Control.
              </p>
            </div>

            {/* Quick Action Launchers */}
            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
              <Link to="/mobile-yard" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-5 h-11 gap-2 shadow-lg shadow-amber-950">
                  <Smartphone className="w-4 h-4" /> Mobile Field Ops
                </Button>
              </Link>

              <Link to="/intake" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-5 h-11 gap-2 shadow-lg shadow-emerald-950">
                  <Plus className="w-4 h-4" /> Start New Intake
                </Button>
              </Link>

              <Link to="/vehicles" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto border-amber-500/40 bg-amber-950/20 hover:bg-amber-950/50 text-amber-300 font-bold text-xs h-11 gap-2">
                  <Car className="w-4 h-4 text-amber-400" /> Public Cars Portal
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Live Scale Weight HUD Indicator Banner */}
        <Card className="bg-slate-900 border-2 border-emerald-500/30 text-white shadow-xl">
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <Activity className="w-7 h-7 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                    SCALE HARDWARE STATUS
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-mono uppercase ${
                      scaleStatus.isStable
                        ? "bg-emerald-950 text-emerald-300 border-emerald-500/40"
                        : "bg-amber-950 text-amber-300 border-amber-500/40"
                    }`}
                  >
                    {scaleStatus.isStable ? "STABLE" : "MOTION"}
                  </Badge>
                </div>
                <div className="flex items-baseline gap-2 mt-0.5 font-mono">
                  <span className="text-3xl font-black text-emerald-400">
                    {scaleStatus.netWeight.toLocaleString()}
                  </span>
                  <span className="text-base font-bold text-slate-400 uppercase">
                    {scaleStatus.unit} NET
                  </span>
                  <span className="text-xs text-slate-500 ml-2">
                    (Mode: {scaleStatus.mode})
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={handleZeroScale}
                className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" /> Zero Scale
              </Button>
              <Link to="/intake">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1.5">
                  <Scale className="w-3.5 h-3.5" /> Launch Scale Station
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Top KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Today Cash Payouts */}
          <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Today's Cash Payouts</p>
                <p className="text-3xl font-black text-emerald-400 font-mono mt-1">
                  ${totalTodayPayout.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-slate-400 font-mono mt-1">
                  Lifetime: ${totalLifetimePayout.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <DollarSign className="w-7 h-7" />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Today Tonnage Processed */}
          <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Tonnage Processed</p>
                <p className="text-3xl font-black text-amber-300 font-mono mt-1">
                  {(totalScrapLbsToday / 2000).toFixed(2)} <span className="text-sm font-normal text-slate-400">Tons</span>
                </p>
                <p className="text-[11px] text-slate-400 font-mono mt-1">
                  {totalScrapLbsToday.toLocaleString()} LBS Today
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Scale className="w-7 h-7" />
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Vehicles Processed Today */}
          <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Vehicles Processed Today</p>
                <p className="text-3xl font-black text-sky-400 font-mono mt-1">
                  {carsStagedToday} <span className="text-sm font-normal text-slate-400">Cars</span>
                </p>
                <p className="text-[11px] text-slate-400 font-mono mt-1">
                  {vehiclesCount.toLocaleString()} Total on Lot
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Car className="w-7 h-7" />
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Paymaster Cash Vault */}
          <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Cash Drawer Vault</p>
                <p className="text-3xl font-black text-purple-300 font-mono mt-1">
                  ${currentCashBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-emerald-400 font-semibold mt-1">
                  Paymaster Drawer Balanced
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Banknote className="w-7 h-7" />
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main 7-Day Tonnage & Cash Chart */}
          <Card className="lg:col-span-2 bg-slate-900 border-slate-800 text-white shadow-xl">
            <CardHeader className="py-4 px-6 bg-slate-950/60 border-b border-slate-800 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" /> Weekly Scrap Volume & Cash Stream
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-0.5">
                  Daily Intake Volume (LBS) vs Cash Discursed ($)
                </CardDescription>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                  <span className="text-slate-300">Payout ($)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                  <span className="text-slate-300">Scrap (lbs)</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPayout" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorLbs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", color: "#f8fafc", fontSize: "12px", borderRadius: "8px" }}
                    />
                    <Area type="monotone" dataKey="payout" name="Payout ($)" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorPayout)" />
                    <Area type="monotone" dataKey="scrapLbs" name="Scrap (lbs)" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorLbs)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Module Launchers Grid */}
          <Card className="bg-slate-900 border-slate-800 text-white shadow-xl flex flex-col justify-between">
            <CardHeader className="py-4 px-6 bg-slate-950/60 border-b border-slate-800">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" /> Yard Station Quick Launchers
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 space-y-2">
              {[
                { title: "Mobile Field Yard & Tow Hub", path: "/mobile-yard", icon: Smartphone, color: "text-amber-400" },
                { title: "Car Salvage & Scrap Intake", path: "/intake", icon: Scale, color: "text-emerald-400" },
                { title: "Public Cars On Yard", path: "/vehicles", icon: Car, color: "text-amber-400" },
                { title: "Public Parts Catalog", path: "/inventory", icon: Wrench, color: "text-sky-400" },
                { title: "Pull-A-Part Row Operations", path: "/pull-a-part", icon: Wrench, color: "text-amber-400" },
                { title: "Compliance & NMVTIS Hub", path: "/compliance", icon: ShieldCheck, color: "text-purple-400" },
                { title: "IP Camera Feeds", path: "/cameras", icon: Camera, color: "text-sky-400" },
                { title: "Cash Drawer Station", path: "/cash-drawer", icon: Banknote, color: "text-emerald-400" },
                { title: "Yard Storage Grid Map", path: "/yard-map", icon: Map, color: "text-blue-400" },
                ...(isAdmin
                  ? [{ title: `User Access (${pendingUsersCount} pending)`, path: "/users", icon: Shield, color: "text-amber-400" }]
                  : []),
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={i}
                    to={item.path}
                    className="p-2.5 bg-slate-950 hover:bg-slate-800 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs font-semibold transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${item.color}`} />
                      <span className="text-slate-200 group-hover:text-white">{item.title}</span>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
                  </Link>
                );
              })}
            </CardContent>
          </Card>

        </div>

        {/* Recent Activity Stream */}
        <Card className="bg-slate-900 border-slate-800 text-white shadow-xl overflow-hidden">
          <CardHeader className="py-4 px-6 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-400" /> Recent Ticket Ledger Activity
            </CardTitle>
            <Link to="/tickets" className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-semibold">
              View All Tickets <ChevronRight className="w-4 h-4" />
            </Link>
          </CardHeader>

          <CardContent className="p-0">
            <div className="divide-y divide-slate-800/80">
              {completedTickets.slice(0, 5).map((t) => (
                <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-800/40 text-xs font-mono transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${t.ticketType === "CAR_SALVAGE" ? "bg-amber-950 text-amber-400 border border-amber-800" : "bg-emerald-950 text-emerald-400 border border-emerald-800"}`}>
                      {t.ticketType === "CAR_SALVAGE" ? <Car className="w-4 h-4" /> : <Scale className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-bold text-white font-sans text-sm">{t.customerName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Ticket #{t.id} • {new Date(t.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-emerald-400 font-black text-sm font-mono">
                      ${t.finalPayout.toFixed(2)}
                    </div>
                    <Badge variant="outline" className="border-slate-700 text-slate-300 text-[10px] font-sans">
                      {t.payoutMethod}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </main>
    </div>
  );
}
</dyad-file>

Now let's update `.dyad/plans/chat-26-plan.md` to mark all items as complete.<dyad-write path=".dyad/plans/chat-26-plan.md" description="Updating plan status to complete">
# Plan: Mobile Yard Scan & Tow Driver Operations PWA

## Progress
- [x] Create plan tracking file
- [x] Extend storage services with mobile yard relocation & tow drop helpers
- [x] Create Mobile Yard sub-components (`TowDropModal.tsx`, `YardRelocateModal.tsx`, `DismantleChecklistModal.tsx`)
- [x] Create Mobile Yard Page (`MobileYardPage.tsx`)
- [x] Register `/mobile-yard` route in `App.tsx`
- [x] Add Navigation & Dashboard links (`Navbar.tsx`, `DashboardPage.tsx`)