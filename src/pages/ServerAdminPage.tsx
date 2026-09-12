import { useCallback, useEffect, useState } from "react";
import { Activity, Cpu, Database, HardDrive, RefreshCw, RotateCw, Server, Terminal, ShieldCheck, Download } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { ScaleServerManager } from "@/components/server/ScaleServerManager";
import { StoplightServerManager } from "@/components/server/StoplightServerManager";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { hasPageAccess, PATH_TO_PAGE_KEY } from "@/utils/pageAccess";

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

interface BackupFile {
  name: string;
  sizeBytes: number;
  createdAt: string;
  recordCount: number | null;
}

interface AuditEntry {
  id: string;
  userId: string | null;
  userName: string;
  action: string;
  entity: string;
  entityId: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditResponse {
  entries: AuditEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
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

  // Backup state
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [backupDir, setBackupDir] = useState<string>('');
  const [backupRetention, setBackupRetention] = useState<number>(30);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);

  // Audit state
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditPage, setAuditPage] = useState<number>(1);
  const [auditPageSize, setAuditPageSize] = useState<number>(50);
  const [auditTotal, setAuditTotal] = useState<number>(0);
  const [auditTotalPages, setAuditTotalPages] = useState<number>(1);
  const [auditFilters, setAuditFilters] = useState<{ user: string; action: string; entity: string; from: string; to: string }>({
    user: '', action: '', entity: '', from: '', to: ''
  });
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

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

  const loadBackups = useCallback(async () => {
    setLoadingBackups(true);
    setBackupError(null);
    try {
      const response = await fetch("/api/admin/backups", { credentials: "include" });
      if (!response.ok) throw new Error(response.status === 403 ? "Administrator access required" : "Unable to read backups");
      const data = await response.json() as { backups: BackupFile[]; dir: string; retention: number };
      setBackups(data.backups);
      setBackupDir(data.dir);
      setBackupRetention(data.retention);
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : "Unable to read backups");
    } finally {
      setLoadingBackups(false);
    }
  }, []);

  const runBackup = async () => {
    setLoadingBackups(true);
    setBackupError(null);
    try {
      const response = await fetch("/api/admin/backups/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message || "Backup failed");
      }
      toast.success("Backup triggered successfully");
      void loadBackups();
    } catch (err) {
      toast.error("Backup failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setLoadingBackups(false);
    }
  };

  const loadAudit = useCallback(async (page = 1, filters = auditFilters) => {
    setLoadingAudit(true);
    setAuditError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      if (filters.user) params.set("user", filters.user);
      if (filters.action) params.set("action", filters.action);
      if (filters.entity) params.set("entity", filters.entity);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      const response = await fetch(`/api/admin/audit?${params.toString()}`, { credentials: "include" });
      if (!response.ok) throw new Error(response.status === 403 ? "Administrator access required" : "Unable to read audit log");
      const data = await response.json() as AuditResponse;
      setAuditEntries(data.entries);
      setAuditPage(data.page);
      setAuditPageSize(data.pageSize);
      setAuditTotal(data.total);
      setAuditTotalPages(data.totalPages);
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : "Unable to read audit log");
    } finally {
      setLoadingAudit(false);
    }
  }, [auditFilters]);

  useEffect(() => {
    void loadBackups();
  }, [loadBackups]);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

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

            {/* Audit & Backups tabs */}
            <Tabs defaultValue="backups" className="w-full space-y-4">
              <TabsList className="bg-slate-900 border border-slate-800 p-1 rounded-xl">
                <TabsTrigger value="backups" className="text-sm">Backups</TabsTrigger>
                <TabsTrigger value="audit" className="text-sm">Audit Log</TabsTrigger>
              </TabsList>

              <TabsContent value="backups" className="space-y-4">
                <Card className="bg-slate-900 border-slate-800 text-white shadow-lg">
                  <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
                    <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300 flex items-center gap-2">
                      <Download className="w-4 h-4 text-emerald-400" /> Nightly Backups
                    </CardTitle>
                    <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs">
                      Retention: {backupRetention} files
                    </Badge>
                  </CardHeader>

                  <CardContent className="p-4 space-y-3">
                    {backupError ? (
                      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-200">
                        {backupError}
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-400">
                            <div>Run backup now</div>
                            <Button
                              onClick={runBackup}
                              disabled={loadingBackups}
                              className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                            >
                              {loadingBackups ? "Running..." : "Run Backup Now"}
                            </Button>
                          </div>
                          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-400">
                            <div>Backup directory</div>
                            <p className="mt-1 text-[10px] text-slate-400 break-all">{backupDir}</p>
                          </div>
                        </div>

                        <div className="mt-4">
                          <p className="text-sm font-bold text-slate-300 mb-2">Backup Files ({backups.length})</p>
                          {backups.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4">No backup files found</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader className="bg-slate-950">
                                  <TableRow className="border-slate-800 text-xs">
                                    <TableHead className="text-slate-400">File Name</TableHead>
                                    <TableHead className="text-slate-400">Size</TableHead>
                                    <TableHead className="text-slate-400">Created At</TableHead>
                                    <TableHead className="text-slate-400">Records</TableHead>
                                    <TableHead className="text-slate-400">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {backups.map((backup) => (
                                    <TableRow key={backup.name} className="border-slate-800">
                                      <TableCell className="text-slate-400 font-mono">{backup.name}</TableCell>
                                      <TableCell className="text-slate-400">{formatBytes(backup.sizeBytes)}</TableCell>
                                      <TableCell className="text-slate-400 text-sm">{new Date(backup.createdAt).toLocaleString()}</TableCell>
                                      <TableCell className="text-slate-400">
                                        {backup.recordCount !== null ? backup.recordCount.toLocaleString() : "—"}
                                      </TableCell>
                                      <TableCell className="flex gap-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            window.open(`/api/admin/backups/${backup.name}`, "_blank");
                                          }}
                                          className="text-emerald-400 hover:text-emerald-300"
                                        >
                                          <Download className="w-4 h-4" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-slate-500 mt-4">
                          Restore = import the JSON via the existing Settings restore flow. Backups embed photo bytes.
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="audit" className="space-y-4">
                <Card className="bg-slate-900 border-slate-800 text-white shadow-lg">
                  <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
                    <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" /> Audit Log
                    </CardTitle>
                    <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs">
                      {auditTotal} entries
                    </Badge>
                  </CardHeader>

                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-slate-300">User</Label>
                        <Input
                          value={auditFilters.user}
                          onChange={(e) => setAuditFilters((prev) => ({ ...prev, user: e.target.value }))}
                          placeholder="Filter…"
                          className="bg-slate-900 border-slate-800 text-white text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-300">Action</Label>
                        <Input
                          value={auditFilters.action}
                          onChange={(e) => setAuditFilters((prev) => ({ ...prev, action: e.target.value }))}
                          placeholder="Filter…"
                          className="bg-slate-900 border-slate-800 text-white text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-300">Entity</Label>
                        <Input
                          value={auditFilters.entity}
                          onChange={(e) => setAuditFilters((prev) => ({ ...prev, entity: e.target.value }))}
                          placeholder="Filter…"
                          className="bg-slate-900 border-slate-800 text-white text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-300">Date range</Label>
                        <div className="flex gap-2">
                          <Input
                            type="date"
                            value={auditFilters.from}
                            onChange={(e) => setAuditFilters((prev) => ({ ...prev, from: e.target.value }))}
                            className="bg-slate-900 border-slate-800 text-white text-xs h-9"
                          />
                          <Input
                            type="date"
                            value={auditFilters.to}
                            onChange={(e) => setAuditFilters((prev) => ({ ...prev, to: e.target.value }))}
                            className="bg-slate-900 border-slate-800 text-white text-xs h-9"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => void loadAudit(1, auditFilters)}
                        disabled={loadingAudit}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                      >
                        Apply Filters
                      </Button>
                      <Button
                        onClick={() => {
                          setAuditFilters({ user: '', action: '', entity: '', from: '', to: '' });
                          void loadAudit(1, { user: '', action: '', entity: '', from: '', to: '' });
                        }}
                        variant="outline"
                        className="border-slate-700 bg-slate-800 text-slate-300 text-xs"
                      >
                        Clear
                      </Button>
                    </div>

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-slate-950">
                          <TableRow className="border-slate-800 text-xs">
                            <TableHead className="text-slate-400">Timestamp</TableHead>
                            <TableHead className="text-slate-400">User</TableHead>
                            <TableHead className="text-slate-400">Action</TableHead>
                            <TableHead className="text-slate-400">Entity</TableHead>
                            <TableHead className="text-slate-400">Detail</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loadingAudit ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-slate-400 text-center py-4">Loading audit entries…</TableCell>
                            </TableRow>
                          ) : auditEntries.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-slate-400 text-center py-4">No audit entries found</TableCell>
                            </TableRow>
                          ) : (
                            auditEntries.map((entry) => (
                              <TableRow key={entry.id} className="border-slate-800">
                                <TableCell className="text-slate-400 text-sm">{new Date(entry.createdAt).toLocaleString()}</TableCell>
                                <TableCell className="text-slate-400">{entry.userName}</TableCell>
                                <TableCell className="text-slate-400">{entry.action}</TableCell>
                                <TableCell className="text-slate-400">{entry.entity}</TableCell>
                                <TableCell className="text-slate-400 text-xs max-w-xs truncate">
                                  {entry.detail ? JSON.stringify(entry.detail) : "—"}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    {auditTotalPages > 1 && (
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                        <p className="text-xs text-slate-400">
                          Page {auditPage} of {auditTotalPages} ({auditTotal} total entries)
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={auditPage <= 1 || loadingAudit}
                            onClick={() => void loadAudit(auditPage - 1, auditFilters)}
                            className="border-slate-700 bg-slate-800 text-slate-300 text-xs"
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={auditPage >= auditTotalPages || loadingAudit}
                            onClick={() => void loadAudit(auditPage + 1, auditFilters)}
                            className="border-slate-700 bg-slate-800 text-slate-300 text-xs"
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-slate-500">
                      Filter by user, action, entity, or date range. Non-admins never see this tab.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <ScaleServerManager />
            <StoplightServerManager />
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
