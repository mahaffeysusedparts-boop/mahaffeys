import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { storageService } from '@/services/storageService';
import { useAuth } from '@/context/AuthContext';
import { hasPageAccess, PAGE_LABELS, PATH_TO_PAGE_KEY } from '@/utils/pageAccess';
import { Search, LayoutDashboard, Receipt, Car, Users, Truck, Wrench, Clock, ArrowUpRight, type LucideIcon } from 'lucide-react';

interface SearchEntry {
  id: string;
  label: string;
  detail: string;
  path: string;
  group: string;
  icon: LucideIcon;
  keywords: string[];
}
interface QuickSearchProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}
const searchKeys = ['mahaffeys_tickets', 'mahaffeys_pull_yard_vehicles', 'mahaffeys_customers', 'mahaffeys_shipments', 'mahaffeys_equipment', 'mahaffeys_tools', 'mahaffeys_settings'];

export function QuickSearch({ trigger, open: controlledOpen, onOpenChange }: QuickSearchProps) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = onOpenChange ?? setLocalOpen;
  const [query, setQuery] = useState('');
  const [revision, setRevision] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const recentKey = `mahaffeys_quick_search_recent_${user?.id ?? 'guest'}`;

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !event.repeat) {
        event.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) { setQuery(''); return; }
    setRevision(value => value + 1);
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(recentKey) ?? '[]');
      setRecentIds(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string').slice(0, 6) : []);
    } catch { setRecentIds([]); }
    const unsubscribers = searchKeys.map(key => storageService.subscribe(key, () => setRevision(value => value + 1)));
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [open, recentKey]);

  const entries = useMemo(() => {
    const settings = storageService.getSettings();
    const canOpen = (path: string) => {
      const key = PATH_TO_PAGE_KEY[path];
      if (!user || !key) return false;
      if (['/users', '/settings', '/server-admin'].includes(path) && !isAdmin) return false;
      return hasPageAccess(user.role, key, settings.rolePageAccess);
    };
    const rows: SearchEntry[] = Object.entries(PATH_TO_PAGE_KEY)
      .filter(([path]) => path !== '/dashboard' && canOpen(path))
      .map(([path, key]) => ({ id: `page:${path}`, label: PAGE_LABELS[key], detail: 'Open page', path, group: 'Pages', icon: LayoutDashboard, keywords: [key, path] }));
    if (canOpen('/tickets')) rows.push(...storageService.getTickets().map(t => ({ id: `ticket:${t.id}`, label: `${t.id} · ${t.customerName}`, detail: `${t.ticketType.replace('_', ' ')} · ${t.status}`, path: `/tickets?q=${encodeURIComponent(t.id)}`, group: 'Tickets', icon: Receipt, keywords: [t.carRecord?.vin ?? '', t.vehicleLicensePlate ?? ''] })));
    if (canOpen('/pull-a-part')) rows.push(...storageService.getPullYardVehicles().map(v => ({ id: `vehicle:${v.id}`, label: `${v.year} ${v.make} ${v.model}`, detail: v.vin, path: `/vehicles?search=${encodeURIComponent(v.vin)}`, group: 'Vehicles', icon: Car, keywords: [v.vin] })));
    if (canOpen('/customers')) rows.push(...storageService.getCustomers().map(c => ({ id: `customer:${c.id}`, label: c.fullName, detail: c.phone || 'Customer', path: `/customers?q=${encodeURIComponent(c.fullName)}`, group: 'Customers', icon: Users, keywords: [c.phone ?? ''] })));
    if (canOpen('/shipments')) rows.push(...storageService.getShipments().map(s => ({ id: `shipment:${s.id}`, label: s.loadNumber, detail: s.millName, path: `/shipments?q=${encodeURIComponent(s.loadNumber)}`, group: 'Shipments', icon: Truck, keywords: [s.millName] })));
    if (canOpen('/fleet')) {
      rows.push(...storageService.getEquipment().map(e => ({ id: `equipment:${e.id}`, label: e.name, detail: e.assetType, path: `/fleet?tab=equipment&q=${encodeURIComponent(e.name)}`, group: 'Equipment', icon: Truck, keywords: [e.serialOrVin ?? '', e.plate ?? '', e.make ?? '', e.model ?? ''] })));
      rows.push(...storageService.getTools().map(t => ({ id: `tool:${t.id}`, label: `${t.code} · ${t.name}`, detail: `${t.status} · ${t.homeLocation}`, path: `/fleet?tab=tools&q=${encodeURIComponent(t.code)}`, group: 'Tools', icon: Wrench, keywords: [t.category, t.serialNumber ?? ''] })));
    }
    return rows;
  }, [revision, user, isAdmin]);

  const recent = recentIds.map(id => entries.find(entry => entry.id === id)).filter((entry): entry is SearchEntry => !!entry);
  const select = (entry: SearchEntry) => {
    const next = [entry.id, ...recentIds.filter(id => id !== entry.id)].slice(0, 6);
    setRecentIds(next);
    try { localStorage.setItem(recentKey, JSON.stringify(next)); } catch { /* Search still works when browser storage is unavailable. */ }
    setOpen(false);
    navigate(entry.path);
  };
  const renderEntry = (entry: SearchEntry) => {
    const Icon = entry.icon;
    return <CommandItem key={entry.id} value={entry.id} keywords={[entry.label, entry.detail, entry.group, ...entry.keywords]} onSelect={() => select(entry)} className="my-1 min-h-12 cursor-pointer rounded-xl px-3 py-3 text-slate-100 data-[selected=true]:bg-emerald-950 data-[selected=true]:text-emerald-200">
      <Icon className="mr-3 h-5 w-5 shrink-0 text-emerald-400" />
      <div className="min-w-0 flex-1"><p className="truncate font-semibold">{entry.label}</p><p className="truncate text-xs text-slate-400">{entry.detail}</p></div>
      <ArrowUpRight className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
    </CommandItem>;
  };

  return <Dialog open={open} onOpenChange={setOpen}>
    {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
    <DialogContent className="w-[calc(100%-1.5rem)] max-w-2xl gap-0 overflow-hidden rounded-2xl border-slate-700 bg-slate-900 p-0 text-slate-100 sm:rounded-2xl">
      <div className="px-5 pt-5 pb-3"><DialogTitle className="font-mono text-lg text-white">Search the yard</DialogTitle><DialogDescription className="mt-1 text-xs text-slate-400">Pages, tickets, vehicles, customers, shipments, equipment & tools.</DialogDescription></div>
      <Command loop className="rounded-none bg-slate-900 text-slate-100 [&_[cmdk-input-wrapper]]:border-slate-700 [&_[cmdk-group-heading]]:text-slate-400">
        <CommandInput value={query} onValueChange={setQuery} placeholder="Search a name, VIN, ticket or tool code…" className="h-12 text-base placeholder:text-slate-400" />
        <CommandList className="max-h-[50dvh] p-2">
          <CommandEmpty>No matching records. Try a name, code, or page.</CommandEmpty>
          {!query && recent.length > 0 && <CommandGroup heading="Recently opened"><div className="flex justify-end"><Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => { setRecentIds([]); try { localStorage.removeItem(recentKey); } catch { /* Browser storage may be unavailable. */ } }}><Clock className="mr-1 h-3 w-3" /> Clear recent</Button></div>{recent.map(renderEntry)}</CommandGroup>}
          {['Pages', 'Tickets', 'Vehicles', 'Customers', 'Shipments', 'Equipment', 'Tools'].map(group => <CommandGroup key={group} heading={group}>{entries.filter(entry => entry.group === group && (query || !recentIds.includes(entry.id))).map(renderEntry)}</CommandGroup>)}
        </CommandList>
      </Command>
      <div className="flex flex-wrap gap-4 border-t border-slate-800 px-5 py-3 text-xs text-slate-400"><span>↑ ↓ Navigate</span><span>↵ Open</span><span>Esc Close</span><span className="ml-auto">Ctrl / ⌘ K</span></div>
    </DialogContent>
  </Dialog>;
}

export function QuickSearchButton(props: Omit<QuickSearchProps, 'trigger'>) {
  return <QuickSearch {...props} trigger={<Button variant="ghost" aria-label="Search all records (Control or Command K)" title="Search · Ctrl / ⌘ K" className="h-11 w-11 rounded-xl p-0 text-slate-300 hover:bg-slate-800 hover:text-white"><Search className="h-5 w-5" /></Button>} />;
}
