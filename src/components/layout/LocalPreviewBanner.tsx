import { HardDrive, ShieldCheck } from 'lucide-react';

export function LocalPreviewBanner() {
  if (!import.meta.env.DEV) return null;
  return (
    <aside data-testid="local-preview-banner" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-emerald-700 bg-emerald-950 px-4 py-2 text-xs text-emerald-100">
      <span className="flex items-center gap-1.5 font-bold"><HardDrive className="h-4 w-4" /> Local preview</span>
      <span>Records are saved on this computer.</span>
      <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Live yard database is not connected.</span>
    </aside>
  );
}
