import { ScaleAccentColor } from '@/types/scrap';

/**
 * Preset accent palette for scale platforms. Tailwind can't build classes
 * from dynamic strings, so every accent resolves to a fixed class set here.
 */
export interface ScaleAccentClasses {
  dot: string;
  swatch: string;
  chipBorder: string;
  chipText: string;
  chipBg: string;
}

const SCALE_ACCENTS: Record<ScaleAccentColor, ScaleAccentClasses> = {
  emerald: { dot: 'bg-emerald-400', swatch: 'bg-emerald-400', chipBorder: 'border-emerald-500/50', chipText: 'text-emerald-300', chipBg: 'bg-emerald-950/60' },
  amber: { dot: 'bg-amber-400', swatch: 'bg-amber-400', chipBorder: 'border-amber-500/50', chipText: 'text-amber-300', chipBg: 'bg-amber-950/60' },
  sky: { dot: 'bg-sky-400', swatch: 'bg-sky-400', chipBorder: 'border-sky-500/50', chipText: 'text-sky-300', chipBg: 'bg-sky-950/60' },
  violet: { dot: 'bg-violet-400', swatch: 'bg-violet-400', chipBorder: 'border-violet-500/50', chipText: 'text-violet-300', chipBg: 'bg-violet-950/60' },
  rose: { dot: 'bg-rose-400', swatch: 'bg-rose-400', chipBorder: 'border-rose-500/50', chipText: 'text-rose-300', chipBg: 'bg-rose-950/60' },
};

export function scaleAccent(color?: string | null): ScaleAccentClasses {
  return SCALE_ACCENTS[(color ?? 'emerald') as ScaleAccentColor] ?? SCALE_ACCENTS.emerald;
}
