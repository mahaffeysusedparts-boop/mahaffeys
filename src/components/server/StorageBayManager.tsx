import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CircleDashed, Disc3, HardDrive, Plus, RefreshCw, ShieldAlert, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface StorageDisk {
  name: string;
  path: string;
  size: number;
  model: string;
  serial: string;
  vendor: string;
  transport: string;
  hotplug: boolean;
  rotational: boolean;
  mountpoints: string[];
  filesystem: string | null;
  bay: string | null;
  eligible: boolean;
}

interface EnclosureBay {
  id: string;
  enclosure: string;
  slot: string;
  status: string;
  device: string | null;
  available: boolean;
}

interface RaidArray {
  name: string;
  path: string;
  level: string;
  state: string;
  size: number;
  members: Array<{ name: string; path: string; state: string }>;
}

interface StorageSnapshot {
  disks: StorageDisk[];
  bays: EnclosureBay[];
  arrays: RaidArray[];
  capabilities: {
    linux: boolean;
    mdadmInstalled: boolean;
    privileged: boolean;
    automaticBayMapping: boolean;
  };
  discoveryError: string | null;
  checkedAt: string;
}

type MemberOperation = { action: "prepare" | "add"; array: RaidArray; device: string };
const minimumDrives: Record<string, number> = { "1": 2, "5": 3, "6": 4, "10": 4 };

const formatBytes = (value: number) => {
  if (!value) return "0 GB";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index > 3 ? 1 : 0)} ${units[index]}`;
};

async function readError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { statusMessage?: string; message?: string } | null;
  return body?.statusMessage || body?.message || fallback;
}

export function StorageBayManager() {
  const [snapshot, setSnapshot] = useState<StorageSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [level, setLevel] = useState("1");
  const [arrayPath, setArrayPath] = useState("/dev/md0");
  const [selected, setSelected] = useState<string[]>([]);
  const [createConfirmation, setCreateConfirmation] = useState("");
  const [memberOperation, setMemberOperation] = useState<MemberOperation | null>(null);
  const [memberConfirmation, setMemberConfirmation] = useState("");
  const [working, setWorking] = useState(false);

  const loadStorage = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/admin/storage", { credentials: "include" });
      if (!response.ok) throw new Error(await readError(response, "Unable to discover storage devices"));
      setSnapshot(await response.json() as StorageSnapshot);
    } catch (error) {
      toast.error("Storage discovery failed", { description: error instanceof Error ? error.message : "Unknown server error" });
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStorage();
    const interval = window.setInterval(() => void loadStorage(true), 30_000);
    return () => window.clearInterval(interval);
  }, [loadStorage]);

  const eligibleDisks = useMemo(() => snapshot?.disks.filter((disk) => disk.eligible) || [], [snapshot]);
  const selectionValid = selected.length >= minimumDrives[level] && (level !== "10" || selected.length % 2 === 0);
  const managementReady = Boolean(snapshot?.capabilities.mdadmInstalled && snapshot.capabilities.privileged);

  const toggleDisk = (path: string) => {
    setSelected((current) => current.includes(path) ? current.filter((item) => item !== path) : [...current, path]);
  };

  const createArray = async () => {
    setWorking(true);
    try {
      const response = await fetch("/api/admin/storage/arrays", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ array: arrayPath, level, devices: selected, confirmation: createConfirmation }),
      });
      if (!response.ok) throw new Error(await readError(response, "Array creation failed"));
      const body = await response.json() as { message: string };
      toast.success("Software RAID created", { description: body.message });
      setCreateOpen(false);
      setSelected([]);
      setCreateConfirmation("");
      await loadStorage(true);
    } catch (error) {
      toast.error("Could not create array", { description: error instanceof Error ? error.message : "Unknown server error" });
    } finally {
      setWorking(false);
    }
  };

  const runMemberOperation = async () => {
    if (!memberOperation) return;
    setWorking(true);
    try {
      const response = await fetch("/api/admin/storage/member", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: memberOperation.action,
          array: memberOperation.array.path,
          device: memberOperation.device,
          confirmation: memberConfirmation,
        }),
      });
      if (!response.ok) throw new Error(await readError(response, "Hot-swap operation failed"));
      const body = await response.json() as { message: string };
      toast.success(memberOperation.action === "prepare" ? "Drive ready to remove" : "Replacement added", { description: body.message });
      setMemberOperation(null);
      setMemberConfirmation("");
      await loadStorage(true);
    } catch (error) {
      toast.error("Hot-swap operation failed", { description: error instanceof Error ? error.message : "Unknown server error" });
    } finally {
      setWorking(false);
    }
  };

  return (
    <section className="mt-5 space-y-5">
      <Card className="overflow-hidden rounded-3xl border-slate-800 bg-slate-900 text-slate-100 shadow-xl">
        <CardHeader className="gap-4 border-b border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg"><HardDrive className="h-5 w-5 text-sky-400" /> Storage bays</CardTitle>
            <p className="mt-1 text-xs text-slate-500">Linux enclosure slots and block devices · refreshes every 30 seconds</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void loadStorage()} disabled={loading} variant="outline" className="rounded-xl border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Scan bays
            </Button>
            <Button onClick={() => setCreateOpen(true)} disabled={!managementReady || eligibleDisks.length < 2} className="rounded-xl bg-sky-500 font-bold text-slate-950 hover:bg-sky-400">
              <Plus className="mr-2 h-4 w-4" /> Create RAID
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-5 sm:p-6">
          {snapshot?.discoveryError ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{snapshot.discoveryError}</div>
          ) : null}
          {snapshot && !managementReady ? (
            <div className="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div><strong>Monitoring only.</strong> RAID controls require mdadm and the app service to run with storage-management privileges.</div>
            </div>
          ) : null}

          {snapshot?.bays.length ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-400">Physical enclosure</h3>
                <Badge className="rounded-full bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15">{snapshot.bays.filter((bay) => bay.available).length} open</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {snapshot.bays.map((bay) => (
                  <div key={bay.id} className={`rounded-2xl border p-4 ${bay.available ? "border-emerald-500/30 bg-emerald-500/10" : "border-slate-700 bg-slate-950/60"}`}>
                    <div className="flex items-center justify-between">
                      <div className={`grid h-10 w-10 place-items-center rounded-xl ${bay.available ? "bg-emerald-500/15 text-emerald-400" : "bg-sky-500/15 text-sky-400"}`}>
                        {bay.available ? <CircleDashed className="h-5 w-5" /> : <Disc3 className="h-5 w-5" />}
                      </div>
                      <Badge variant="outline" className={`rounded-full ${bay.available ? "border-emerald-500/40 text-emerald-300" : "border-slate-600 text-slate-300"}`}>{bay.available ? "Available" : "Occupied"}</Badge>
                    </div>
                    <p className="mt-4 text-lg font-black">Bay {bay.slot}</p>
                    <p className="mt-1 truncate text-xs text-slate-400">{bay.device || bay.status}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : snapshot ? (
            <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-400">
              This controller does not publish enclosure slot numbers to Linux. Drives are still listed below by device, model, and serial number.
            </div>
          ) : null}

          {snapshot ? (
            <div>
              <h3 className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-slate-400">Detected drives</h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {snapshot.disks.map((disk) => (
                  <div key={disk.path} className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className={`rounded-xl p-2.5 ${disk.eligible ? "bg-emerald-500/15 text-emerald-400" : "bg-violet-500/15 text-violet-400"}`}><HardDrive className="h-5 w-5" /></div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><p className="font-black">{disk.bay || disk.path}</p><Badge variant="outline" className="rounded-full border-slate-700 text-[10px] text-slate-400">{disk.transport.toUpperCase()}</Badge></div>
                        <p className="truncate text-sm text-slate-300">{disk.vendor} {disk.model}</p>
                        <p className="mt-1 truncate font-mono text-[11px] text-slate-500">S/N {disk.serial}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                      <p className="font-black text-sky-300">{formatBytes(disk.size)}</p>
                      <p className={`text-xs font-semibold ${disk.eligible ? "text-emerald-400" : "text-slate-500"}`}>{disk.eligible ? "Ready for RAID" : disk.mountpoints.join(", ") || disk.filesystem || "In use"}</p>
                    </div>
                  </div>
                ))}
                {snapshot.disks.length === 0 ? <p className="text-sm text-slate-500">No Linux block devices were detected.</p> : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {snapshot ? (
        <Card className="rounded-3xl border-slate-800 bg-slate-900 text-slate-100 shadow-xl">
          <CardHeader className="border-b border-slate-800">
            <CardTitle className="flex items-center gap-2 text-lg"><Wrench className="h-5 w-5 text-violet-400" /> Software RAID & hot swap</CardTitle>
            <p className="mt-1 text-xs text-slate-500">Fail and remove a member before pulling it, then add the replacement to start rebuilding.</p>
          </CardHeader>
          <CardContent className="space-y-4 p-5 sm:p-6">
            {snapshot.arrays.map((array) => (
              <div key={array.path} className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2"><h3 className="text-lg font-black">{array.path}</h3><Badge className="rounded-full bg-violet-500/15 text-violet-300 hover:bg-violet-500/15">{array.level.toUpperCase()}</Badge></div>
                    <p className="mt-1 text-xs text-slate-400">{formatBytes(array.size)} · {array.state} · {array.members.length} members</p>
                  </div>
                  <Select onValueChange={(device) => setMemberOperation({ action: "add", array, device })} disabled={!managementReady || eligibleDisks.length === 0}>
                    <SelectTrigger className="w-full rounded-xl border-slate-700 bg-slate-900 text-slate-200 sm:w-56"><SelectValue placeholder="Add replacement drive" /></SelectTrigger>
                    <SelectContent className="border-slate-700 bg-slate-900 text-slate-100">
                      {eligibleDisks.map((disk) => <SelectItem key={disk.path} value={disk.path}>{disk.path} · {formatBytes(disk.size)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {array.members.map((member) => (
                    <div key={member.path} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5">
                      <div><p className="font-mono text-sm font-bold">{member.path}</p><p className="text-[11px] text-emerald-400">{member.state}</p></div>
                      <Button size="sm" variant="outline" disabled={!managementReady} onClick={() => setMemberOperation({ action: "prepare", array, device: member.path })} className="rounded-lg border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 hover:text-amber-100">Prepare removal</Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {snapshot.arrays.length === 0 ? <div className="py-8 text-center text-sm text-slate-500">No Linux software RAID arrays are active.</div> : null}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border-slate-700 bg-slate-900 text-slate-100 sm:max-w-2xl">
          <DialogHeader><DialogTitle>Create software RAID</DialogTitle><DialogDescription className="text-slate-400">Only empty, unmounted drives are selectable. Array creation writes RAID metadata to every selected drive.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2"><Label>Array device</Label><Input value={arrayPath} onChange={(event) => setArrayPath(event.target.value)} className="rounded-xl border-slate-700 bg-slate-950" /></div>
            <div className="space-y-2"><Label>RAID level</Label><Select value={level} onValueChange={(value) => { setLevel(value); setSelected([]); }}><SelectTrigger className="rounded-xl border-slate-700 bg-slate-950"><SelectValue /></SelectTrigger><SelectContent className="border-slate-700 bg-slate-900 text-white">{Object.keys(minimumDrives).map((item) => <SelectItem key={item} value={item}>RAID {item} · {minimumDrives[item]}+ drives</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-2">
            <Label>Select drives</Label>
            {eligibleDisks.map((disk) => (
              <label key={disk.path} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/70 p-3 hover:border-sky-500/50">
                <Checkbox checked={selected.includes(disk.path)} onCheckedChange={() => toggleDisk(disk.path)} />
                <span className="flex-1 text-sm font-bold">{disk.path} <span className="font-normal text-slate-400">{disk.model}</span></span><span className="text-sm font-black text-sky-300">{formatBytes(disk.size)}</span>
              </label>
            ))}
          </div>
          {!selectionValid && selected.length > 0 ? <p className="flex items-center gap-2 text-xs text-amber-300"><AlertTriangle className="h-4 w-4" /> RAID {level} requires {level === "10" ? "an even number of at least 4" : `at least ${minimumDrives[level]}`} drives.</p> : null}
          <div className="space-y-2"><Label>Type CREATE to confirm</Label><Input value={createConfirmation} onChange={(event) => setCreateConfirmation(event.target.value)} placeholder="CREATE" className="rounded-xl border-red-500/30 bg-red-500/5" /></div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl border-slate-700 bg-slate-800 text-white hover:bg-slate-700 hover:text-white">Cancel</Button><Button onClick={() => void createArray()} disabled={working || !selectionValid || createConfirmation !== "CREATE"} className="rounded-xl bg-sky-500 font-bold text-slate-950 hover:bg-sky-400"><Check className="mr-2 h-4 w-4" />{working ? "Creating…" : "Create array"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(memberOperation)} onOpenChange={(open) => { if (!open) { setMemberOperation(null); setMemberConfirmation(""); } }}>
        <DialogContent className="rounded-3xl border-slate-700 bg-slate-900 text-slate-100">
          <DialogHeader><DialogTitle>{memberOperation?.action === "prepare" ? "Prepare drive for removal" : "Add replacement drive"}</DialogTitle><DialogDescription className="text-slate-400">{memberOperation?.action === "prepare" ? `${memberOperation.device} will be marked failed and removed from ${memberOperation.array.path}. Wait for success before physically pulling it.` : `${memberOperation?.device} will be added to ${memberOperation?.array.path} and the rebuild should begin automatically.`}</DialogDescription></DialogHeader>
          <div className="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100"><AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" /> Verify the array is redundant and healthy before continuing. Removing the wrong drive can cause data loss.</div>
          <div className="space-y-2"><Label>Type HOTSWAP to confirm</Label><Input value={memberConfirmation} onChange={(event) => setMemberConfirmation(event.target.value)} placeholder="HOTSWAP" className="rounded-xl border-amber-500/30 bg-slate-950" /></div>
          <DialogFooter><Button variant="outline" onClick={() => setMemberOperation(null)} className="rounded-xl border-slate-700 bg-slate-800 text-white hover:bg-slate-700 hover:text-white">Cancel</Button><Button onClick={() => void runMemberOperation()} disabled={working || memberConfirmation !== "HOTSWAP"} className="rounded-xl bg-amber-400 font-bold text-slate-950 hover:bg-amber-300">{working ? "Working…" : "Confirm operation"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
