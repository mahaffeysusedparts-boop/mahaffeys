import { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { ShipmentForm } from '@/components/shipments/ShipmentForm';
import { ShipmentSettlement } from '@/components/shipments/ShipmentSettlement';
import { storageService } from '@/services/storageService';
import type { OutboundShipment, ShipmentStatus } from '@/types/scrap';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Truck, Plus, Scale, Factory, DollarSign } from 'lucide-react';
import { useLinkedSearch } from '@/hooks/useLinkedSearch';

const statuses: ShipmentStatus[] = ['STAGED', 'IN_TRANSIT', 'DELIVERED', 'SETTLED', 'DISCREPANCY'];
const statusStyle: Record<ShipmentStatus, string> = { STAGED: 'bg-slate-700 text-slate-200', IN_TRANSIT: 'bg-blue-500/20 text-blue-300', DELIVERED: 'bg-amber-500/20 text-amber-300', SETTLED: 'bg-emerald-500/20 text-emerald-300', DISCREPANCY: 'bg-red-500/20 text-red-300' };
const money = (value: number) => value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState(storageService.getShipments());
  const [mills, setMills] = useState(storageService.getMills());
  const [filter, setFilter] = useState<'ALL' | ShipmentStatus>('ALL');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<OutboundShipment | null>(null);
  const [search, setSearch] = useLinkedSearch();
  const refresh = () => { setShipments(storageService.getShipments()); setMills(storageService.getMills()); };
  const filtered = shipments.filter(shipment => (filter === 'ALL' || shipment.status === filter) && `${shipment.loadNumber} ${shipment.millName} ${shipment.materialCategory}`.toLowerCase().includes(search.trim().toLowerCase()));
  const settled = shipments.filter(shipment => shipment.status === 'SETTLED' || shipment.status === 'DISCREPANCY');
  const mtd = settled.filter(shipment => new Date(shipment.createdAt).getMonth() === new Date().getMonth()).reduce((sum, shipment) => sum + (shipment.settlement?.amountPaid ?? 0), 0);
  const metrics: [string, string, typeof Truck][] = [
    ['Open loads', String(shipments.filter(shipment => ['STAGED', 'IN_TRANSIT'].includes(shipment.status)).length), Truck],
    ['Settled MTD', money(mtd), DollarSign],
    ['Pending settlement', String(shipments.filter(shipment => shipment.status === 'DELIVERED').length), Factory],
    ['Avg variance', settled.length ? `${(settled.reduce((sum, shipment) => sum + Math.abs(((shipment.settlement?.amountPaid ?? shipment.expectedRevenue) - shipment.expectedRevenue) / Math.max(shipment.expectedRevenue, 1)) * 100, 0) / settled.length).toFixed(1)}%` : '—', Scale],
  ];

  return <div className="min-h-screen bg-slate-950 text-slate-100">
    <Navbar />
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <Input aria-label="Search shipments" placeholder="Search load number, mill, or grade…" value={search} onChange={event => setSearch(event.target.value)} className="h-11 rounded-xl border-slate-700 bg-slate-900 text-white placeholder:text-slate-400" />
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="font-mono text-xs tracking-[.2em] text-emerald-400">SELL-SIDE OPERATIONS</p><h1 className="text-3xl font-black">Mill Shipments</h1><p className="text-slate-400">From yard scale to settlement reconciliation.</p></div>
        <Button onClick={() => setOpen(true)} className="rounded-xl bg-emerald-600 hover:bg-emerald-500"><Plus className="mr-2 h-4 w-4" />New load</Button>
      </section>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(([label, value, Icon]) => <Card key={label} className="rounded-2xl border-slate-800 bg-slate-900"><CardContent className="p-4"><Icon className="mb-3 h-4 w-4 text-emerald-400" /><p className="text-xs text-slate-400">{label}</p><p className="font-mono text-xl font-black">{value}</p></CardContent></Card>)}
      </div>
      <Card className="rounded-2xl border-slate-800 bg-slate-900">
        <CardHeader className="flex-row items-center justify-between"><CardTitle>Load ledger</CardTitle><Select value={filter} onValueChange={value => setFilter(value as typeof filter)}><SelectTrigger className="w-40 rounded-xl border-slate-700 bg-slate-950"><SelectValue /></SelectTrigger><SelectContent>{['ALL', ...statuses].map(status => <SelectItem key={status} value={status}>{status.replace('_', ' ')}</SelectItem>)}</SelectContent></Select></CardHeader>
        <CardContent className="space-y-3">
          {filtered.length === 0 ? <div className="py-16 text-center text-slate-500"><Truck className="mx-auto mb-3 h-10 w-10" />No loads yet. Create a shipment when processed metal leaves the yard.</div> : filtered.map(shipment => <button key={shipment.id} onClick={() => setSelected(shipment)} className="w-full rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-left transition-colors hover:border-emerald-500/40">
            <div className="flex flex-col justify-between gap-3 sm:flex-row">
              <div><p className="font-bold">{shipment.loadNumber} <span className="font-normal text-slate-400">• {shipment.millName}</span></p><p className="text-sm text-slate-400">{shipment.materialCategory} · {shipment.netWeightLbs.toLocaleString()} lbs · expected {money(shipment.expectedRevenue)}</p>{shipment.gradeLines && shipment.gradeLines.length > 1 && <p className="mt-1 text-xs text-emerald-400">{shipment.gradeLines.length} grade rows · View sold prices</p>}</div>
              <Badge className={`self-start ${statusStyle[shipment.status]}`}>{shipment.status.replace('_', ' ')}</Badge>
            </div>
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
    {selected && <ShipmentSettlement key={selected.id} shipment={selected} onClose={() => setSelected(null)} onSaved={refresh} />}
  </div>;
}
