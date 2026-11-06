import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type { IntakeType, Ticket } from '@/types/scrap';
import { scrapBuyingService } from '@/services/scrapBuyingService';
import { Navbar } from '@/components/layout/Navbar';
import { IntakeModeSelector, IntakeWorkspaceNavigation, type IntakeEntry } from '@/components/intake/IntakeModeSelector';
import { CarIntakeForm } from '@/components/intake/CarIntakeForm';
import { IntakeCollectionForm } from '@/components/intake/IntakeCollectionForm';
import { ScaleWeightLogger } from '@/components/intake/ScaleWeightLogger';
import { StoplightControlPanel } from '@/components/scale/StoplightControlPanel';
import { ReceiptModal } from '@/components/receipts/ReceiptModal';
import { Button } from '@/components/ui/button';

export default function IntakePage() {
  const { user } = useAuth();
  return <IntakeWorkspace key={user?.id ?? 'signed-out'}/>;
}

function IntakeWorkspace() {
  const { user } = useAuth();
  const workspaceKey = `intake-workspace:${user?.id}`;
  const [workspace, setWorkspace] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(workspaceKey) || '{}');
      return {
        mode: saved.mode === 'CAR_SALVAGE' || saved.mode === 'SCRAP_METAL' ? saved.mode as IntakeType : null,
        stage: saved.stage === 'SCALE' ? 'SCALE' as const : 'COLLECT' as const,
        ticketId: typeof saved.ticketId === 'string' ? saved.ticketId : null,
      };
    } catch { return { mode: null, stage: 'COLLECT' as const, ticketId: null }; }
  });
  const [activeMode, setActiveMode] = useState<IntakeType | null>(null);
  const [scrapStage, setScrapStage] = useState<'COLLECT' | 'SCALE'>('COLLECT');
  const [scrapTicketId, setScrapTicketId] = useState<string | null>(null);
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const queue = useQuery({ queryKey: ['scrap-buying-queue'], queryFn: () => scrapBuyingService.queue(), refetchInterval: 5000, staleTime: 15000 });
  const queueVerified = !!queue.data?.capacity && !queue.isError && !queue.isStale;
  useEffect(() => {
    // Home is a presentation choice, not deletion of resumable workspace metadata.
    if (!user || !activeMode) return;
    const saved = { mode: activeMode, stage: scrapStage, ticketId: scrapTicketId };
    setWorkspace(saved);
    try { localStorage.setItem(workspaceKey, JSON.stringify(saved)); }
    catch { /* IndexedDB form drafts remain independent. */ }
  }, [workspaceKey, user, activeMode, scrapStage, scrapTicketId]);

  const enter = (entry: IntakeEntry) => {
    if (entry === 'HOME') { setActiveMode(null); return; }
    if (entry === 'VEHICLE') { setActiveMode('CAR_SALVAGE'); return; }
    if (activeMode === 'SCRAP_METAL' && scrapStage === entry) return;
    setScrapTicketId(null);
    setScrapStage(entry);
    setActiveMode('SCRAP_METAL');
  };
  const resume = () => {
    setScrapStage(workspace.stage); setScrapTicketId(workspace.ticketId); setActiveMode(workspace.mode);
  };
  const navigation = (disabled: boolean) => <IntakeWorkspaceNavigation disabled={disabled} current={activeMode === 'CAR_SALVAGE' ? 'VEHICLE' : scrapStage} onEntry={enter}/>;
  const home = () => enter('HOME');

  return <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
    <Navbar/>
    <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {activeMode === null && <>
        <IntakeModeSelector onEntry={enter} queueCount={queue.data?.capacity?.openCount} queueState={queue.isPending ? 'loading' : queueVerified ? 'confirmed' : 'unverified'}/>
        {workspace.mode && <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-900 p-4"><Button onClick={resume} className="min-h-11 rounded-xl bg-teal-800 text-white hover:bg-teal-700">Resume previous workspace</Button><p className="mt-2 text-xs text-slate-300">{workspace.mode === 'CAR_SALVAGE' ? 'Vehicle intake' : workspace.stage === 'SCALE' ? `Scale queue${workspace.ticketId ? ` · #${workspace.ticketId}` : ''}` : 'Scrap collection'} · saved inputs require explicit draft recovery.</p></div>}
        <nav aria-label="Intake utilities" className="mt-6 flex flex-wrap gap-4 text-sm text-sky-200"><Link to="/bin-inspection" className="rounded-lg p-2 underline focus-visible:ring-2 focus-visible:ring-sky-300">Bin Inspection →</Link><Link to="/cash-drawer" className="rounded-lg p-2 underline focus-visible:ring-2 focus-visible:ring-sky-300">Unpaid purchases / receipt copies</Link></nav>
      </>}
      {activeMode === 'CAR_SALVAGE' && <CarIntakeForm onBack={home} workspaceNavigation={navigation}/>}
      {activeMode === 'SCRAP_METAL' && scrapStage === 'COLLECT' && <IntakeCollectionForm onBack={home} onSaved={id => { setScrapTicketId(id); setScrapStage('SCALE'); }} onOpenQueue={() => enter('SCALE')} workspaceNavigation={navigation}/>}
      {activeMode === 'SCRAP_METAL' && scrapStage === 'SCALE' && <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <ScaleWeightLogger onBack={home} onNewIntake={() => enter('COLLECT')} activeTicketId={scrapTicketId} onActiveTicketChange={setScrapTicketId} onTicketCreated={ticket => { setCreatedTicket(ticket); setReceiptOpen(true); }} workspaceNavigation={navigation}/>
        <StoplightControlPanel/>
      </div>}
    </main>
    <ReceiptModal ticket={createdTicket} open={receiptOpen} onOpenChange={setReceiptOpen}/>
  </div>;
}
