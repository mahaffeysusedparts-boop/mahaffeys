"use client";

import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ScaleStatus, YardSettings } from '@/types/scrap';
import { scaleService } from '@/services/scaleService';
import { storageService } from '@/services/storageService';
import { useAuth } from '@/context/AuthContext';
import { ScaleConfigModal } from '../scale/ScaleConfigModal';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Scale,
  Car,
  Receipt,
  DollarSign,
  Users,
  Settings,
  ShieldCheck,
  Activity,
  Truck,
  Banknote,
  Map,
  Wrench,
  Server,
  Menu,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  UserCheck,
  Bell,
  Lock,
  Shield,
  Camera,
  Smartphone,
  Sparkles,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, pendingUsersCount, logout } = useAuth();
  const [scaleStatus, setScaleStatus] = useState<ScaleStatus>(scaleService.getStatus());
  const [settings] = useState<YardSettings>(storageService.getSettings());
  const [configOpen, setConfigOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = scaleService.subscribe((status) => {
      setScaleStatus(status);
    });
    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Mobile Field Ops', path: '/mobile-yard', icon: Smartphone, isNew: true },
    { label: 'Scrap Metal Scale', path: '/intake', icon: Scale },
    { label: 'Cars On Yard', path: '/vehicles', icon: Car },
    { label: 'Junk Yard Dismantling', path: '/pull-a-part', icon: Wrench },
    { label: 'Parts Price Sheet', path: '/inventory', icon: DollarSign },
    { label: 'Compliance & NMVTIS', path: '/compliance', icon: ShieldCheck },
    { label: 'IP Cameras', path: '/cameras', icon: Camera },
    { label: 'Ticket Ledger', path: '/tickets', icon: Receipt },
    { label: 'Metal Rates', path: '/pricing', icon: DollarSign },
    { label: 'Containers', path: '/containers', icon: Truck },
    { label: 'Cash Drawer', path: '/cash-drawer', icon: Banknote },
    { label: 'Yard Map', path: '/yard-map', icon: Map },
    { label: 'Customers', path: '/customers', icon: Users },
    ...(isAdmin ? [
      { label: 'User Access', path: '/users', icon: Shield, badge: pendingUsersCount },
      { label: 'Server Admin', path: '/server-admin', icon: Lock },
      { label: 'Settings', path: '/settings', icon: Settings },
    ] : []),
    { label: 'System Status', path: '/system-status', icon: Server },
  ];

  const roleBadgeLabels: Record<string, string> = {
    admin: 'Admin',
    yard_manager: 'Yard Mgr',
    scale_operator: 'Scale Tech',
    yard_employee: 'Yard Employee',
  };

  return (
    <>
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Left Section: Mobile Menu Trigger + Logo */}
            <div className="flex items-center gap-2 sm:gap-3">
              
              {/* Mobile / iPad Drawer Trigger */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="xl:hidden h-10 w-10 text-slate-300 hover:text-white hover:bg-slate-800"
                    aria-label="Open Navigation Drawer"
                  >
                    <Menu className="w-6 h-6" />
                  </Button>
                </SheetTrigger>

                <SheetContent side="left" className="w-[300px] sm:w-[350px] bg-slate-950 text-slate-100 border-slate-800 p-0 flex flex-col">
                  <SheetHeader className="p-5 border-b border-slate-800 text-left bg-slate-900">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-md">
                        <Scale className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <SheetTitle className="text-base font-extrabold text-white font-mono">
                          Mahaffeys Suite
                        </SheetTitle>
                        <p className="text-xs text-slate-400 font-medium truncate max-w-[200px]">
                          {settings.yardName}
                        </p>
                      </div>
                    </div>
                  </SheetHeader>

                  {/* Drawer Nav Items */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.path || (item.path === '/' && location.pathname === '/dashboard');
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                            isActive
                              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40'
                              : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                            <span>{item.label}</span>
                          </div>

                          {item.badge && item.badge > 0 ? (
                            <Badge className="bg-amber-500 text-slate-950 font-bold text-[10px] px-1.5 py-0">
                              {item.badge}
                            </Badge>
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                          )}
                        </Link>
                      );
                    })}
                  </div>

                  {/* Drawer Footer */}
                  <div className="p-4 border-t border-slate-800 bg-slate-900 text-xs text-slate-400 space-y-2">
                    <div className="flex justify-between items-center">
                      <span>Logged User:</span>
                      <span className="text-white font-bold">{user?.fullName || "Operator"}</span>
                    </div>
                    <Button onClick={handleSignOut} size="sm" variant="outline" className="w-full h-8 text-xs border-slate-700 text-red-400">
                      <LogOut className="w-3.5 h-3.5 mr-1" /> Sign Out
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>

              {/* Logo */}
              <Link to="/" className="flex items-center gap-2 group">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-md shadow-emerald-950/50 group-hover:scale-105 transition-transform">
                  <Scale className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-base sm:text-lg tracking-tight text-white font-mono">
                      Mahaffeys
                    </span>
                    <Badge variant="outline" className="hidden sm:inline-flex border-emerald-500/40 text-emerald-400 text-[10px] px-1.5 py-0 bg-emerald-950/40">
                      COMMAND
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium truncate max-w-[110px] sm:max-w-[180px]">
                    {settings.yardName}
                  </p>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden xl:flex items-center space-x-1 overflow-x-auto py-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path || (item.path === '/' && location.pathname === '/dashboard');
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 relative ${
                      isActive
                        ? 'bg-slate-800 text-amber-400 border border-slate-700/80 shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                    {item.badge && item.badge > 0 ? (
                      <span className="bg-amber-500 text-slate-950 font-extrabold text-[9px] px-1 rounded-full ml-0.5 animate-bounce">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            {/* Right: Scale Live Status & User Profile Dropdown */}
            <div className="flex items-center space-x-2">
              
              {/* Scale Indicator */}
              <button
                onClick={() => setConfigOpen(true)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/80 hover:border-emerald-500/50 hover:bg-slate-800 transition-all text-left active:scale-95"
              >
                <Activity className={`w-4 h-4 ${scaleStatus.connected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />

                <div className="text-xs">
                  <div className="flex items-center gap-1 font-semibold font-mono text-slate-100 text-[11px]">
                    <span>{scaleStatus.weight.toLocaleString()} {scaleStatus.unit}</span>
                    <span
                      className={`text-[9px] px-1 rounded uppercase tracking-wider font-bold ${
                        scaleStatus.isStable
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {scaleStatus.isStable ? 'STABLE' : 'MOTION'}
                    </span>
                  </div>
                </div>
              </button>

              {/* Admin Pending Requests Notification Badge */}
              {isAdmin && pendingUsersCount > 0 && (
                <Link to="/users" title="Pending User Requests">
                  <Button size="icon" variant="outline" className="h-9 w-9 bg-amber-950/60 border-amber-500/50 text-amber-400 relative">
                    <Bell className="w-4 h-4 animate-bounce" />
                    <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                      {pendingUsersCount}
                    </span>
                  </Button>
                </Link>
              )}

              {/* User Dropdown */}
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-9 px-2 gap-2 text-slate-200 hover:text-white hover:bg-slate-800">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-xs">
                        {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
                      </div>
                      <div className="hidden sm:block text-left">
                        <div className="text-xs font-bold leading-none">{user.fullName}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {roleBadgeLabels[user.role] || user.role}
                        </div>
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800 text-slate-100 text-xs w-52">
                    <DropdownMenuLabel className="text-slate-400 font-mono text-[10px] uppercase">
                      User Account
                    </DropdownMenuLabel>
                    <div className="px-2 py-1 space-y-0.5">
                      <p className="font-bold text-white">{user.fullName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">@{user.username}</p>
                      <Badge className="bg-emerald-950 text-emerald-400 border-emerald-500/40 text-[9px] mt-1">
                        {roleBadgeLabels[user.role] || user.role}
                      </Badge>
                    </div>
                    <DropdownMenuSeparator className="bg-slate-800" />
                    {isAdmin && (
                      <>
                        <DropdownMenuItem onClick={() => navigate("/users")} className="cursor-pointer text-xs">
                          <Shield className="w-3.5 h-3.5 mr-2 text-emerald-400" /> User Access Management
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer text-xs">
                          <Settings className="w-3.5 h-3.5 mr-2 text-slate-400" /> System Settings
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator className="bg-slate-800" />
                    <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-xs text-red-400 focus:text-red-400">
                      <LogOut className="w-3.5 h-3.5 mr-2" /> Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button size="sm" onClick={() => navigate("/login")} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs">
                  Sign In
                </Button>
              )}

            </div>

          </div>
        </div>

        {/* Quick Horizontal Scrollbar for iPads and Tablets */}
        <div className="hidden md:flex xl:hidden items-center space-x-1 bg-slate-950 border-t border-slate-800/80 px-3 py-1.5 text-xs overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path === '/' && location.pathname === '/dashboard');
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg shrink-0 font-medium ${
                  isActive ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </header>

      <ScaleConfigModal open={configOpen} onOpenChange={setConfigOpen} />
    </>
  );
};
</dyad-file>

Now let's update `src/pages/DashboardPage.tsx` to include the launcher card for Mobile Yard Field Ops.<dyad-write path="src/pages/DashboardPage.tsx" description="Adding Mobile Field Ops launcher card to Dashboard Page">
"use client";

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
  Smartphone,
  Layers3,
  Truck,
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
                <Button className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs px-5 h-11 gap-2 shadow-lg shadow-amber-950">
                  <Smartphone className="w-4 h-4" /> Mobile Field Yard Ops
                </Button>
              </Link>

              <Link to="/intake" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-5 h-11 gap-2 shadow-lg shadow-emerald-950">
                  <Plus className="w-4 h-4" /> Start New Intake
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
                { title: "Mobile Field Yard Ops", path: "/mobile-yard", icon: Smartphone, color: "text-amber-400" },
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