import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, Scale, Receipt, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Ticket } from '@/types/scrap';

export function TicketActivity({ tickets, now, canOpenTickets }: { tickets: Ticket[]; now: Date; canOpenTickets: boolean }) {
  const [type, setType] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [period, setPeriod] = useState('ALL');
  const filtered = tickets.filter(ticket =>
    (type === 'ALL' || ticket.ticketType === type) &&
    (status === 'ALL' || ticket.status === status) &&
    (period === 'ALL' || new Date(ticket.createdAt).toDateString() === now.toDateString()),
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const filters = [
    { label: 'Activity type', value: type, set: setType, options: [['ALL', 'All intake'], ['CAR_SALVAGE', 'Cars'], ['SCRAP_METAL', 'Scrap metal']] },
    { label: 'Ticket status', value: status, set: setStatus, options: [['ALL', 'All statuses'], ...Array.from(new Set(tickets.map(ticket => ticket.status))).sort().map(value => [value, value.replace(/_/g, ' ')])] },
    { label: 'Activity period', value: period, set: setPeriod, options: [['ALL', 'All dates'], ['TODAY', 'Today']] },
  ];

  return (
    <Card className="overflow-hidden rounded-2xl border-slate-800 bg-slate-900 text-white shadow-xl">
      <CardHeader className="gap-4 border-b border-slate-800 bg-slate-950/60 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold"><Receipt className="h-5 w-5 text-emerald-400" /> Recent ticket activity</CardTitle>
          {canOpenTickets && <Link to="/tickets" className="flex items-center gap-1 text-xs font-semibold text-amber-300 hover:underline">All tickets <ChevronRight className="h-4 w-4" /></Link>}
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map(filter => (
            <Select key={filter.label} value={filter.value} onValueChange={filter.set}>
              <SelectTrigger aria-label={filter.label} className="h-10 w-full rounded-xl border-slate-700 bg-slate-800 text-xs sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent className="border-slate-700 bg-slate-900 text-white">
                {filter.options.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          ))}
          <span className="self-center text-xs text-slate-400">{filtered.length} matching tickets</span>
        </div>
      </CardHeader>
      <CardContent className="divide-y divide-slate-800 p-0">
        {filtered.length === 0 ? <div className="p-10 text-center text-sm text-slate-300">No tickets match these filters.</div> : filtered.slice(0, 10).map(ticket => {
          const content = (
            <>
              <div className="flex min-w-0 items-center gap-3">
                <div className={`shrink-0 rounded-xl p-2 ${ticket.ticketType === 'CAR_SALVAGE' ? 'bg-amber-950 text-amber-300' : 'bg-emerald-950 text-emerald-300'}`}>
                  {ticket.ticketType === 'CAR_SALVAGE' ? <Car className="h-5 w-5" /> : <Scale className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{ticket.customerName}</p>
                  <p className="mt-1 text-xs text-slate-400">#{ticket.id} · {new Date(ticket.createdAt).toLocaleDateString()} {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm font-bold text-emerald-300">${ticket.finalPayout.toFixed(2)}</p>
                <Badge variant="outline" className="mt-1 border-slate-600 text-[10px] text-slate-300">{ticket.status.replace(/_/g, ' ')}</Badge>
              </div>
            </>
          );
          const className = 'flex items-center justify-between gap-3 p-4 transition-colors hover:bg-slate-800/50';
          return canOpenTickets ? <Link key={ticket.id} to={`/tickets?q=${encodeURIComponent(ticket.id)}`} className={className}>{content}</Link> : <div key={ticket.id} className={className}>{content}</div>;
        })}
      </CardContent>
    </Card>
  );
}
