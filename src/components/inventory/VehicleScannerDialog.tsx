import { useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { useNavigate } from 'react-router-dom';
import { Camera, ScanLine, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseVehicleCode } from '@/utils/vehicleRecords';
import { resolveVehicleCode } from '@/services/vehicleRecordService';

export function VehicleScannerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const locked = useRef(false);
  const generation = useRef(0);
  const [camera, setCamera] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const openCode = async (code: string) => {
    if (locked.current) return;
    const identifier = parseVehicleCode(code);
    if (!identifier) { setError('Use a vehicle window tag, VIN, or vehicle record ID. Other QR links are not opened.'); return; }
    locked.current = true;
    setBusy(true);
    setError('');
    const currentGeneration = generation.current;
    try {
      const match = await resolveVehicleCode(identifier);
      if (currentGeneration !== generation.current) return;
      controls.current?.stop();
      onOpenChange(false);
      navigate(`/yard-vehicles/${encodeURIComponent(match.id)}`);
    } catch (reason) {
      if (currentGeneration === generation.current) {
        setError(reason instanceof Error ? reason.message : 'Unable to open this tag.');
        setCamera(false);
      }
    } finally {
      if (currentGeneration === generation.current) { locked.current = false; setBusy(false); }
    }
  };

  useEffect(() => {
    generation.current += 1;
    locked.current = false;
    setBusy(false);
    if (!open) { setCamera(false); setError(''); return; }
    setValue('');
    return () => { generation.current += 1; controls.current?.stop(); controls.current = null; };
  }, [open]);

  useEffect(() => {
    if (!open || !camera || !video.current) return;
    let cancelled = false;
    const reader = new BrowserQRCodeReader();
    reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } }, audio: false }, video.current, result => {
      if (result && !cancelled) void openCode(result.getText());
    }).then(scanner => {
      if (cancelled) scanner.stop(); else controls.current = scanner;
    }).catch(reason => {
      if (!cancelled) { setError(`Camera unavailable: ${reason instanceof Error ? reason.message : 'permission denied'}. Allow camera access or enter the VIN below.`); setCamera(false); }
    });
    return () => { cancelled = true; controls.current?.stop(); controls.current = null; };
  }, [open, camera]);

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg rounded-3xl border-slate-700 bg-slate-900 text-slate-100">
      <DialogHeader><DialogTitle className="flex items-center gap-2 text-xl"><ScanLine className="text-emerald-400" /> Scan a vehicle tag</DialogTitle><DialogDescription className="text-slate-300">Open the exact record, location, history, and available yard actions.</DialogDescription></DialogHeader>
      <div className="relative grid min-h-48 place-items-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
        {camera ? <video ref={video} autoPlay muted playsInline className="max-h-72 w-full object-cover" /> : <div className="p-6 text-center"><ScanLine className="mx-auto mb-3 size-14 text-emerald-400" /><p className="text-sm text-slate-300">Point your camera at the QR code on the window tag.</p></div>}
      </div>
      <Button disabled={busy} onClick={() => setCamera(!camera)} className="rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700"><Camera className="mr-2 size-4" />{camera ? 'Stop camera' : 'Start camera'}</Button>
      <form onSubmit={event => { event.preventDefault(); void openCode(value); }} className="space-y-3 border-t border-slate-700 pt-4">
        <Label htmlFor="vehicle-code" className="text-slate-200">Or enter a VIN, record ID, or pasted tag link</Label>
        <Input id="vehicle-code" value={value} onChange={event => setValue(event.target.value)} placeholder="VIN or vehicle tag URL" className="rounded-xl border-slate-700 bg-slate-950 text-white" />
        {error && <p role="alert" className="rounded-xl bg-rose-950 p-3 text-sm text-rose-200">{error}</p>}
        <Button type="submit" disabled={busy || !value.trim()} className="w-full rounded-xl bg-sky-600 font-bold text-white hover:bg-sky-700">{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Open vehicle record</Button>
      </form>
    </DialogContent>
  </Dialog>;
}
