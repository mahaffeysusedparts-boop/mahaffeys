import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ScaleStatus, YardSettings } from '@/types/scrap';
import { scaleService } from '@/services/scaleService';
import { storageService } from '@/services/storageService';
import { ScaleConfigModal } from '../scale/ScaleConfigModal';
import {
  Scale,
  Car,
  Receipt,
  DollarSign,
  Users,
  Settings,
  ShieldCheck,
  Activity,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const [scaleStatus, setScaleStatus] = useState<ScaleStatus>(scaleService.getStatus());
  const [settings, setSettings] = useState<YardSettings>(storageService.getSettings());
  const [configOpen, setConfigOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = scaleService.subscribe((status) => {
      setScaleStatus(status);
    });
    return () => unsubscribe();
  }, []);

  const navItems = [
    { label: 'Intake Station', path: '/', icon: Scale },
    { label: 'Compliance & NMVTIS', path: '/compliance', icon: ShieldCheck },
    { label: 'Ticket Ledger', path: '/tickets', icon: Receipt },
    { label: 'Metal & Auto Rates', path: '/pricing', icon: DollarSign },
    { label: 'Customers & VINs', path: '/customers', icon: Users },
    { label: 'Yard Settings', path: '/settings', icon: Settings },
  ];

  return (
    <>
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo & Yard Info */}
            <div className="flex items-center space-x-3">
              <Link to="/" className="flex items-center gap-2.5 group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-md shadow-emerald-950/50 group-hover:scale-105 transition-transform">
                  <Scale className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-lg tracking-tight text-white font-mono">
                      ScrapFlow
                    </span>
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px] px-1.5 py-0 bg-emerald-950/40">
                      LOCAL YARD
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 font-medium truncate max-w-[180px] sm:max-w-[240px]">
                    {settings.yardName}
                  </p>
                </div>
              </Link>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-slate-800 text-emerald-400 border border-slate-700/80 shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Scale Hardware Connectivity Badge / Quick Toggle */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setConfigOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700/80 hover:border-emerald-500/50 hover:bg-slate-800 transition-all text-left group"
              >
                <div className="relative flex items-center justify-center">
                  <Activity className={`w-4 h-4 ${scaleStatus.connected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
                </div>

                <div className="text-xs">
                  <div className="flex items-center gap-1.5 font-semibold font-mono text-slate-100">
                    <span>{scaleStatus.weight.toLocaleString()} {scaleStatus.unit}</span>
                    <span
                      className={`text-[10px] px-1 rounded uppercase tracking-wider font-bold ${
                        scaleStatus.isStable
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {scaleStatus.isStable ? 'STABLE' : 'MOTION'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <span className="truncate max-w-[90px]">
                      {scaleStatus.mode === 'SIMULATOR'
                        ? 'SIMULATOR'
                        : scaleStatus.mode === 'WEB_SERIAL'
                        ? 'USB SERIAL'
                        : 'NETWORK SCALE'}
                    </span>
                    <span className="text-emerald-400 text-[10px] underline group-hover:text-emerald-300">
                      Configure
                    </span>
                  </div>
                </div>
              </button>

              <Badge
                variant="secondary"
                className="hidden lg:inline-flex bg-slate-800 text-slate-300 border-slate-700 text-xs font-normal"
              >
                Op: {settings.operatorName}
              </Badge>
            </div>

          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex items-center justify-around bg-slate-950 border-t border-slate-800/80 py-2 px-2 text-xs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-1 px-2 py-1 rounded ${
                  isActive ? 'text-emerald-400 font-semibold' : 'text-slate-400'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px]">{item.label.split(' ')[0]}</span>
              </Link>
            );
          })}
        </div>
      </header>

      <ScaleConfigModal open={configOpen} onOpenChange={setConfigOpen} />
    </>
  );
};
