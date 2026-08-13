import { useCallback, useEffect, useState } from "react";
import { Activity, Cpu, Database, HardDrive, RefreshCw, RotateCw, Server, Terminal } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { StorageBayManager } from "@/components/server/StorageBayManager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface ServerSnapshot {
  service: {
    name: string;
    status: string;
    manager: string;
    pid: number;
    processUptimeSeconds: number;
    nodeVersion: string;
    environment: string;
  };
  host: {
    hostname: string;
    uptimeSeconds: number;
    cpuCount: number;
    loadAverage: number[];
    memoryTotal: number;
    memoryUsed: number;
    diskTotal: number;
    diskUsed: number;
  };
  logs: {
    output: string[];
    errors: string[];
    available: boolean;
  };
  checkedAt: string;
}

const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return "0 GB";
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
};

const formatDuration = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days > 0 ? `${days}d ${hours}h` : `${hours}h ${minutes}m`;
};

const usagePercent = (used: number, total: number) => total > 0 ? Math.round((used / total) * 100) : 0;

export default function ServerAdminPage() {
  const [snapshot, setSnapshot] = useState<ServerSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/admin/server", { credentials: "include" });
      if (!response.ok) throw new Error(response.status === 403 ? "Administrator access required" : "Unable to read server status");
      setSnapshot(await response.json() as ServerSnapshot);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to read server status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const restartService = async () => {
    setRestarting(true);
    try {
      const response = await fetch("/api/admin/server/restart", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { statusMessage?: string } | null;
        throw new Error(body?.statusMessage || "Restart request failed");
      }
      toast.success("Restart requested", { description: "Mahaffeys should be available again in a few seconds." });
      window.setTimeout(() => {
        setRestarting(false);
        void loadStatus();
      }, 8000);
    } catch (restartError) {
      setRestarting(false);
      toast.error("Could not restart service", {
        description: restartError instanceof Error ? restartError.message : "Unknown server error",
      });
    }
  };

  const memoryPercent = snapshot ? usagePercent(snapshot.host.memoryUsed, snapshot.host.memoryTotal) : 0;
  const diskPercent = snapshot ? usagePercent(snapshot.host.diskUsed, snapshot.host.diskTotal) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="mb-6 overflow-hidden rounded-3xl border border-emerald-500/20 bg-slate-900 p-5 shadow-2xl shadow-emerald-950/20 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-400 ring-1 ring-emerald-500/25">
                <Server className="h-7 w-7" />
              </div>
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Server control room</h1>
                  <Badge className="rounded-full bg-amber-400 px-2.5 text-slate-950 hover:bg-amber-400">Admin only</Badge>
                </div>
                <p className="max-w-2xl text-sm leading-6 text-slate-400">
                  Live health, storage, runtime logs, and guarded service controls for 192.168.1.210.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void loadStatus()} disabled={loading || restarting} variant="outline" className="rounded-xl border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white">
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={restarting} className="rounded-xl bg-amber-400 font-bold text-slate-950 hover:bg-amber-300">
                    <RotateCw className={`mr-2 h-4 w-4 ${restarting ? "animate-spin" : ""}`} />
                    {restarting ? "Restarting" : "Restart service"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-3xl border-slate-700 bg-slate-900 text-slate-100">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Restart Mahaffeys?</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-400">
                      Active requests may pause briefly while PM2 or systemd brings the service back online.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl border-slate-700 bg-slate-800 text-white hover:bg-slate-700 hover:text-white">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void restartService()} className="rounded-xl bg-amber-400 font-bold text-slate-950 hover:bg-amber-300">Restart now</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-200">{error}</div>
        ) : null}

        {snapshot ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard icon={Activity} label="Service" value={snapshot.service.status} detail={`${snapshot.service.manager} · PID ${snapshot.service.pid}`} accent="emerald" />
              <MetricCard icon={Cpu} label="Host uptime" value={formatDuration(snapshot.host.uptimeSeconds)} detail={`${snapshot.host.cpuCount} CPU cores · load ${snapshot.host.loadAverage[0].toFixed(2)}`} accent="sky" />
              <MetricCard icon={Database} label="Memory" value={`${memoryPercent}% used`} detail={`${formatBytes(snapshot.host.memoryUsed)} of ${formatBytes(snapshot.host.memoryTotal)}`} accent="violet" />
              <MetricCard icon={HardDrive} label="App disk" value={`${diskPercent}% used`} detail={`${formatBytes(snapshot.host.diskUsed)} of ${formatBytes(snapshot.host.diskTotal)}`} accent="amber" />
            </section>

            <StorageBayManager />

            <Card className="mt-5 rounded-3xl border-slate-800 bg-slate-900 text-slate-100 shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg"><Terminal className="h-5 w-5 text-emerald-400" /> Recent application logs</CardTitle>
                  <p className="mt-1 text-xs text-slate-500">Last 200 PM2 output and error lines · refreshed {new Date(snapshot.checkedAt).toLocaleTimeString()}</p>
                </div>
                <Badge variant="outline" className="rounded-full border-slate-700 text-slate-300">{snapshot.service.nodeVersion}</Badge>
              </CardHeader>
              <CardContent className="p-0">
                {snapshot.logs.available ? (
                  <div className="max-h-[520px] overflow-auto bg-slate-950 p-4 font-mono text-xs leading-5">
                    {snapshot.logs.output.map((line, index) => <div key={`out-${index}`} className="whitespace-pre-wrap text-slate-300">{line}</div>)}
                    {snapshot.logs.errors.map((line, index) => <div key={`err-${index}`} className="whitespace-pre-wrap text-red-300">{line}</div>)}
                  </div>
                ) : (
                  <div className="px-6 py-12 text-center text-sm text-slate-500">No PM2 log lines are available yet.</div>
                )}
              </CardContent>
            </Card>
          </>
        ) : loading ? (
          <div className="grid min-h-64 place-items-center text-sm font-semibold text-slate-400"><RefreshCw className="mb-3 h-6 w-6 animate-spin text-emerald-400" />Loading server telemetry…</div>
        ) : null}
      </main>
    </div>
  );
}

const accentClasses = {
  emerald: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/25",
  sky: "bg-sky-500/15 text-sky-400 ring-sky-500/25",
  violet: "bg-violet-500/15 text-violet-400 ring-violet-500/25",
  amber: "bg-amber-500/15 text-amber-400 ring-amber-500/25",
};

function MetricCard({ icon: Icon, label, value, detail, accent }: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  accent: keyof typeof accentClasses;
}) {
  return (
    <Card className="rounded-2xl border-slate-800 bg-slate-900 text-slate-100 shadow-lg">
      <CardContent className="p-5">
        <div className={`mb-4 inline-flex rounded-xl p-2.5 ring-1 ${accentClasses[accent]}`}><Icon className="h-5 w-5" /></div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
        <p className="mt-1 text-xl font-black capitalize">{value}</p>
        <p className="mt-1 text-xs text-slate-400">{detail}</p>
      </CardContent>
    </Card>
  );
}
