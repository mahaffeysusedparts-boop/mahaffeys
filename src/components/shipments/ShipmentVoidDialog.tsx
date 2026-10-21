import { useState } from 'react';
import { Ban } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { shipmentService } from '@/services/shipmentService';
import type { OutboundShipment } from '@/types/scrap';

export function ShipmentVoidDialog({ shipment, onCancel, onVoided }: { shipment: OutboundShipment; onCancel: () => void; onVoided: () => void }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  // Keep the reviewed record fixed while the confirmation is open.
  const [reviewedShipment] = useState(shipment);
  const confirm = async () => {
    if (saving || !reason.trim()) return;
    setSaving(true);
    try {
      await shipmentService.void(reviewedShipment, reason.trim());
      toast.success(`Shipment ${shipment.loadNumber} voided; history retained`);
      onVoided();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Void was not confirmed');
    } finally { setSaving(false); }
  };
  return <Dialog open onOpenChange={open => !open && !saving && onCancel()}>
    <DialogContent className="max-w-lg rounded-3xl border-rose-800 bg-slate-900 text-slate-100">
      <DialogHeader><DialogTitle className="flex items-center gap-2 text-xl font-bold"><Ban className="h-5 w-5 text-rose-300" />Void shipment {shipment.loadNumber}</DialogTitle></DialogHeader>
      <p className="rounded-2xl border border-rose-800 bg-rose-950 p-4 text-sm leading-relaxed text-rose-100">This removes the load from active work and shipment revenue totals. Its grades, weights and original mill payment stay in the history. This does not refund money or undo a physical shipment.</p>
      <div className="space-y-2"><Label htmlFor="shipment-void-reason">Reason for voiding · required</Label><Textarea id="shipment-void-reason" value={reason} onChange={event => setReason(event.target.value)} maxLength={500} disabled={saving} placeholder="Explain why this shipment should be voided…" className="min-h-28 rounded-xl border-slate-600 bg-slate-950 text-white" /></div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button onClick={onCancel} disabled={saving} variant="outline" className="rounded-xl border-slate-600 bg-slate-950">Keep shipment</Button><Button onClick={confirm} disabled={saving || !reason.trim()} className="rounded-xl bg-rose-700 text-white hover:bg-rose-600">{saving ? 'Voiding…' : 'Confirm void shipment'}</Button></div>
    </DialogContent>
  </Dialog>;
}
