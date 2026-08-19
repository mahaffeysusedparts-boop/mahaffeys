import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, Cable, CheckCircle2, Radio, RefreshCw, Save, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ScaleAdminSnapshot {
  ports: string[];
  supportedBaudRates: number[];
  config: {
    path: string;
    baudRate: number;
  };
  status: {
    connected: boolean;
    weight: number;
    unit: "LBS" | "KG";
    isStable: boolean;
    portName?: string;
    baudRate: number;
    scanning: boolean;
    errorMessage?: string;
    updatedAt?: string;
  };
  checkedAt: string;
}

async function readError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { statusMessage?: string; message?: string } | null;
  return body?.statusMessage || body?.message || fallback;
}

export function ScaleServerManager() {
  const [snapshot, setSnapshot] = useState<ScaleAdminSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedPort, setSelectedPort] = useState("");
  const [selectedBaudRate, setSelectedBaudRate] = useState<number | null>(null);
  const [sample, setSample] = useState<string | null>(null);

  const loadScale = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/admin/scale", { credentials: "include" });
      if (!response.ok) throw new Error(await readError(response, "Unable to inspect serial ports"));
      const nextSnapshot = await response.json() as ScaleAdminSnapshot;
      setSnapshot(nextSnapshot);
      setSelectedPort((current) => current || nextSnapshot.config.path);
      setSelectedBaudRate((current) => current || nextSnapshot.config.baudRate);
    } catch (error) {
      if (!quiet) toast.error("Scale status unavailable", { description: error instanceof Error ? error.message : "Unknown server error" });
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadScale();
    const interval = window.setInterval(() => void loadScale(true), 5_000);
    return () => window.clearInterval(interval);
  }, [loadScale]);

  const scanForScale = async () => {
    setScanning(true);
    setSample(null);
    try {
      const response = await fetch("/api/admin/scale/scan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error(await readError(response, "No scale input was detected"));
      const result = await response.json() as {
        config: ScaleAdminSnapshot["config"];
        sample: string;
      };
      setSelectedPort(result.config.path);
      setSelectedBaudRate(result.config.baudRate);
      setSample(result.sample);
      toast.success("IQ710 detected and activated", {
        description: `${result.config.path} at ${result.config.baudRate} baud`,
      });
      await loadScale(true);
    } catch (error) {
      toast.error("Automatic scale setup failed", {
        description: error instanceof Error ? error.message : "Unknown server error",
      });
      await loadScale(true);
    } finally {
      setScanning(false);
    }
  };

  const saveManualSelection = async () => {
    if (!selectedPort || !selectedBaudRate) return;
    setSaving(true);
    setSample(null);
    try {
      const response = await fetch("/api/admin/scale/config", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selectedPort, baudRate: selectedBaudRate }),
      });
      if (!response.ok) throw new Error(await readError(response, "Could not activate the selected port"));
      toast.success("Scale port activated", { description: `${selectedPort} at ${selectedBaudRate} baud` });
      await loadScale(true);
    } catch (error) {
      toast.error("Scale configuration failed", {
        description: error instanceof Error ? error.message : "Unknown server error",
      });
    } finally {
      setSaving(false);
    }
  };

  const hasRecentReading = snapshot?.status.updatedAt
    ? Date.now() - new Date(snapshot.status.updatedAt).getTime() < 15_000
    : false;

  return (
    <section className="mt-5">
      <Card className="overflow-hidden rounded-3xl border-slate-800 bg-slate-900 text-slate-100 shadow-xl">
        <CardHeader className="gap-4 border-b border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Radio className="h-5 w-5 text-emerald-400" /> IQ710 scale input
            </CardTitle>
            <p className="mt-1 text-xs text-slate-500">Automatically detect the scale or manually select an exposed server port and baud rate.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void loadScale()} disabled={loading || scanning || saving} variant="outline" className="rounded-xl border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh ports
            </Button>
            <Button onClick={() => void scanForScale()} disabled={loading || scanning || saving || !snapshot?.ports.length} className="rounded-xl bg-emerald-500 font-bold text-slate-950 hover:bg-emerald-400">
              <ScanSearch className={`mr-2 h-4 w-4 ${scanning ? "animate-pulse" : ""}`} />
              {scanning ? "Listening to ports…" : "Auto-detect IQ710"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 p-5 sm:p-6">
          {scanning ? (
            <div className="flex gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-100">
              <Activity className="mt-0.5 h-5 w-5 shrink-0 animate-pulse text-sky-400" />
              <div><strong>Automatic detection is running.</strong> The server is listening on each serial port at 2400, 9600, 4800, and 19200 baud. This can take about 30 seconds.</div>
            </div>
          ) : snapshot?.status.errorMessage ? (
            <div className="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <span>{snapshot.status.errorMessage}</span>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Active server connection</p>
                  <p className="mt-2 font-mono text-lg font-bold text-white">{snapshot?.config.path || "Not configured"}</p>
                  <p className="mt-1 text-sm text-slate-400">{snapshot?.config.baudRate || 2400} baud · 8 data bits · no parity · 1 stop bit</p>
                </div>
                <Badge className={`rounded-full border ${hasRecentReading ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" : "border-slate-600 bg-slate-800 text-slate-300"}`}>
                  {hasRecentReading ? <><CheckCircle2 className="mr-1 h-3 w-3" /> Receiving weight</> : "Waiting for data"}
                </Badge>
              </div>

              <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-950/20 px-4 py-5 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400/70">Live server reading</p>
                <p className="mt-1 font-mono text-4xl font-black tracking-tight text-emerald-300">
                  {(snapshot?.status.weight || 0).toLocaleString()} <span className="text-lg text-emerald-500">{snapshot?.status.unit || "LBS"}</span>
                </p>
              </div>

              {sample ? (
                <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-400">Detected serial sample</p>
                  <p className="mt-1 break-all font-mono text-xs text-emerald-100">{sample}</p>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Cable className="h-4 w-4 text-sky-400" />
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Manual port selection</p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Server port</Label>
                  <Select value={selectedPort} onValueChange={setSelectedPort} disabled={scanning || saving}>
                    <SelectTrigger className="rounded-xl border-slate-700 bg-slate-900 font-mono text-slate-100">
                      <SelectValue placeholder="Choose a port" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-700 bg-slate-900 text-slate-100">
                      {snapshot?.ports.map((port) => <SelectItem key={port} value={port} className="font-mono">{port}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Baud rate</Label>
                  <Select value={selectedBaudRate?.toString() || ""} onValueChange={(value) => setSelectedBaudRate(Number(value))} disabled={scanning || saving}>
                    <SelectTrigger className="rounded-xl border-slate-700 bg-slate-900 text-slate-100">
                      <SelectValue placeholder="Choose baud" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-700 bg-slate-900 text-slate-100">
                      {snapshot?.supportedBaudRates.map((baudRate) => <SelectItem key={baudRate} value={baudRate.toString()}>{baudRate}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={() => void saveManualSelection()} disabled={!selectedPort || !selectedBaudRate || scanning || saving} className="mt-3 w-full rounded-xl bg-sky-500 font-bold text-slate-950 hover:bg-sky-400">
                <Save className={`mr-2 h-4 w-4 ${saving ? "animate-pulse" : ""}`} />
                {saving ? "Activating port…" : "Use selected port"}
              </Button>

              <div className="mt-5 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Ports exposed to Docker</p>
                {snapshot?.ports.length ? snapshot.ports.map((port) => (
                  <button key={port} type="button" onClick={() => setSelectedPort(port)} disabled={scanning || saving} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors ${port === snapshot.config.path ? "border-emerald-500/40 bg-emerald-500/10" : port === selectedPort ? "border-sky-500/40 bg-sky-500/10" : "border-slate-700 bg-slate-900 hover:border-slate-600"}`}>
                    <span className="font-mono text-sm text-slate-200">{port}</span>
                    {port === snapshot.config.path ? <Badge className="rounded-full bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15">Active</Badge> : port === selectedPort ? <span className="text-xs text-sky-300">Chosen</span> : <span className="text-xs text-slate-600">Available</span>}
                  </button>
                )) : (
                  <div className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-sm text-slate-500">No serial ports are available inside the app container.</div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
