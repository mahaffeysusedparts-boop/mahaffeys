import { useEffect, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { ShipmentForm } from '@/components/shipments/ShipmentForm';
import { ShipmentSettlement } from '@/components/shipments/ShipmentSettlement';
import { ShipmentDetails } from '@/components/shipments/ShipmentDetails';
import { storageService } from '@/services/storageService';
import { sharedStorage } from '@/services/sharedStorage';
import type { ShipmentStatus } from '@/types/scrap';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Truck, Plus, Scale, Factory, DollarSign } from 'lucide-react';
import { useLinkedSearch } from '@/hooks/useLinkedSearch';

const statuses: ShipmentStatus[] = ['STAGED', 'IN_TRANSIT', 'DELIVERED', 'SETTLED', 'DISCREPANCY', 'VOIDED'];
const statusStyle: Record<ShipmentStatus, string> = { STAGED: 'bg-slate-700 text-slate-200', IN_TRANSIT: 'bg-blue-500/20 text-blue-300', DELIVERED: 'bg-amber-500/20 text-amber-300', SETTLED: 'bg-emerald-500/20 text-emerald-300', DISCREPANCY: 'bg-red-500/20 text-red-300', VOIDED: 'bg-rose-950 text-rose-200' };
const money = (value: number) => value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState(storageService.getShipments());
  const [mills, setMills] = useState(storageService.getMills());
  const [filter, setFilter] = useState<'ALL' | ShipmentStatus>('ALL');
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<'DETAILS' | 'EDIT' | 'SETTLE'>('DETAILS');
  const selected = shipments.find(shipment => shipment.id === selectedId);
  const [search, setSearch] = useLinkedSearch();
  const refresh = () => { setShipments(storageService.getShipments()); setMills(storageService.getMills()); };
  useEffect(() => sharedStorage.subscribeKey(key => {
    if (key === 'mahaffeys_shipments' || key === 'mahaffeys_mills') refresh();
  }), []);
  const filtered = shipments.filter(shipment => (filter === 'ALL' || shipment.status === filter) && `${shipment.loadNumber} ${shipment.millName} ${shipment.materialCategory} ${shipment.driverName ?? ''} ${shipment.trailerNumber ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const settled = shipments.filter(shipment => shipment.status === 'SETTLED' || shipment.status === 'DISCREPANCY');
  const now = new Date();
  const mtd = settled.filter(shipment => shipment.settlement && new Date(shipment.settlement.settledAt).getMonth() === now.getMonth() && new Date(shipment.settlement.settledAt).getFullYear() === now.getFullYear()).reduce((sum, shipment) => sum + (shipment.settlement?.amountPaid ?? 0), 0);
  const metrics: [string, string, typeof Truck][] = [
    ['Open loads', String(shipments.filter(shipment => ['STAGED', 'IN_TRANSIT'].includes(shipment.status)).length), Truck],
    ['Settled MTD', money(mtd), DollarSign],
    ['Pending settlement', String(shipments.filter(shipment => shipment.status === 'DELIVERED').length), Factory],
    ['Avg variance', settled.length ? `${(settled.reduce((sum, shipment) => sum + Math.abs(((shipment.settlement?.amountPaid ?? shipment.expectedRevenue) - shipment.expectedRevenue) / Math.max(shipment.expectedRevenue, 1)) * 100, 0) / settled.length).toFixed(1)}%` : '—', Scale],
  ];

  return <div className="min-h-screen bg-slate-950 text-slate-100">
    <Navbar />
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <section className="flex flex-col justify-between gap-4 rounded-3xl border border-emerald-900 bg-emerald-950/40 p-5 sm:flex-row sm:items-center sm:p-7">
        <div className="flex items-start gap-4"><span className="hidden rounded-2xl border border-emerald-700/50 bg-emerald-900/50 p-4 sm:block"><Truck className="h-8 w-8 text-emerald-300" /></span><div><p className="font-mono text-xs tracking-[.2em] text-emerald-400">SELL-SIDE OPERATIONS</p><h1 className="mt-1 text-3xl font-black">Mill Shipments</h1><p className="mt-2 max-w-xl text-sm text-slate-300">Build mixed-grade loads, track delivery, and reconcile what the mill paid.</p></div></div>
        <Button onClick={() => setOpen(true)} className="h-12 shrink-0 rounded-2xl bg-emerald-600 px-5 font-bold hover:bg-emerald-500"><Plus className="mr-2 h-4 w-4" />New load</Button>
      </section>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(([label, value, Icon]) => <Card key={label} className="rounded-2xl border-slate-800 bg-slate-900"><CardContent className="p-4"><Icon className="mb-3 h-4 w-4 text-emerald-400" /><p className="text-xs text-slate-400">{label}</p><p className="font-mono text-xl font-black">{value}</p></CardContent></Card>)}
      </div>
      <Card className="rounded-2xl border-slate-800 bg-slate-900">
        <CardHeader className="gap-4"><div className="flex items-center justify-between"><CardTitle>Load ledger</CardTitle><span className="text-xs text-slate-400">{filtered.length} loads</span></div><div className="flex flex-col gap-3 sm:flex-row"><Input aria-label="Search shipments" placeholder="Search load, mill, grade, driver, or trailer…" value={search} onChange={event => setSearch(event.target.value)} className="h-11 rounded-xl border-slate-700 bg-slate-950 text-white placeholder:text-slate-400" /><Select value={filter} onValueChange={value => setFilter(value as typeof filter)}><SelectTrigger aria-label="Filter shipment status" className="h-11 w-full shrink-0 rounded-xl border-slate-700 bg-slate-950 sm:w-44"><SelectValue /></SelectTrigger><SelectContent>{['ALL', ...statuses].map(status => <SelectItem key={status} value={status}>{status.replace('_', ' ')}</SelectItem>)}</SelectContent></Select></div></CardHeader>
        <CardContent className="space-y-3">
          {filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-700 py-12 text-center"><Truck className="mx-auto mb-3 h-10 w-10 text-emerald-400" /><p className="font-bold">{shipments.length ? 'No matching loads' : 'Your next load starts here'}</p><p className="mt-2 text-sm text-slate-400">{shipments.length ? 'Try another search or status filter.' : 'Add grades, sold prices, and scale weights to stage a shipment.'}</p></div> : filtered.map(shipment => <button key={shipment.id} onClick={() => { setSelectedId(shipment.id); setDetailMode('DETAILS'); }} className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-left transition-colors hover:border-emerald-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row"><div><p className="font-mono text-xs text-emerald-400">{shipment.loadNumber}</p><p className="mt-1 text-lg font-bold">{shipment.millName}</p><p className="mt-1 text-sm text-slate-300">{shipment.materialCategory}</p></div><Badge className={`self-start rounded-lg px-3 py-1 ${statusStyle[shipment.status]}`}>{shipment.status.replace('_', ' ')}</Badge></div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-800 pt-3 sm:grid-cols-4"><div><p className="text-xs text-slate-400">Net weight</p><p className="font-mono text-sm font-bold">{shipment.netWeightLbs.toLocaleString()} lbs</p></div><div><p className="text-xs text-slate-400">Expected sale</p><p className="font-mono text-sm font-bold text-emerald-300">{money(shipment.expectedRevenue)}</p></div><div><p className="text-xs text-slate-400">Mill payment</p><p className="font-mono text-sm font-bold">{shipment.settlement ? money(shipment.settlement.amountPaid) : 'Awaiting settlement'}</p></div><div><p className="text-xs text-slate-400">Driver · trailer</p><p className="text-sm">{shipment.driverName || '—'} · {shipment.trailerNumber || '—'}</p></div></div>
            <p className="mt-3 text-xs text-slate-400">{new Date(shipment.createdAt).toLocaleDateString()} · {shipment.gradeLines?.length ?? 1} grade rows · Open load details →</p>
          </button>)}
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-slate-800 bg-slate-900">
        <CardHeader><CardTitle>Mill directory</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {mills.map(mill => <div key={mill.id} className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3"><b>{mill.name}</b><p className="text-xs text-slate-400">{mill.contactName || 'No contact'} {mill.phone ? `· ${mill.phone}` : ''}</p></div>)}
          <Button variant="outline" onClick={() => { const name = window.prompt('Mill or processor name'); if (name) { storageService.saveMill({ id: `mill-${Date.now()}`, name, createdAt: new Date().toISOString() }); refresh(); } }} className="rounded-xl border-slate-700">+ Add mill</Button>
        </CardContent>
      </Card>
    </main>
    {open && <ShipmentForm onClose={() => setOpen(false)} mills={mills} onSaved={refresh} />}
    {selected && detailMode === 'DETAILS' && <ShipmentDetails shipment={selected} onClose={() => setSelectedId(null)} onSaved={refresh} onEdit={() => setDetailMode('EDIT')} onSettle={() => setDetailMode('SETTLE')} />}
    {selected && detailMode === 'EDIT' && <ShipmentForm key={selected.id} shipment={selected} onClose={() => setDetailMode('DETAILS')} mills={mills} onSaved={refresh} />}
    {selected && detailMode === 'SETTLE' && <ShipmentSettlement key={selected.id} shipment={selected} onClose={() => setSelectedId(null)} onBack={() => setDetailMode('DETAILS')} onSaved={refresh} />}
  </div>;
}
