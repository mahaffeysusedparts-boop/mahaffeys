import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Cloud,
  CloudOff,
  Film,
  KeyRound,
  LogIn,
  LogOut,
  RefreshCw,
  Save,
  ScanSearch,
  ShieldCheck,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { alarmComService, type AdcCameraConfig, type AdcStatus } from "@/services/alarmComService";
import type { IpCameraAssignment } from "@/types/scrap";

const ASSIGNMENT_OPTIONS: { value: IpCameraAssignment; label: string }[] = [
  { value: "LICENSE_PLATE", label: "Scale Entrance LPR" },
  { value: "SELLER_FACE", label: "Seller Face Verification" },
  { value: "CARGO_BAY", label: "Overhead Scale Cargo" },
  { value: "SCALE_DESK", label: "Scale Desk Overall" },
  { value: "YARD_OVERVIEW", label: "Yard Security Overview" },
  { value: "OTHER", label: "General View" },
];

const STATUS_PILLS: Record<string, { label: string; className: string }> = {
  CONNECTED: { label: "Connected", className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" },
  NEEDS_LOGIN: { label: "Needs login", className: "border-amber-500/40 bg-amber-500/15 text-amber-300" },
  NEEDS_OTP: { label: "Needs 2FA code", className: "border-sky-500/40 bg-sky-500/15 text-sky-300" },
  ERROR: { label: "Error", className: "border-red-500/40 bg-red-500/15 text-red-300" },
};

function formatRelative(iso?: string) {
  if (!iso) return "never";
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/** Row shape derived from the merged /api/adc/cameras payload. */
interface CameraRow {
  deviceId: string;
  name: string;
  location?: string;
  assignment: IpCameraAssignment;
  isActive: boolean;
  notes?: string;
}

async function readError(response: unknown, fallback: string) {
  if (response instanceof Response) {
    const body = await response.json().catch(() => null) as { statusMessage?: string; message?: string } | null;
    return body?.statusMessage || body?.message || fallback;
  }
  return response instanceof Error && response.message ? response.message : fallback;
}

export function AlarmComManager() {
  const [status, setStatus] = useState<AdcStatus | null>(null);
  const [cameras, setCameras] = useState<CameraRow[]>([]);
  const [loadingCameras, setLoadingCameras] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [savingDeviceId, setSavingDeviceId] = useState<string | null>(null);
  const notesDrafts = useRef(new Map<string, string>());

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await alarmComService.fetchStatus());
    } catch {
      /* status polling is best-effort */
    }
  }, []);

  const loadCameras = useCallback(async () => {
    setLoadingCameras(true);
    try {
      const response = await alarmComService.fetchCameras();
      setCameras(
        response.cameras.map((camera) => ({
          deviceId: camera.adcDeviceId ?? camera.id.replace(/^adc-/, ""),
          name: camera.name,
          location: camera.adcLocation,
          assignment: camera.assignment,
          isActive: camera.isActive,
          notes: camera.notes,
        })),
      );
      setStatus((previous) => ({ ...previous, status: response.status } as AdcStatus));
    } catch {
      setCameras([]);
    } finally {
      setLoadingCameras(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    void loadCameras();
    const interval = window.setInterval(() => void loadStatus(), 15_000);
    return () => window.clearInterval(interval);
  }, [loadStatus, loadCameras]);

  const connected = status?.status === "CONNECTED";
  const awaitingOtp = status?.status === "NEEDS_OTP";
  const pill = STATUS_PILLS[status?.status ?? "NEEDS_LOGIN"] ?? STATUS_PILLS.ERROR;

  const handleConnect = async () => {
    if (!username.trim() || !password) {
      toast.error("Enter your Alarm.com username and password");
      return;
    }
    setConnecting(true);
    try {
      const response = await alarmComService.login(username.trim(), password);
      setPassword("");
      setStatus((previous) => ({ ...previous, ...response } as AdcStatus));
      if (response.status === "NEEDS_OTP") {
        setOtp("");
        toast.info("Two-factor code required", {
          description: "Alarm.com sent a verification code by text or e-mail. Enter it below to finish connecting.",
        });
      } else {
        toast.success("Alarm.com connected");
        await Promise.all([loadStatus(), loadCameras()]);
      }
    } catch (error) {
      toast.error("Alarm.com sign-in failed", { description: await readError(error, "Unknown server error") });
    } finally {
      setConnecting(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!/^\d{4,8}$/.test(otp.trim())) {
      toast.error("Enter the 4–8 digit code alarm.com sent you");
      return;
    }
    setConnecting(true);
    try {
      const response = await alarmComService.submitOtp(otp.trim());
      setOtp("");
      setStatus((previous) => ({ ...previous, ...response } as AdcStatus));
      if (response.status === "CONNECTED") {
        toast.success("Alarm.com connected");
        await Promise.all([loadStatus(), loadCameras()]);
      } else {
        toast.error("Still not connected", { description: `Connection status: ${response.status}` });
      }
    } catch (error) {
      toast.error("Verification failed", { description: await readError(error, "Alarm.com rejected that code") });
    } finally {
      setConnecting(false);
    }
  };

  const handleLogout = async () => {
    setConnecting(true);
    try {
      await alarmComService.logout();
      setCameras([]);
      setOtp("");
      await loadStatus();
      toast.info("Alarm.com disconnected", { description: "Session cookies cleared from the server." });
    } catch (error) {
      toast.error("Disconnect failed", { description: await readError(error, "Unknown server error") });
    } finally {
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await alarmComService.sync();
      setCameras(response.cameras.map((camera) => ({ ...camera })));
      await loadStatus();
      toast.success(`Synced ${response.cameras.length} Alarm.com cameras`, {
        description: "Assign each camera to a yard workstation role below.",
      });
    } catch (error) {
      toast.error("Camera sync failed", { description: await readError(error, "Alarm.com did not return the device list") });
    } finally {
      setSyncing(false);
    }
  };

  const patchCamera = async (row: CameraRow, patch: Partial<Pick<CameraRow, "assignment" | "isActive" | "notes">>, successMessage: string) => {
    setSavingDeviceId(row.deviceId);
    try {
      await alarmComService.updateCamera(row.deviceId, {
        assignment: patch.assignment,
        isActive: patch.isActive,
        notes: patch.notes,
      });
      setCameras((previous) =>
        previous.map((camera) => (camera.deviceId === row.deviceId ? { ...camera, ...patch } : camera)),
      );
      toast.success(successMessage);
    } catch (error) {
      toast.error("Could not save camera", { description: await readError(error, "Unknown server error") });
      await loadCameras();
    } finally {
      setSavingDeviceId(null);
    }
  };

  const noteFor = (row: CameraRow) => notesDrafts.current.get(row.deviceId) ?? row.notes ?? "";

  return (
    <section className="space-y-4">
      {/* Connection card */}
      <Card className="overflow-hidden rounded-3xl border-slate-800 bg-slate-900 text-slate-100 shadow-xl">
        <CardHeader className="gap-4 border-b border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Cloud className="h-5 w-5 text-emerald-400" /> Alarm.com camera bridge
            </CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              Cloud-locked cameras (building front, lobby, warehouse, scale) served through this server as local feeds.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={`gap-1 rounded-full px-3 py-1 text-xs font-bold ${pill.className}`}>
              {connected ? <ShieldCheck className="h-3 w-3" /> : awaitingOtp ? <KeyRound className="h-3 w-3" /> : <CloudOff className="h-3 w-3" />}
              {pill.label}
            </Badge>
            {connected && (
              <Button
                onClick={() => void handleLogout()}
                disabled={connecting}
                variant="outline"
                className="rounded-xl border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
              >
                <LogOut className="mr-2 h-4 w-4" /> Disconnect
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-5 p-5 sm:p-6">
          {status?.errorMessage ? (
            <div className="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <span>{status.errorMessage}</span>
            </div>
          ) : null}

          {connected ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Signed in as</p>
                <p className="mt-1.5 truncate font-mono text-sm font-bold text-white">{status?.username || "—"}</p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Session verified</p>
                <p className="mt-1.5 font-mono text-sm font-bold text-white">{formatRelative(status?.lastVerifiedAt)}</p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Cameras synced</p>
                <p className="mt-1.5 font-mono text-sm font-bold text-white">
                  {status?.cameraCount ?? cameras.length} <span className="text-slate-500">· {formatRelative(status?.lastSyncAt)}</span>
                </p>
              </div>
              <p className="sm:col-span-3 text-xs leading-5 text-slate-500">
                The bridge stores session cookies only — never your password. Your account treats this server as a
                trusted device, so routine re-logins skip the two-factor step.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-4 sm:p-5 space-y-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Step 1 · Alarm.com credentials</p>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Username / e-mail</Label>
                  <Input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="you@yard.com"
                    autoComplete="username"
                    disabled={connecting}
                    className="rounded-xl border-slate-700 bg-slate-900 font-mono text-slate-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Password</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={connecting}
                    className="rounded-xl border-slate-700 bg-slate-900 font-mono text-slate-100"
                  />
                </div>
                <Button
                  onClick={() => void handleConnect()}
                  disabled={connecting}
                  className="w-full rounded-xl bg-emerald-500 font-bold text-slate-950 hover:bg-emerald-400"
                >
                  <LogIn className={`mr-2 h-4 w-4 ${connecting ? "animate-pulse" : ""}`} />
                  {connecting ? "Contacting alarm.com…" : "Connect"}
                </Button>
                <p className="text-[11px] leading-4 text-slate-500">
                  Credentials are used once for the login handshake and then discarded — only the resulting session
                  cookie is kept in the server database.
                </p>
              </div>

              <div className={`rounded-2xl border p-4 sm:p-5 space-y-3 transition-opacity ${awaitingOtp ? "border-sky-500/40 bg-sky-950/20" : "border-slate-800 bg-slate-950/20 opacity-60"}`}>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Step 2 · Two-factor code</p>
                <p className="text-xs leading-5 text-slate-400">
                  When alarm.com demands verification, the code it texts/e-mails you goes here. This only appears
                  during the first sign-in or when the trusted-device cookie expires.
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">6-digit verification code</Label>
                  <Input
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder="••••••"
                    inputMode="numeric"
                    disabled={!awaitingOtp || connecting}
                    className="rounded-xl border-slate-700 bg-slate-900 text-center font-mono text-lg tracking-[0.4em] text-sky-200"
                  />
                </div>
                <Button
                  onClick={() => void handleVerifyOtp()}
                  disabled={!awaitingOtp || connecting}
                  className="w-full rounded-xl bg-sky-500 font-bold text-slate-950 hover:bg-sky-400"
                >
                  <KeyRound className="mr-2 h-4 w-4" /> Verify code &amp; finish
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Camera table */}
      <Card className="overflow-hidden rounded-3xl border-slate-800 bg-slate-900 text-slate-100 shadow-xl">
        <CardHeader className="gap-4 border-b border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Video className="h-5 w-5 text-emerald-400" /> Cloud cameras ({cameras.length})
            </CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              Assign each alarm.com camera to a yard role — the scale LPR camera feeds automated plate scanning.
            </p>
          </div>
          <Button
            onClick={() => void handleSync()}
            disabled={!connected || syncing}
            className="rounded-xl bg-emerald-500 font-bold text-slate-950 hover:bg-emerald-400"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync cameras"}
          </Button>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          {loadingCameras ? (
            <div className="grid min-h-32 place-items-center rounded-2xl border border-slate-800 bg-slate-950/60 text-sm text-slate-400">
              <RefreshCw className="mr-2 h-5 w-5 animate-spin text-emerald-400" /> Loading cloud cameras…
            </div>
          ) : cameras.length === 0 ? (
            <div className="grid min-h-32 place-items-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 px-6 text-center text-sm text-slate-500">
              <div>
                <CloudOff className="mx-auto mb-2 h-8 w-8 text-slate-600" />
                {connected
                  ? "No cameras synced yet — press “Sync cameras” to pull the device list from alarm.com."
                  : "Connect alarm.com above, then sync to list its cameras."}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <Table>
                <TableHeader className="bg-slate-950">
                  <TableRow className="border-slate-800 text-xs">
                    <TableHead className="text-slate-400">Camera</TableHead>
                    <TableHead className="text-slate-400">Location</TableHead>
                    <TableHead className="text-slate-400">Yard assignment</TableHead>
                    <TableHead className="text-slate-400">Active</TableHead>
                    <TableHead className="min-w-48 text-slate-400">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cameras.map((row) => (
                    <TableRow key={row.deviceId} className="border-slate-800">
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <Film className="h-4 w-4 shrink-0 text-sky-400" />
                          <div>
                            <p className="text-sm font-bold text-white">{row.name}</p>
                            <p className="font-mono text-[10px] text-slate-500">device {row.deviceId}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-400">{row.location || <span className="text-slate-600">—</span>}</TableCell>
                      <TableCell className="py-3">
                        <Select
                          value={row.assignment}
                          onValueChange={(value) => void patchCamera(row, { assignment: value as IpCameraAssignment }, `${row.name} assigned to ${value.replace("_", " ").toLowerCase()}`)}
                          disabled={savingDeviceId === row.deviceId}
                        >
                          <SelectTrigger className="h-9 w-52 rounded-xl border-slate-700 bg-slate-900 text-xs text-slate-100">
                            <ScanSearch className="mr-1.5 h-3.5 w-3.5 text-sky-400" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-slate-700 bg-slate-900 text-slate-100">
                            {ASSIGNMENT_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="py-3">
                        <Switch
                          checked={row.isActive}
                          onCheckedChange={(checked) => void patchCamera(row, { isActive: checked }, `${row.name} is now ${checked ? "ACTIVE" : "PAUSED"}`)}
                          disabled={savingDeviceId === row.deviceId}
                        />
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={row.notes ?? ""}
                            placeholder="e.g. Scale entrance, plate-level view"
                            disabled={savingDeviceId === row.deviceId}
                            onChange={(event) => notesDrafts.current.set(row.deviceId, event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") void patchCamera(row, { notes: noteFor(row) }, "Camera notes saved");
                            }}
                            className="h-9 rounded-xl border-slate-700 bg-slate-900 text-xs text-slate-100"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Save notes"
                            disabled={savingDeviceId === row.deviceId || noteFor(row) === (row.notes ?? "")}
                            onClick={() => void patchCamera(row, { notes: noteFor(row) }, "Camera notes saved")}
                            className="h-8 w-8 shrink-0 text-slate-400 hover:text-emerald-300"
                          >
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
