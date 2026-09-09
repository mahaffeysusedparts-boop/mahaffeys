import React, { useEffect, useState } from 'react';
import { scaleService } from '@/services/scaleService';
import { ScaleConfig } from '@/types/scrap';
import { scaleAccent } from './scaleAccent';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Check, ChevronDown, Scale } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Global platform quick-switcher for the Navbar — switch the active scale
 * from any page without opening Settings or the Dashboard.
 */
export const ScaleQuickSwitcher: React.FC = () => {
  const [scales, setScales] = useState<ScaleConfig[]>(scaleService.getScales());
  const [currentScaleId, setCurrentScaleId] = useState<string | null>(scaleService.getCurrentScaleId());

  useEffect(() => {
    const unsub = scaleService.subscribe(() => {
      setScales(scaleService.getScales());
      setCurrentScaleId(scaleService.getCurrentScaleId());
    });
    return () => unsub();
  }, []);

  if (scales.length === 0) return null;

  const active = scales.find((s) => s.id === currentScaleId) ?? null;
  const accent = scaleAccent(active?.accentColor);

  const handleSelect = (id: string | null) => {
    if (id === currentScaleId) return;
    scaleService.setCurrentScale(id);
    const next = scales.find((s) => s.id === id);
    toast.success(next ? 'Switched to scale: ' + next.name : 'Scale disconnected');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          aria-label="Switch scale platform"
          className="h-9 px-2 gap-1.5 rounded-xl text-slate-200 hover:text-white hover:bg-slate-800"
        >
          <span className={`h-2.5 w-2.5 rounded-full ${accent.dot}`} />
          <span className="hidden md:block max-w-[120px] truncate text-[11px] font-semibold font-mono">
            {active ? active.name : 'No Scale'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800 text-slate-100 text-xs w-64">
        <DropdownMenuLabel className="text-slate-400 font-mono text-[10px] uppercase">
          Switch Scale Platform
        </DropdownMenuLabel>
        {scales.map((scale) => {
          const sAccent = scaleAccent(scale.accentColor);
          return (
            <DropdownMenuItem key={scale.id} onClick={() => handleSelect(scale.id)} className="cursor-pointer gap-2">
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${sAccent.dot}`} />
              <span className="flex-1 min-w-0">
                <span className="block font-bold truncate">{scale.name}</span>
                {scale.location && (
                  <span className="block text-[10px] text-slate-500 truncate">{scale.location}</span>
                )}
              </span>
              {scale.id === currentScaleId && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator className="bg-slate-800" />
        <DropdownMenuItem onClick={() => handleSelect(null)} className="cursor-pointer gap-2">
          <Scale className="w-3.5 h-3.5 text-slate-500" />
          <span className="flex-1">No Scale</span>
          {currentScaleId === null && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
