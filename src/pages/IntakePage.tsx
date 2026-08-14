import React, { useState } from 'react';
import { IntakeType, Ticket } from '@/types/scrap';
import { Navbar } from '@/components/layout/Navbar';
import { IntakeModeSelector } from '@/components/intake/IntakeModeSelector';
import { CarIntakeForm } from '@/components/intake/CarIntakeForm';
import { ScrapYardIntakeForm } from '@/components/intake/ScrapYardIntakeForm';
import { MobileScrapTicket } from '@/components/intake/MobileScrapTicket';
import { ReceiptModal } from '@/components/receipts/ReceiptModal';
import { Button } from '@/components/ui/button';
import { Car, Scale, ArrowLeft, Smartphone } from 'lucide-react';
import { PhotoIntakeCard } from '@/components/photo-intake/PhotoIntakeCard';

export default function IntakePage() {
  const [activeMode, setActiveMode] = useState<IntakeType | null>(null);
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const handleTicketCreated = (ticket: Ticket) => {
    setCreatedTicket(ticket);
    setReceiptOpen(true);
  };

  const handleResetIntake = () => {
    setActiveMode(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <PhotoIntakeCard />
        </div>
        
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
                onClick={() => setActiveMode('CAR_SALVAGE')}
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
                onClick={() => setActiveMode('SCRAP_METAL')}
                className={`text-xs font-semibold ${
                  activeMode === 'SCRAP_METAL'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <Scale className="w-3.5 h-3.5 mr-1.5" /> Scrap Yard Intake
              </Button>

              <Button
                variant={activeMode === 'MOBILE_SCRAP' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveMode('MOBILE_SCRAP')}
                className={`shrink-0 text-xs font-semibold ${
                  activeMode === 'MOBILE_SCRAP'
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'border-slate-700 bg-slate-800 text-slate-300'
                }`}
              >
                <Smartphone className="mr-1.5 h-3.5 w-3.5" /> Mobile Fast Intake
              </Button>
            </div>
          </div>
        )}

        {/* View 1: Selector Hub */}
        {activeMode === null && (
          <IntakeModeSelector onSelectMode={(mode) => setActiveMode(mode)} />
        )}

        {/* View 2: Car Salvage Intake Form */}
        {activeMode === 'CAR_SALVAGE' && (
          <CarIntakeForm
            onBack={handleResetIntake}
          />
        )}

        {/* View 3: Standard Scrap Yard Metal Intake Form */}
        {activeMode === 'SCRAP_METAL' && (
          <ScrapYardIntakeForm
            onBack={handleResetIntake}
            onTicketCreated={handleTicketCreated}
          />
        )}

        {/* View 4: Mobile-first single-page scrap intake */}
        {activeMode === 'MOBILE_SCRAP' && (
          <MobileScrapTicket
            onBack={handleResetIntake}
            onTicketCreated={handleTicketCreated}
          />
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
