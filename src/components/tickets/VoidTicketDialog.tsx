import React, { useEffect, useState } from 'react';
import { Ticket } from '@/types/scrap';
import { storageService } from '@/services/storageService';
import { useAuth } from '@/context/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Ban, Lock, Scale as ScaleIcon, Car, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

const VOID_REASONS = ['Seller left', 'Load refused', 'Entry error', 'Duplicate', 'Other'] as const;

interface VoidTicketDialogProps {
  ticket: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the ticket is successfully voided (e.g. clear the scale desk). */
  onVoided?: (ticketId: string) => void;
}

/**
 * Safe, auditable void for a transaction at ANY stage — queued pending,
 * mid-weigh (IN logged), or completed/paid. Paid tickets require a supervisor
 * (yard manager or admin) and warn that the payout itself is not reversed.
 */
export const VoidTicketDialog: React.FC<VoidTicketDialogProps> = ({ ticket, open, onOpenChange, onVoided }) => {
  const { user } = useAuth();
  const [reason, setReason] = useState<string>('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
      setNote('');
    }
  }, [open, ticket?.id]);

  if (!ticket) return null;

  const isPaid = ticket.status === 'COMPLETED';
  const canVoidPaid = user?.role === 'admin' || user?.role === 'yard_manager';
  const locked = isPaid && !canVoidPaid;
  const hasWeighData = ticket.scaleGrossInWeight != null || (ticket.scrapLines?.length ?? 0) > 0;
  const isOther = reason === 'Other';
  const noteRequiredMissing = isOther && !note.trim();
  const canConfirm = Boolean(reason) && !noteRequiredMissing && !locked;

  const handleConfirm = () => {
    if (!canConfirm) return;
    const fullReason = note.trim() ? `${reason} — ${note.trim()}` : reason;
    const voided = storageService.voidTicket(ticket.id, {
      by: user?.fullName || user?.username || 'Unknown operator',
      reason: fullReason,
    });
    if (!voided) {
      toast.error(`Ticket #${ticket.id} could not be found — it may have been removed`);
      onOpenChange(false);
      return;
    }
    toast.success(`Ticket #${ticket.id} voided`, { description: fullReason });
    onVoided?.(ticket.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(busy) => !busy && onOpenChange(false)}>
      <DialogContent className="border-red-500/30 bg-slate-950 text-slate-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Ban className="h-5 w-5 text-red-400" /> Void Transaction #{ticket.id}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            The ticket is kept in the ledger for audit — it is excluded from payouts, reports, and metrics.
          </DialogDescription>
        </DialogHeader>

        {/* Ticket summary strip */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs">
          <Badge className="gap-1 border-slate-700 bg-slate-950 text-[10px] text-slate-300">
            {ticket.ticketType === 'CAR_SALVAGE' ? <Car className="h-3 w-3 text-amber-400" /> : <ScaleIcon className="h-3 w-3 text-emerald-400" />}
            {ticket.ticketType === 'CAR_SALVAGE' ? 'Car Salvage' : 'Scrap Metal'}
          </Badge>
          <span className="font-bold text-white">{ticket.customerName}</span>
          {ticket.status === 'COMPLETED' ? (
            <Badge className="border-emerald-500/40 bg-emerald-950 text-[10px] text-emerald-300">PAID ${ticket.finalPayout.toFixed(2)}</Badge>
          ) : (
            <Badge className="border-amber-500/40 bg-amber-950 text-[10px] text-amber-300">{ticket.status}</Badge>
          )}
        </div>

        {/* Context-aware warnings */}
        {locked ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-950/30 px-3 py-2.5 text-xs text-amber-200">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p>
              This ticket was already paid out — a <strong>yard manager or administrator</strong> must void it.
              Ask a supervisor to complete this void.
            </p>
          </div>
        ) : isPaid ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-950/30 px-3 py-2.5 text-xs text-amber-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p>
              <strong>This ticket was already paid out.</strong> Voiding does not reverse the payment — record a
              cash drawer adjustment if money was handed out.
            </p>
          </div>
        ) : hasWeighData ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/40 bg-sky-950/30 px-3 py-2.5 text-xs text-sky-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
            <p>Weights already logged on this ticket stay in the weight journal for audit — only the payout is cancelled.</p>
          </div>
        ) : null}

        {/* Reason picker */}
        <div className="space-y-2.5">
          <p className="text-xs font-bold text-slate-200">Reason for voiding <span className="text-red-400">*</span></p>
          <div className="flex flex-wrap gap-2">
            {VOID_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.97] ${
                  reason === r
                    ? 'border-red-500 bg-red-950/70 text-red-200 ring-1 ring-red-500/40'
                    : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isOther ? 'Describe the reason (required)...' : 'Optional detail note...'}
            rows={2}
            className="border-slate-800 bg-slate-900 text-xs text-white placeholder:text-slate-500"
          />
        </div>

        <DialogFooter className="gap-2 border-t border-slate-800 pt-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-xs text-slate-400 hover:text-white">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="gap-1.5 bg-red-600 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-40"
          >
            <Ban className="h-4 w-4" /> Void Transaction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
