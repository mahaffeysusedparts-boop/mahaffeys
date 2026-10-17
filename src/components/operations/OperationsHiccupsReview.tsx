import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { OperationalHiccup, HiccupSeverity, HiccupStatus, HiccupCategory } from '@/types/operations';
import { AlertTriangle, BellRing, Clock3, ExternalLink, Check, ArrowRight, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

const severityColor = (severity: HiccupSeverity) => {
  switch (severity) {
    case 'CRITICAL': return 'bg-rose-500/15 border-rose-500/40 text-rose-300';
    case 'HIGH': return 'bg-amber-500/15 border-amber-500/40 text-amber-300';
    case 'MEDIUM': return 'bg-sky-500/15 border-sky-500/40 text-sky-300';
    case 'LOW': return 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300';
  }
};

const statusColor = (status: HiccupStatus) => {
  switch (status) {
    case 'OPEN': return 'bg-slate-700/30 border-slate-600 text-slate-300';
    case 'ACKNOWLEDGED': return 'bg-amber-500/15 border-amber-500/40 text-amber-300';
    case 'RESOLVED': return 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300';
    case 'ESCALATED': return 'bg-rose-500/15 border-rose-500/40 text-rose-300';
  }
};

const categoryLabel = (category: HiccupCategory) => category.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

export function OperationsHiccupsReview({ hiccups, canManage, onAction }: { hiccups: OperationalHiccup[]; canManage: boolean; onAction: (hiccup: OperationalHiccup, action: HiccupStatus, note?: string) => void }) {
  const [noteOpen, setNoteOpen] = useState<OperationalHiccup | null>(null);
  const [noteText, setNoteText] = useState('');

  const openHiccups = hiccups.filter(h => h.status === 'OPEN');
  const acknowledgedHiccups = hiccups.filter(h => h.status === 'ACKNOWLEDGED');
  const resolvedHiccups = hiccups.filter(h => h.status === 'RESOLVED');
  const escalatedHiccups = hiccups.filter(h => h.status === 'ESCALATED');
  const criticalOpen = hiccups.filter(h => h.status === 'OPEN' && h.severity === 'CRITICAL');

  const handleAction = (hiccup: OperationalHiccup, action: HiccupStatus) => {
    if (action === 'RESOLVED' || action === 'ESCALATED') {
      setNoteOpen(hiccup);
      return;
    }
    onAction(hiccup, action);
    toast.success(`Hiccup ${action.toLowerCase()}`);
  };

  const handleNoteSubmit = () => {
    if (!noteOpen) return;
    onAction(noteOpen, noteOpen.status === 'OPEN' ? 'RESOLVED' : 'ESCALATED', noteText);
    setNoteOpen(null);
    setNoteText('');
    toast.success(`Hiccup ${noteOpen.status === 'OPEN' ? 'resolved' : 'escalated'}`);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">Operational hiccups</p>
            <h2 className="text-xl font-black sm:text-2xl tracking-tight">Hiccup review</h2>
            <p className="mt-1 text-xs text-slate-400">Open issues requiring attention across payouts, cash drawer, weights, and settlements.</p>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-4">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Open</p>
              <p className="text-2xl font-mono font-black text-slate-300">{openHiccups.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Acknowledged</p>
              <p className="text-2xl font-mono font-black text-amber-400">{acknowledgedHiccups.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Escalated</p>
              <p className="text-2xl font-mono font-black text-rose-400">{escalatedHiccups.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Critical open</p>
              <p className="text-2xl font-mono font-black text-rose-400">{criticalOpen.length}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid xl:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 shadow-lg">
          <CardHeader className="p-4 border-b border-slate-800 flex-row justify-between items-center">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400"/>Open hiccups
            </CardTitle>
            <Badge className={statusColor('OPEN')}>{openHiccups.length}</Badge>
          </CardHeader>
          <CardContent className="p-2 space-y-1">
            {openHiccups.length ? openHiccups.map(hiccup => (
              <div key={hiccup.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex gap-2 items-start">
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${severityColor(hiccup.severity)}`}/>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="text-[10px] border-slate-700 bg-slate-800 text-slate-400">{categoryLabel(hiccup.category)}</Badge>
                      <Badge className={severityColor(hiccup.severity)}>{hiccup.severity}</Badge>
                    </div>
                    <p className="text-sm font-bold text-slate-100">{hiccup.title}</p>
                    <p className="mt-1 text-xs text-slate-400 line-clamp-2">{hiccup.detail}</p>
                    <p className="mt-2 text-xs text-emerald-300">{hiccup.recommendedAction}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                      <Link to={hiccup.link} className="min-w-0">
                        <Button size="sm" variant="outline" className="w-full h-10 text-xs border-slate-700">
                          <ExternalLink className="w-3.5 h-3.5 mr-1.5"/>Open
                        </Button>
                      </Link>
                      <Button size="sm" onClick={() => handleAction(hiccup, 'ACKNOWLEDGED')} className="h-10 text-xs bg-amber-600 hover:bg-amber-500">
                        <Check className="w-3.5 h-3.5 mr-1.5"/>Acknowledge
                      </Button>
                      {canManage && <Button size="sm" onClick={() => handleAction(hiccup, 'ESCALATED')} variant="outline" className="h-10 text-xs border-slate-700">
                        <ArrowRight className="w-3.5 h-3.5 mr-1.5"/>Escalate
                      </Button>}
                    </div>
                  </div>
                </div>
              </div>
            )) : <p className="p-5 text-sm text-slate-500 text-center">No open operational hiccups.</p>}
          </CardContent>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 shadow-lg">
          <CardHeader className="p-4 border-b border-slate-800 flex-row justify-between items-center">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock3 className="w-4 h-4 text-sky-400"/>Acknowledged &amp; escalated
            </CardTitle>
            <Badge className={statusColor('ACKNOWLEDGED')}>{acknowledgedHiccups.length + escalatedHiccups.length}</Badge>
          </CardHeader>
          <CardContent className="p-2 space-y-1">
{acknowledgedHiccups.length + escalatedHiccups.length ? [...acknowledgedHiccups, ...escalatedHiccups].map(hiccup => (
              <div key={hiccup.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex gap-2 items-start">
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${statusColor(hiccup.status)}`}/>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="text-[10px] border-slate-700 bg-slate-800 text-slate-400">{categoryLabel(hiccup.category)}</Badge>
                      <Badge className={statusColor(hiccup.status)}>{hiccup.status}</Badge>
                    </div>
                    <p className="text-sm font-bold text-slate-100">{hiccup.title}</p>
                    <p className="mt-1 text-xs text-slate-400 line-clamp-2">{hiccup.detail}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                      <Link to={hiccup.link} className="min-w-0">
                        <Button size="sm" variant="outline" className="w-full h-10 text-xs border-slate-700">
                          <ExternalLink className="w-3.5 h-3.5 mr-1.5"/>Open
                        </Button>
                      </Link>
                      {canManage && <Button size="sm" onClick={() => handleAction(hiccup, 'RESOLVED')} className="h-10 text-xs bg-emerald-600 hover:bg-emerald-500">
                        <Check className="w-3.5 h-3.5 mr-1.5"/>Resolve
                      </Button>}
                    </div>
                  </div>
                </div>
              </div>
            )) : <p className="p-5 text-sm text-slate-500 text-center">No acknowledged or escalated hiccups.</p>}
          </CardContent>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 shadow-lg">
        <CardHeader className="p-4 border-b border-slate-800 flex-row justify-between items-center">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400"/>Resolved hiccups
          </CardTitle>
          <Badge className={statusColor('RESOLVED')}>{resolvedHiccups.length}</Badge>
        </CardHeader>
        <CardContent className="p-2 space-y-1">
          {resolvedHiccups.length ? resolvedHiccups.map(hiccup => (
            <div key={hiccup.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex gap-2 items-start">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${statusColor(hiccup.status)}`}/>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="text-[10px] border-slate-700 bg-slate-800 text-slate-400">{categoryLabel(hiccup.category)}</Badge>
                    <Badge className={statusColor(hiccup.status)}>{hiccup.status}</Badge>
                  </div>
                  <p className="text-sm font-bold text-slate-100">{hiccup.title}</p>
                  <p className="mt-1 text-xs text-slate-400 line-clamp-2">{hiccup.detail}</p>
                  {hiccup.resolvedBy && <p className="mt-1 text-[10px] text-slate-500">Resolved by {hiccup.resolvedBy} · {new Date(hiccup.resolvedAt!).toLocaleDateString()}</p>}
                </div>
              </div>
            </div>
          )) : <p className="p-5 text-sm text-slate-500 text-center">No resolved hiccups yet.</p>}
        </CardContent>
      </section>

      <Dialog open={noteOpen !== null} onOpenChange={(open) => { if (!open) setNoteOpen(null); }}>
        <DialogContent className="max-w-md rounded-2xl bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle>{noteOpen ? `Resolve ${noteOpen.title}` : ''}</DialogTitle>
          </DialogHeader>
          <Separator className="my-4"/>
          <div className="space-y-3">
            <Label>Resolution note</Label>
            <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Describe how this was resolved..." className="h-32 bg-slate-950 border-slate-700"/>
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => { setNoteOpen(null); setNoteText(''); }} variant="outline" className="h-10 border-slate-700">Cancel</Button>
            <Button onClick={handleNoteSubmit} className="h-10 bg-emerald-600 hover:bg-emerald-500">Save resolution</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}