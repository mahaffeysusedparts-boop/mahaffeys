import React, { useState } from 'react';
import { scaleService } from '@/services/scaleService';
import { storageService } from '@/services/storageService';
import { ScaleConnectionMode } from '@/types/scrap';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Scale, Cpu, Wifi, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ScaleConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ScaleConfigModal: React.FC<ScaleConfigModalProps> = ({ open, onOpenChange }) => {
  const currentStatus = scaleService.getStatus();
  const settings = storageService.getSettings();

  const [mode, setMode] = useState<ScaleConnectionMode>(currentStatus.mode || 'WEB_SERIAL');
  const [baudRate, setBaudRate] = useState<number>(settings.serialBaudRate || 9600);
  const [wsUrl, setWsUrl] = useState<string>(settings.webSocketUrl || 'ws://localhost:8080/scale');
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    setLoading(true);

    if (mode === 'WEB_SERIAL') {
      const success = await scaleService.connectWebSerial(baudRate);
      if (success) {
        toast.success('Connected to Web Serial Scale Port');
        const updated = storageService.getSettings();
        updated.serialBaudRate = baudRate;
        storageService.saveSettings(updated);
        onOpenChange(false);
      } else {
        toast.error('Could not connect serial scale. Check connection or USB port.');
      }
    } else if (mode === 'WEBSOCKET') {
      const success = scaleService.connectWebSocket(wsUrl);
      if (success) {
        toast.success(`Subscribed to scale network endpoint ${wsUrl}`);
        const updated = storageService.getSettings();
        updated.webSocketUrl = wsUrl;
        storageService.saveSettings(updated);
        onOpenChange(false);
      } else {
        toast.error('WebSocket scale endpoint unreachable.');
      }
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-800 text-slate-100">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-emerald-400" />
            <DialogTitle className="text-lg font-bold text-white">
              Scale Hardware Connectivity
            </DialogTitle>
          </div>
          <DialogDescription className="text-slate-400 text-xs">
            Connect an industrial RS-232 / USB scale indicator via Web Serial or a network scale server stream.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Mode Selection */}
          <RadioGroup value={mode} onValueChange={(val) => setMode(val as ScaleConnectionMode)} className="space-y-3">
            
            {/* Option 1: Web Serial API */}
            <div
              className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                mode === 'WEB_SERIAL'
                  ? 'bg-emerald-950/40 border-emerald-500/60 text-white'
                  : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/80 text-slate-300'
              }`}
              onClick={() => setMode('WEB_SERIAL')}
            >
              <RadioGroupItem value="WEB_SERIAL" id="mode-serial" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mode-serial" className="font-semibold text-sm cursor-pointer flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-blue-400" /> USB / Serial Port Scale (Web Serial)
                  </Label>
                  <Badge variant="outline" className="border-blue-500/40 text-blue-400 text-[10px]">
                    DIRECT HARDWARE
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Direct connection to Rice Lake, Avery Weigh-Tronix, GSE, or Cardinal scale indicators via USB-to-Serial COM port.
                </p>

                {mode === 'WEB_SERIAL' && (
                  <div className="mt-3 grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                    <div>
                      <Label className="text-[11px] text-slate-300">Baud Rate</Label>
                      <Input
                        type="number"
                        value={baudRate}
                        onChange={(e) => setBaudRate(parseInt(e.target.value) || 9600)}
                        className="h-8 bg-slate-900 border-slate-700 text-xs text-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Option 2: WebSocket Feed */}
            <div
              className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                mode === 'WEBSOCKET'
                  ? 'bg-emerald-950/40 border-emerald-500/60 text-white'
                  : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/80 text-slate-300'
              }`}
              onClick={() => setMode('WEBSOCKET')}
            >
              <RadioGroupItem value="WEBSOCKET" id="mode-ws" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mode-ws" className="font-semibold text-sm cursor-pointer flex items-center gap-1.5">
                    <Wifi className="w-4 h-4 text-purple-400" /> Network Scale Feed (WebSocket / TCP)
                  </Label>
                  <Badge variant="outline" className="border-purple-500/40 text-purple-400 text-[10px]">
                    LOCAL NETWORK
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Connect to a yard scale server or network scale adapter streaming JSON or ASCII strings on your local LAN.
                </p>

                {mode === 'WEBSOCKET' && (
                  <div className="mt-3 pt-2 border-t border-slate-800">
                    <Label className="text-[11px] text-slate-300">Scale WebSocket Endpoint URL</Label>
                    <Input
                      value={wsUrl}
                      onChange={(e) => setWsUrl(e.target.value)}
                      placeholder="ws://192.168.1.100:8080/scale"
                      className="h-8 bg-slate-900 border-slate-700 text-xs text-white"
                    />
                  </div>
                )}
              </div>
            </div>

          </RadioGroup>

          {/* Current Scale Error Message if any */}
          {currentStatus.errorMessage && (
            <div className="p-3 bg-red-950/60 border border-red-800/60 rounded-lg flex items-center gap-2 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{currentStatus.errorMessage}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 border-t border-slate-800 pt-3">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-slate-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
          >
            {loading ? 'Connecting...' : 'Apply & Connect Scale'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};