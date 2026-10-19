import { useState } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

export function InterchangeVehiclePicker({ label, value, options, onChange, disabled, loading }: {
  label: string; value: string; options: string[]; onChange: (value: string) => void; disabled?: boolean; loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const matching = options.filter((option) => option.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="min-w-0 space-y-2">
    <span className="block text-xs font-semibold text-slate-200">{label}</span>
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch(''); }}>
      <PopoverTrigger asChild><Button type="button" role="combobox" aria-label={`Choose ${label.toLowerCase()}`} aria-expanded={open} disabled={disabled} variant="outline" className="h-12 w-full justify-between rounded-xl border-slate-600 bg-slate-950 px-3 text-left text-white hover:bg-slate-800 hover:text-white"><span className="truncate">{value || `Choose ${label.toLowerCase()}…`}</span>{loading ? <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin text-emerald-300" /> : <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-emerald-300" />}</Button></PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] min-w-64 rounded-xl border-slate-600 bg-slate-900 p-0 text-white">
        <Command shouldFilter={false} className="rounded-xl bg-slate-900 text-white">
          <CommandInput placeholder={`Search ${label.toLowerCase()}…`} value={search} onValueChange={setSearch} className="text-white" />
          <CommandList className="max-h-64"><CommandEmpty className="p-4 text-sm text-slate-200">{loading ? 'Loading online options…' : 'No matching options. Try another search.'}</CommandEmpty><CommandGroup>
            {matching.slice(0, 100).map((option) => <CommandItem key={option} value={option} onSelect={() => { onChange(option); setOpen(false); setSearch(''); }} className="my-1 rounded-lg py-3 text-white data-[selected=true]:bg-emerald-800 data-[selected=true]:text-white"><Check className={`mr-2 h-4 w-4 text-emerald-300 ${option.toLowerCase() === value.toLowerCase() ? 'opacity-100' : 'opacity-0'}`} />{option}</CommandItem>)}
          </CommandGroup></CommandList>
          {matching.length > 100 && <p className="border-t border-slate-700 p-3 text-xs text-slate-200">{matching.length} options found. Type to narrow the list.</p>}
        </Command>
      </PopoverContent>
    </Popover>
  </div>;
}
