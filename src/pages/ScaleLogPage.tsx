import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { storageService } from '@/services/storageService';
import { scaleService } from '@/services/scaleService';
import { ScaleConfig, ScaleWeightEvent } from '@/types/scrap';
import { scaleAccent } from '@/components/scale/scaleAccent';
import { downloadCsv } from '@/utils/exportUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ScrollText,
  Download,
  Scale,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  Weight,
  ChevronRight,
} from 'lucide-react';

const fmtLbs = (lbs: number) => lbs.toLocaleString();

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

export default function ScaleLogPage() {
  const [events, setEvents] = useState<ScaleWeightEvent[]>(storageService.getScaleEvents());
  const [scales, setScales] = useState<ScaleConfig[]>(scaleService.getScales());
  const [scaleFilter, setScaleFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    const unsubEvents = storageService.subscribe('mahaffeys_scale_events', () =>
      setEvents(storageService.getScaleEvents()),
    );
    const unsubSettings = storageService.subscribe('mahaffeys_settings', () => {
      scaleService.reloadScales();
      setScales(scaleService.getScales());
    });
    return () => {
      unsubEvents();
      unsubSettings();
    };
  }, []);

  const scaleOptions = useMemo(() => {
    const configured = scales.map((s) => ({ id: s.id, name: s.name }));
    const seen = new Set(configured.map((s) => s.id));
    const unconfigured = events.some((e) => e.scaleId === null || !seen.has(e.scaleId))
      ? [{ id: 'unconfigured', name: 'Unconfigured Scale' }]
      : [];
    return [...configured, ...unconfigured];
  }, [scales, events]);

  const filtered = useMemo(() => {
    return events.filter((event) => {
      if (scaleFilter === 'unconfigured') {
        const known = scales.some((s) => s.id === event.scaleId);
        if (event.scaleId !== null && known) return false;
      } else if (scaleFilter !== 'all' && event.scaleId !== scaleFilter) {
        return false;
      }
      if (directionFilter !== 'all' && event.direction !== directionFilter) return false;
      if (dateFilter) {
        const eventDate = new Date(event.detectedAt);
        const selectedDate = new Date(dateFilter + 'T00:00:00');
        if (eventDate.toDateString() !== selectedDate.toDateString()) return false;
      }
      return true;
    });
  }, [events, scales, scaleFilter, directionFilter, dateFilter]);

  // Summary header — today's traffic across every platform.
  const todaysEvents = events.filter(
    (e) => new Date(e.detectedAt).toDateString() === new Date().toDateString(),
  );
  const lbsOnToday = todaysEvents.filter((e) => e.direction === 'ADDED').reduce((acc, e) => acc + e.deltaLbs, 0);
  const lbsOffToday = todaysEvents.filter((e) => e.direction === 'REMOVED').reduce((acc, e) => acc + e.deltaLbs, 0);
  const heaviestLoadToday = todaysEvents.reduce((max, e) => Math.max(max, e.deltaLbs), 0);
  const currentPlatformTotal = events[0]?.grossAfterLbs ?? 0;

  const hasActiveFilters = scaleFilter !== 'all' || directionFilter !== 'all' || dateFilter !== '';

  const handleExportCsv = () => {
    if (filtered.length === 0) return;
    downloadCsv(
      `Mahaffeys_ScaleActivity_${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((event) => ({
        Time: new Date(event.detectedAt).toLocaleString(),
        Scale: event.scaleName,
        Direction: event.direction === 'ADDED' ? 'ON' : 'OFF',
        'Delta LBS': event.deltaLbs,
        'Gross After LBS': event.grossAfterLbs,
      })),
    );
  };

  const accentFor = (event: ScaleWeightEvent) =>
    scaleAccent(scales.find((s) => s.id === event.scaleId)?.accentColor);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/30">
              <ScrollText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">Weight Activity Journal</h1>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-mono uppercase tracking-widest">
                  Auto-Logged
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Every load that goes on or comes off any platform — recorded automatically, no ticket required.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/intake">
              <Button variant="outline" size="sm" className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs gap-1.5">
                <Scale className="w-3.5 h-3.5" /> Scale Station
              </Button>
            </Link>
            <Button
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV{filtered.length > 0 ? ` (${filtered.length})` : ''}
            </Button>
          </div>
        </div>

        {/* Summary header */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Events Today</p>
                <p className="text-2xl font-black text-white font-mono mt-1">{todaysEvents.length}</p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{events.length} in journal (max 500)</p>
              </div>
              <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <ScrollText className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">LBS Crossed Today</p>
                <p className="text-2xl font-black text-emerald-400 font-mono mt-1">{fmtLbs(lbsOnToday)}</p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">−{fmtLbs(lbsOffToday)} LBS off</p>
              </div>
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ArrowDownToLine className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Heaviest Load Today</p>
                <p className="text-2xl font-black text-amber-300 font-mono mt-1">{fmtLbs(heaviestLoadToday)}</p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">single settled event</p>
              </div>
              <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Weight className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Platform Now</p>
                <p className="text-2xl font-black text-violet-300 font-mono mt-1">{fmtLbs(currentPlatformTotal)}</p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  {events[0] ? events[0].scaleName + ' · last event' : 'no events yet'}
                </p>
              </div>
              <div className="p-2.5 rounded-2xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                <TrendingUp className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters + journal table */}
        <Card className="bg-slate-900 border-slate-800 text-white shadow-xl overflow-hidden">
          <CardHeader className="py-4 px-6 bg-slate-950/60 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-rose-400" /> Journal — {filtered.length} Event{filtered.length === 1 ? '' : 's'}
            </CardTitle>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:items-center">
              <Select value={scaleFilter} onValueChange={setScaleFilter}>
                <SelectTrigger className="h-9 w-full sm:w-40 border-slate-700 bg-slate-800 text-xs text-white">
                  <SelectValue placeholder="All scales" />
                </SelectTrigger>
                <SelectContent className="border-slate-700 bg-slate-900 text-white">
                  <SelectItem value="all">All scales</SelectItem>
                  {scaleOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={directionFilter} onValueChange={setDirectionFilter}>
                <SelectTrigger className="h-9 w-full sm:w-32 border-slate-700 bg-slate-800 text-xs text-white">
                  <SelectValue placeholder="Both directions" />
                </SelectTrigger>
                <SelectContent className="border-slate-700 bg-slate-900 text-white">
                  <SelectItem value="all">On &amp; Off</SelectItem>
                  <SelectItem value="ADDED">Weight ON</SelectItem>
                  <SelectItem value="REMOVED">Weight OFF</SelectItem>
                </SelectContent>
              </Select>
              <div>
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="h-9 border-slate-700 bg-slate-800 text-xs text-white [color-scheme:dark]"
                />
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setScaleFilter('all');
                    setDirectionFilter('all');
                    setDateFilter('');
                  }}
                  className="h-9 text-xs text-slate-400 hover:text-white"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Scale className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-300">
                  {events.length === 0 ? 'No platform activity logged yet' : 'No events match these filters'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {events.length === 0
                    ? 'When weight settles on any configured platform, an event appears here automatically.'
                    : 'Try widening the scale, direction, or date filters.'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-950/80">
                  <TableRow className="border-slate-800 text-xs hover:bg-slate-950">
                    <TableHead className="text-slate-400">Time</TableHead>
                    <TableHead className="text-slate-400">Scale</TableHead>
                    <TableHead className="text-slate-400">Direction</TableHead>
                    <TableHead className="text-right text-slate-400">Delta</TableHead>
                    <TableHead className="text-right text-slate-400">Gross After</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((event) => {
                    const accent = accentFor(event);
                    return (
                      <TableRow key={event.id} className="border-slate-800 font-mono text-xs hover:bg-slate-800/40">
                        <TableCell className="text-slate-400 whitespace-nowrap">{fmtDateTime(event.detectedAt)}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2 font-sans font-semibold text-white">
                            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${accent.dot}`} />
                            {event.scaleName}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`gap-1 font-mono text-[10px] ${
                              event.direction === 'ADDED'
                                ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                                : 'border border-amber-500/40 bg-amber-500/15 text-amber-300'
                            }`}
                          >
                            {event.direction === 'ADDED' ? (
                              <ArrowDownToLine className="h-3 w-3" />
                            ) : (
                              <ArrowUpFromLine className="h-3 w-3" />
                            )}
                            +{fmtLbs(event.deltaLbs)} LBS ON
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`text-right font-bold ${event.direction === 'ADDED' ? 'text-emerald-400' : 'text-amber-400'}`}
                        >
                          {event.direction === 'ADDED' ? '+' : '−'}{fmtLbs(event.deltaLbs)}
                        </TableCell>
                        <TableCell className="text-right text-slate-300">{fmtLbs(event.grossAfterLbs)} LBS</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <p className="text-[11px] text-slate-500 text-center">
          Detection threshold and logging can be tuned in{' '}
          <Link to="/settings" className="text-amber-400 hover:underline inline-flex items-center gap-0.5">
            Settings <ChevronRight className="w-3 h-3" />
          </Link>{' '}
          — the journal is capped at the most recent 500 events.
        </p>
      </main>
    </div>
  );
}
