import React, { useState } from 'react';
import { IntakeType, Ticket } from '@/types/scrap';
import { Navbar } from '@/components/layout/Navbar';
import { IntakeModeSelector } from '@/components/intake/IntakeModeSelector';
import { CarIntakeForm } from '@/components/intake/CarIntakeForm';
import { ScrapYardIntakeForm } from '@/components/intake/ScrapYardIntakeForm';
import { ReceiptModal } from '@/components/receipts/ReceiptModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Car, Scale, ArrowLeft } from 'lucide-react';

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
        
        {/* If an intake mode is active, show quick switcher bar */}
        {activeMode !== null && (
          <div className="mb-6 flex items-center justify-between bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetIntake}
              className="text-slate-400 hover:text-white text-xs"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Change Intake Station
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 hidden sm:inline">Active Workspace:</span>
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
