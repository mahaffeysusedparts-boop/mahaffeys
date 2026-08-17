import { Printer, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { VehicleSticker, VehicleStickerData } from './VehicleSticker';

interface PrintStickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: VehicleStickerData | null;
}

export const PrintStickerModal = ({ open, onOpenChange, vehicle }: PrintStickerModalProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="vehicle-sticker-dialog max-h-[92vh] overflow-y-auto rounded-3xl border-slate-700 bg-slate-950 p-0 text-white shadow-2xl sm:max-w-[560px]">
      <DialogHeader className="print:hidden border-b border-slate-800 px-6 py-5 pr-12">
        <DialogTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
          <span className="flex size-9 items-center justify-center rounded-xl bg-amber-400 text-slate-950">
            <QrCode className="size-5" />
          </span>
          Windshield Sticker Preview
        </DialogTitle>
        <DialogDescription className="text-slate-400">
          The printed sticker will match this preview and the QR code will contain the VIN.
        </DialogDescription>
      </DialogHeader>

      {vehicle ? (
        <div className="vehicle-sticker-print-container bg-slate-900 px-4 py-6 sm:px-8">
          <VehicleSticker vehicle={vehicle} />
        </div>
      ) : null}

      <DialogFooter className="print:hidden border-t border-slate-800 px-6 py-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="rounded-xl border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
        >
          Close
        </Button>
        <Button
          type="button"
          onClick={() => window.print()}
          disabled={!vehicle}
          className="rounded-xl bg-amber-400 font-black text-slate-950 shadow-lg shadow-amber-950/40 hover:bg-amber-300"
        >
          <Printer className="mr-2 size-4" />
          Print Sticker
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
