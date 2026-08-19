import React, { useEffect, useState } from 'react';
import { scaleService } from '@/services/scaleService';
import { ScaleStatus } from '@/types/scrap';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, RefreshCw, Server, Scale } from 'lucide-react';

interface ScaleConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ScaleConfigModal: React.FC<ScaleConfigModalProps> = ({ open, onOpenChange }) => {
  const [status, setStatus] = useState<ScaleStatus>(scaleService.getStatus());

  useEffect(() => scaleService.subscribe(setStatus), []);

  const handleReconnect = () => {
    scaleService.connectServer();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-800 text-slate-100 rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-emerald-400" />
            <DialogTitle className="text-lg font-bold text-white">
              Rice Lake IQ710 Connection
            </DialogTitle>
          </div>
          <DialogDescription className="text-slate-400 text-xs">
            The scale is read by the Linux server hosting this app. This browser receives the live weight from that server automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className={`rounded-xl border p-4 ${
            status.connected
              ? 'border-emerald-500/50 bg-emerald-950/30'
              : 'border-amber-700/50 bg-amber-950/20'
          }`}>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-slate-950 p-2.5">
                <Server className="h-5 w-5 text-sky-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-white">Hosted server serial port</p>
                  <Badge className={status.connected
                    ? 'border border-emerald-500/40 bg-emerald-950 text-emerald-300'
                    : 'border border-amber-500/40 bg-amber-950 text-amber-300'
                  }>
                    {status.connected ? (
                      <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Connected</span>
                    ) : 'Waiting for scale'}
                  </Badge>
                </div>
                <p className="mt-2 break-all font-mono text-xs text-slate-400">
                  {status.portName || 'Searching the app server for a USB/serial device…'}
                </p>
              </div>
            </div>
          </div>

          {status.errorMessage && (
            <div className="flex items-start gap-2 rounded-xl border border-red-800/60 bg-red-950/50 p-3 text-xs text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <span>{status.errorMessage}</span>
            </div>
          )}

          <p className="text-xs leading-relaxed text-slate-400">
            The server is configured for RS-232 ports /dev/ttyS4 through /dev/ttyS7. Select the connected port with
            <span className="mx-1 font-mono text-sky-300">SCALE_SERIAL_PORT</span>
            and the IQ710 baud rate with
            <span className="ml-1 font-mono text-sky-300">SCALE_SERIAL_BAUD_RATE</span>.
          </p>
        </div>

        <DialogFooter className="gap-2 border-t border-slate-800 pt-3 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleReconnect}
            className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Check connection
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-emerald-600 font-bold text-white hover:bg-emerald-500"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
