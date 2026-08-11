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

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Scrap Metal Scale', path: '/intake', icon: Scale },
    { label: 'Junk Yard Cars', path: '/pull-a-part', icon: Car },
    { label: 'Public Inventory', path: '/inventory', icon: Wrench },
    { label: 'Compliance & NMVTIS', path: '/compliance', icon: ShieldCheck },
    { label: 'Ticket Ledger', path: '/tickets', icon: Receipt },
    { label: 'Metal Rates', path: '/pricing', icon: DollarSign },
    { label: 'Containers', path: '/containers', icon: Truck },
    { label: 'Cash Drawer', path: '/cash-drawer', icon: Banknote },
    { label: 'Yard Map', path: '/yard-map', icon: Map },
    { label: 'Customers', path: '/customers', icon: Users },
    { label: 'System Status', path: '/system-status', icon: Server },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  const roleBadgeLabels: Record<string, string> = {
    admin: 'Admin',
    yard_manager: 'Yard Mgr',
    scale_operator: 'Scale Tech',
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
                          ScrapFlow Suite
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
                          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
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
                      ScrapFlow
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
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                      isActive
                        ? 'bg-slate-800 text-amber-400 border border-slate-700/80 shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
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
                <Link to="/settings" title="Pending User Requests">
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
                  <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800 text-slate-100 text-xs w-48">
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
                      <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer text-xs">
                        <Users className="w-3.5 h-3.5 mr-2 text-emerald-400" /> User Access Management
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer text-xs">
                      <Settings className="w-3.5 h-3.5 mr-2 text-slate-400" /> System Settings
                    </DropdownMenuItem>
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