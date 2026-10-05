import React, { useState, useEffect } from 'react';
import { IntakeType, Ticket } from '@/types/scrap';
import { storageService } from '@/services/storageService';
import { Navbar } from '@/components/layout/Navbar';
import { IntakeModeSelector } from '@/components/intake/IntakeModeSelector';
import { CarIntakeForm } from '@/components/intake/CarIntakeForm';
import { IntakeCollectionForm } from '@/components/intake/IntakeCollectionForm';
import { ScaleWeightLogger } from '@/components/intake/ScaleWeightLogger';
import { StoplightControlPanel } from '@/components/scale/StoplightControlPanel';
import { ReceiptModal } from '@/components/receipts/ReceiptModal';
import { Button } from '@/components/ui/button';
import { Car, Scale, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function IntakePage() {
  const [activeMode, setActiveMode] = useState<IntakeType | null>(null);
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  // Two-part scrap intake: Part 1 collects info & photos, Part 2 weighs IN/OUT.
  const [scrapStage, setScrapStage] = useState<'COLLECT' | 'SCALE'>('COLLECT');
  const [scrapTicketId, setScrapTicketId] = useState<string | null>(null);

  const handleTicketCreated = (ticket: Ticket) => {
    setCreatedTicket(ticket);
    setReceiptOpen(true);
  };

  const handleResetIntake = () => {
    setActiveMode(null);
    setScrapTicketId(null);
  };

  const selectMode = (mode: IntakeType) => {
    if (mode === activeMode) return;
    if (mode === 'SCRAP_METAL') {
      // Returning operators land on the scale desk when open intakes are waiting.
      const hasPending = storageService
        .getTickets()
        .some((t) => t.ticketType === 'SCRAP_METAL' && t.status === 'PENDING');
      setScrapStage(hasPending ? 'SCALE' : 'COLLECT');
      setScrapTicketId(null);
    }
    setActiveMode(mode);
  };

  const handleIntakeSaved = (ticketId: string) => {
    setScrapTicketId(ticketId);
    setScrapStage('SCALE');
  };

  // Cross-workstation sync: when another device (e.g. the iPad) creates a new
  // pending scrap intake, automatically navigate to the scale workstation so
  // the operator can weigh it without manually switching views.
  useEffect(() => {
    const onRemoteSync = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      if (detail?.key !== 'mahaffeys_tickets') return;
      const hasPending = storageService
        .getTickets()
        .some((t) => t.ticketType === 'SCRAP_METAL' && t.status === 'PENDING');
      if (!hasPending) return;
      // Only auto-navigate when the operator isn't already mid-intake.
      if (activeMode === 'SCRAP_METAL' && scrapStage === 'SCALE') return;
      if (activeMode === null) {
        setActiveMode('SCRAP_METAL');
      }
      if (scrapStage !== 'SCALE') {
        setScrapStage('SCALE');
        setScrapTicketId(null);
      }
      toast.info('New pending scrap intake arrived from another workstation', {
        description: 'Switched to the scale workstation to weigh it.',
        duration: 3000,
      });
    };
    window.addEventListener('mahaffeys:remote-sync', onRemoteSync);
    return () => window.removeEventListener('mahaffeys:remote-sync', onRemoteSync);
  }, [activeMode, scrapStage]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* If an intake mode is active, show quick switcher bar */}
        {activeMode !== null && (
          <div className="mb-6 flex items-center gap-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 p-2.5 sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetIntake}
              className="shrink-0 text-xs text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Change Intake Station</span>
            </Button>

            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-slate-400 hidden lg:inline">Active Workspace:</span>
              <Button
                variant={activeMode === 'CAR_SALVAGE' ? 'default' : 'outline'}
                size="sm"
                onClick={() => selectMode('CAR_SALVAGE')}
                className={`text-xs font-semibold ${
                  activeMode === 'CAR_SALVAGE'
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <Car className="w-3.5 h-3.5 mr-1.5" /> Car Intake (Pull-A-Part)
              </Button>

              <Button
                variant={activeMode === 'SCRAP_METAL' ? 'default' : 'outline'}
                size="sm"
                onClick={() => selectMode('SCRAP_METAL')}
                className={`text-xs font-semibold ${
                  activeMode === 'SCRAP_METAL'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <Scale className="w-3.5 h-3.5 mr-1.5" /> Scrap Yard Intake
              </Button>
            </div>
          </div>
        )}

        {/* View 1: Selector Hub */}
        {activeMode === null && (
          <IntakeModeSelector onSelectMode={selectMode} />
        )}

        {/* View 2: Car Salvage Intake Form */}
        {activeMode === 'CAR_SALVAGE' && (
          <CarIntakeForm
            onBack={handleResetIntake}
          />
        )}

        {/* View 3: Scrap intake Part 1 — seller info & photos */}
        {activeMode === 'SCRAP_METAL' && scrapStage === 'COLLECT' && (
          <IntakeCollectionForm
            onBack={handleResetIntake}
            onSaved={handleIntakeSaved}
          />
        )}

        {/* View 4: Scrap intake Part 2 — scale IN/OUT weighing & payout */}
        {activeMode === 'SCRAP_METAL' && scrapStage === 'SCALE' && (
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <ScaleWeightLogger
              onBack={handleResetIntake}
              onNewIntake={() => { setScrapTicketId(null); setScrapStage('COLLECT'); }}
              activeTicketId={scrapTicketId}
              onActiveTicketChange={setScrapTicketId}
              onTicketCreated={handleTicketCreated}
            />
            <StoplightControlPanel />
          </div>
        )}

      </main>

      {/* Printable Receipt Voucher Modal */}
      <ReceiptModal
        ticket={createdTicket}
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
      />
    </div>
  );
}
