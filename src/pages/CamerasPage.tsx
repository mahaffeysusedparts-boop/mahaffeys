import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { storageService } from "@/services/storageService";
import { alarmComService, type AdcStatus } from "@/services/alarmComService";
import type { AdcClip } from "@/services/alarmComService";
import { IpCamera, IpCameraType, IpCameraAssignment } from "@/types/scrap";
import { useAuth } from "@/context/AuthContext";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Camera,
  Plus,
  Video,
  Scan,
  Trash2,
  Edit3,
  RefreshCw,
  Wifi,
  WifiOff,
  Maximize2,
  Car,
  CreditCard,
  Package,
  Radio,
  Cloud,
  CloudOff,
  Film,
  Download,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

const ADC_TILE_REFRESH_MS = 10_000;
const ADC_FULLSCREEN_REFRESH_MS = 5_000;

function captureAgeLabel(lastLoadedAt: number | null, now: number) {
  if (!lastLoadedAt) return null;
  const seconds = Math.max(0, Math.round((now - lastLoadedAt) / 1000));
  if (seconds < 5) return "captured just now";
  if (seconds < 90) return `captured ${seconds}s ago`;
  return `captured ${Math.round(seconds / 60)}m ago`;
}

/** Auto-refreshing Alarm.com snapshot viewport (shared by tile + fullscreen). */
function AdcSnapshotView({ cam, refreshMs, large = false }: { cam: IpCamera; refreshMs: number; large?: boolean }) {
  const [nonce, setNonce] = useState(() => Date.now());
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!cam.isActive) return;
    const refresh = () => {
      if (document.visibilityState === "visible") setNonce(Date.now());
    };
    const timer = window.setInterval(refresh, refreshMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [cam.isActive, refreshMs]);

  useEffect(() => {
    const ticker = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(ticker);
  }, []);

  if (!cam.isActive) {
    return (
      <div className="absolute inset-0 text-center p-6 space-y-1 flex flex-col items-center justify-center bg-slate-950">
        <WifiOff className="w-8 h-8 text-slate-600 mx-auto" />
        <span className="text-xs text-slate-500 font-mono block">CAMERA STREAM PAUSED</span>
      </div>
    );
  }

  return (
    <>
      <img
        src={`${cam.snapshotUrl}?t=${nonce}`}
        alt={cam.name}
        className={`w-full h-full ${large ? "object-contain" : "object-cover"}`}
        onLoad={() => {
          setLastLoadedAt(Date.now());
          setFailed(false);
        }}
        onError={() => setFailed(true)}
      />
      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-slate-950/92 p-4 text-center">
          <CloudOff className="w-7 h-7 text-slate-500" />
          <span className="text-[11px] font-mono text-amber-300">ALARM.COM FRAME UNAVAILABLE</span>
          <span className="text-[10px] text-slate-500 max-w-56">
            Retrying automatically — the cloud session may need an administrator to reconnect.
          </span>
        </div>
      )}
      {!failed && (
        <div className="absolute bottom-2 left-2 z-10">
          <Badge className="bg-slate-950/85 text-slate-300 border-slate-800 text-[9px] font-mono">
            {captureAgeLabel(lastLoadedAt, now) ?? "waiting for frame…"}
          </Badge>
        </div>
      )}
    </>
  );
}

export default function CamerasPage() {
  const { isAdmin } = useAuth();
  const [cameras, setCameras] = useState<IpCamera[]>([]);
  const [adcCameras, setAdcCameras] = useState<IpCamera[]>([]);
  const [adcStatus, setAdcStatus] = useState<AdcStatus | null>(null);
  const [adcWarning, setAdcWarning] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingCam, setEditingVeh] = useState<IpCamera | null>(null);
  const [selectedCamForFullscreen, setSelectedCamForFullscreen] = useState<IpCamera | null>(null);

  // Local camera form state
  const [camName, setCamName] = useState("");
  const [camIp, setCamIp] = useState("192.168.1.150");
  const [camPort, setCamPort] = useState(8080);
  const [camStreamUrl, setCamStreamUrl] = useState("http://192.168.1.150:8080/video");
  const [camSnapshotUrl, setCamSnapshotUrl] = useState("http://192.168.1.150:8080/shot.jpg");
  const [camType, setCamType] = useState<IpCameraType>("MJPEG");
  const [camAssignment, setCamAssignment] = useState<IpCameraAssignment>("LICENSE_PLATE");
  const [camUsername, setCamUsername] = useState("");
  const [camPassword, setCamPassword] = useState("");
  const [camNotes, setCamNotes] = useState("");

  // Alarm.com camera edit state (assignment / notes only — URLs are bridge-managed)
  const [adcEditing, setAdcEditing] = useState<IpCamera | null>(null);
  const [adcEditAssignment, setAdcEditAssignment] = useState<IpCameraAssignment>("OTHER");
  const [adcEditNotes, setAdcEditNotes] = useState("");
  const [savingAdc, setSavingAdc] = useState(false);

  const loadData = () => {
    setCameras(storageService.getIpCameras());
  };

  const loadAdc = useCallback(async () => {
    try {
      const response = await alarmComService.fetchCameras();
      setAdcCameras(response.cameras);
      setAdcStatus((previous) => ({ ...previous, status: response.status } as AdcStatus));
      setAdcWarning(response.warning ?? null);
    } catch (error) {
      setAdcWarning(error instanceof Error ? error.message : "Alarm.com bridge is unreachable");
      setAdcCameras([]);
    }
  }, []);

  // Keep the session banner fresh even when the operator never reloads.
  useEffect(() => {
    const pollStatus = async () => {
      try {
        setAdcStatus(await alarmComService.fetchStatus());
      } catch {
        /* keep the last known state */
      }
    };
    void pollStatus();
    const interval = window.setInterval(() => void pollStatus(), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    loadData();
    void loadAdc();
  }, [loadAdc]);

  const handleOpenAdd = () => {
    setEditingVeh(null);
    setCamName("Scale License Plate Camera");
    setCamIp("192.168.1.150");
    setCamPort(8080);
    setCamStreamUrl("http://192.168.1.150:8080/video");
    setCamSnapshotUrl("http://192.168.1.150:8080/shot.jpg");
    setCamType("MJPEG");
    setCamAssignment("LICENSE_PLATE");
    setCamUsername("");
    setCamPassword("");
    setCamNotes("Scale entrance camera; HTTP snapshot is monitored automatically for arriving vehicles");
    setAddModalOpen(true);
  };

  const handleOpenEdit = (cam: IpCamera) => {
    setEditingVeh(cam);
    setCamName(cam.name);
    setCamIp(cam.ipAddress);
    setCamPort(cam.port || 8080);
    setCamStreamUrl(cam.streamUrl);
    setCamSnapshotUrl(cam.snapshotUrl || "");
    setCamType(cam.cameraType);
    setCamAssignment(cam.assignment);
    setCamUsername(cam.username || "");
    setCamPassword(cam.password || "");
    setCamNotes(cam.notes || "");
    setAddModalOpen(true);
  };

  const handleIpChange = (newIp: string) => {
    setCamIp(newIp);
    const cleanIp = newIp.trim();
    if (cleanIp) {
      if (camType === "MJPEG") {
        setCamStreamUrl(`http://${cleanIp}:${camPort}/video`);
        setCamSnapshotUrl(`http://${cleanIp}:${camPort}/shot.jpg`);
      } else if (camType === "SNAPSHOT") {
        setCamStreamUrl(`http://${cleanIp}:${camPort}/snapshot.jpg`);
        setCamSnapshotUrl(`http://${cleanIp}:${camPort}/snapshot.jpg`);
      }
    }
  };

  const handleSaveCamera = () => {
    if (!camName.trim() || !camIp.trim()) {
      toast.error("Camera Name and IP Address are required");
      return;
    }
    if (camAssignment === "LICENSE_PLATE" && camType !== "SNAPSHOT" && !camSnapshotUrl.trim()) {
      toast.error("Scale entrance LPR requires an HTTP snapshot URL");
      return;
    }

    const camObj: IpCamera = {
      id: editingCam ? editingCam.id : `cam-${Date.now()}`,
      name: camName.trim(),
      ipAddress: camIp.trim(),
      port: camPort,
      streamUrl: camStreamUrl.trim(),
      snapshotUrl: camSnapshotUrl.trim() || undefined,
      cameraType: camType,
      assignment: camAssignment,
      username: camUsername.trim() || undefined,
      password: camPassword.trim() || undefined,
      isActive: true,
      notes: camNotes.trim() || undefined,
      createdAt: editingCam ? editingCam.createdAt : new Date().toISOString(),
    };

    storageService.saveIpCamera(camObj);
    loadData();
    setAddModalOpen(false);
    toast.success(`${editingCam ? "Updated" : "Added"} IP Camera: ${camObj.name}`);
  };

  const handleDeleteCamera = (cam: IpCamera) => {
    if (confirm(`Remove IP Camera "${cam.name}" (${cam.ipAddress})?`)) {
      storageService.removeIpCamera(cam.id);
      loadData();
      toast.info(`Removed camera ${cam.name}`);
    }
  };

  const handleToggleActive = (cam: IpCamera) => {
    const updated = { ...cam, isActive: !cam.isActive };
    storageService.saveIpCamera(updated);
    loadData();
    toast.success(`Camera ${cam.name} is now ${updated.isActive ? "ACTIVE" : "DISABLED"}`);
  };

  // ---- Alarm.com camera controls (server-managed) ----

  const handleToggleAdc = async (cam: IpCamera) => {
    try {
      await alarmComService.updateCamera(cam.adcDeviceId!, { isActive: !cam.isActive });
      await loadAdc();
      toast.success(`Camera ${cam.name} is now ${cam.isActive ? "PAUSED" : "ACTIVE"}`);
    } catch (error) {
      toast.error("Could not update Alarm.com camera", {
        description: error instanceof Error ? error.message : "Unknown server error",
      });
    }
  };

  const handleOpenAdcEdit = (cam: IpCamera) => {
    setAdcEditing(cam);
    setAdcEditAssignment(cam.assignment);
    setAdcEditNotes(cam.notes || "");
  };

  const handleSaveAdcEdit = async () => {
    if (!adcEditing?.adcDeviceId) return;
    setSavingAdc(true);
    try {
      await alarmComService.updateCamera(adcEditing.adcDeviceId, {
        assignment: adcEditAssignment,
        notes: adcEditNotes.trim() || null,
      });
      await loadAdc();
      setAdcEditing(null);
      toast.success(`Updated Alarm.com camera: ${adcEditing.name}`);
    } catch (error) {
      toast.error("Could not update Alarm.com camera", {
        description: error instanceof Error ? error.message : "Unknown server error",
      });
    } finally {
      setSavingAdc(false);
    }
  };

  const assignmentLabels: Record<IpCameraAssignment, { label: string; color: string; icon: any }> = {
    LICENSE_PLATE: { label: "Scale Entrance LPR", color: "text-sky-400 border-sky-500/40 bg-sky-950/60", icon: Scan },
    SELLER_FACE: { label: "Seller Face Verification", color: "text-purple-400 border-purple-500/40 bg-purple-950/60", icon: CreditCard },
    CARGO_BAY: { label: "Overhead Scale Cargo", color: "text-amber-400 border-amber-500/40 bg-amber-950/60", icon: Package },
    SCALE_DESK: { label: "Scale Desk Overall", color: "text-emerald-400 border-emerald-500/40 bg-emerald-950/60", icon: Camera },
    YARD_OVERVIEW: { label: "Yard Security Overview", color: "text-indigo-400 border-indigo-500/40 bg-indigo-950/60", icon: Car },
    OTHER: { label: "General View", color: "text-slate-300 border-slate-700 bg-slate-900", icon: Video },
  };

  const allCameras = [...cameras, ...adcCameras];
  const sessionDown =
    adcCameras.length > 0 &&
    (adcStatus?.status !== "CONNECTED" || Boolean(adcWarning));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-3.5 rounded-2xl bg-sky-600/20 text-sky-400 border border-sky-500/30">
              <Camera className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Camera Feeds & Video Stream Station
                </h1>
                <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/40 text-xs gap-1">
                  <Radio className="w-3 h-3 text-sky-400 animate-pulse" /> LIVE STREAM HUB
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Local IP cameras plus Alarm.com cloud cameras — scale & compliance feeds in one monitoring wall
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => { loadData(); void loadAdc(); }}
              variant="outline"
              className="border-slate-800 bg-slate-900 text-slate-300 hover:text-white text-xs gap-1 h-9"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Feeds
            </Button>
            <Button
              onClick={handleOpenAdd}
              className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs gap-1.5 shadow-lg shadow-sky-950"
            >
              <Plus className="w-4 h-4" /> Add IP Camera
            </Button>
          </div>
        </div>

        {/* Alarm.com session banner */}
        {sessionDown && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="flex-1 text-sm text-amber-100">
              <strong>Alarm.com session {adcStatus?.status === "NEEDS_OTP" ? "is waiting for its 2FA code" : "expired"}</strong>
              <span className="text-amber-200/80"> — cloud camera tiles are offline until it is reconnected.</span>
              {adcWarning ? <span className="block text-xs text-amber-200/70 mt-0.5">{adcWarning}</span> : null}
            </div>
            {isAdmin ? (
              <Button asChild className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs h-9">
                <Link to="/server-admin">Re-connect in Server Admin</Link>
              </Button>
            ) : (
              <span className="text-xs text-amber-200/80">Ask an administrator to reconnect (Server Admin → Alarm.com)</span>
            )}
          </div>
        )}

        {/* Top Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Total Configured Cameras</p>
                <p className="text-2xl font-black text-sky-400 font-mono mt-0.5">
                  {allCameras.length}
                  {adcCameras.length > 0 && <span className="text-sm text-slate-500"> ({adcCameras.length} cloud)</span>}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Yard security & intake streams</p>
              </div>
              <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Camera className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Active Online Streams</p>
                <p className="text-2xl font-black text-emerald-400 font-mono mt-0.5">
                  {allCameras.filter((c) => c.isActive).length}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Connected to intake workstations</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Wifi className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">License Plate & Face AI Cams</p>
                <p className="text-2xl font-black text-purple-400 font-mono mt-0.5">
                  {allCameras.filter((c) => c.assignment === "LICENSE_PLATE" || c.assignment === "SELLER_FACE").length}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Automated OCR inspection sources</p>
              </div>
              <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Scan className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Camera Feeds Multi-Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Video className="w-5 h-5 text-sky-400" /> Live Multi-Camera Stream Grid ({allCameras.length})
            </h2>
          </div>

          {allCameras.length === 0 ? (
            <Card className="bg-slate-900 border-slate-800 text-slate-400 p-12 text-center space-y-3">
              <Camera className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-white">No Cameras Added Yet</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Tap <strong>"Add IP Camera"</strong> to enter camera IP addresses (e.g. 192.168.1.150) for scale desk license plate OCR — or connect
                your <strong>Alarm.com</strong> cloud cameras from Server Admin → Alarm.com.
              </p>
              <Button onClick={handleOpenAdd} className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs gap-1.5">
                <Plus className="w-4 h-4" /> Add Your First IP Camera
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allCameras.map((cam) => {
                const isAdc = cam.provider === "ALARM_COM";
                const assignInfo = assignmentLabels[cam.assignment] || assignmentLabels.OTHER;
                const AssignIcon = assignInfo.icon;

                return (
                  <Card
                    key={cam.id}
                    className={`bg-slate-900 border-2 text-white shadow-xl overflow-hidden flex flex-col justify-between transition-all ${
                      cam.isActive ? "border-slate-800 hover:border-sky-500/60" : "border-slate-800/60 opacity-60"
                    }`}
                  >
                    {/* Stream Viewport Header */}
                    <CardHeader className="py-3 px-4 bg-slate-950/80 border-b border-slate-800 flex flex-row items-center justify-between">
                      <div className="space-y-0.5">
                        <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
                          {isAdc ? <Cloud className="w-4 h-4 text-sky-400 shrink-0" /> : <AssignIcon className="w-4 h-4 text-sky-400 shrink-0" />}
                          <span className="truncate max-w-[180px]">{cam.name}</span>
                        </CardTitle>
                        <p className="text-[10px] text-slate-400 font-mono truncate">
                          {isAdc
                            ? `alarm.com${cam.adcLocation ? ` · ${cam.adcLocation}` : ""}`
                            : `${cam.ipAddress}:${cam.port || 8080}`}
                        </p>
                      </div>

                      <Badge className={`text-[10px] font-mono border ${assignInfo.color}`}>
                        {assignInfo.label}
                      </Badge>
                    </CardHeader>

                    {/* Stream Live Preview Frame */}
                    <div className="relative aspect-video bg-black overflow-hidden flex items-center justify-center border-b border-slate-800">
                      {isAdc ? (
                        <AdcSnapshotView cam={cam} refreshMs={ADC_TILE_REFRESH_MS} />
                      ) : cam.isActive ? (
                        cam.cameraType === "SNAPSHOT" ? (
                          <img
                            src={`${cam.snapshotUrl || cam.streamUrl}?t=${Date.now()}`}
                            alt={cam.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'><rect width='640' height='360' fill='%230f172a'/><text x='320' y='180' fill='%2338bdf8' font-family='monospace' font-size='16' font-weight='bold' text-anchor='middle'>IP STREAM READY (" +
                                cam.ipAddress +
                                ")</text></svg>";
                            }}
                          />
                        ) : (
                          <img
                            src={cam.streamUrl}
                            alt={cam.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'><rect width='640' height='360' fill='%230f172a'/><text x='320' y='180' fill='%2338bdf8' font-family='monospace' font-size='16' font-weight='bold' text-anchor='middle'>IP STREAM READY (" +
                                cam.ipAddress +
                                ")</text></svg>";
                            }}
                          />
                        )
                      ) : (
                        <div className="text-center p-6 space-y-1">
                          <WifiOff className="w-8 h-8 text-slate-600 mx-auto" />
                          <span className="text-xs text-slate-500 font-mono block">CAMERA STREAM PAUSED</span>
                        </div>
                      )}

                      {/* Stream Badge Overlay */}
                      <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
                        <Badge
                          className={`text-[9px] font-mono uppercase ${
                            cam.isActive
                              ? "bg-emerald-950/90 text-emerald-300 border-emerald-500/40"
                              : "bg-slate-900 text-slate-400 border-slate-700"
                          }`}
                        >
                          {cam.isActive ? "ONLINE" : "DISABLED"}
                        </Badge>
                        {isAdc ? (
                          <Badge variant="outline" className="bg-sky-950/80 text-sky-300 border-sky-500/40 text-[9px] font-mono gap-1">
                            <Cloud className="w-2.5 h-2.5" /> ALARM.COM
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-slate-950/80 text-slate-300 border-slate-800 text-[9px] font-mono">
                            {cam.cameraType}
                          </Badge>
                        )}
                      </div>

                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={() => setSelectedCamForFullscreen(cam)}
                        className="absolute bottom-2 right-2 h-7 w-7 bg-slate-950/80 text-slate-200 hover:text-white border border-slate-800"
                        title="Fullscreen Stream"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {/* Camera Info & Controls Footer */}
                    <CardContent className="p-3.5 space-y-3">
                      {cam.notes && (
                        <p className="text-[11px] text-slate-400 font-sans line-clamp-1">{cam.notes}</p>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => (isAdc ? void handleToggleAdc(cam) : handleToggleActive(cam))}
                          className={`h-7 text-[11px] ${
                            cam.isActive ? "text-amber-400 hover:text-amber-300" : "text-emerald-400 hover:text-emerald-300"
                          }`}
                        >
                          {cam.isActive ? "Pause Stream" : "Enable Stream"}
                        </Button>

                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => (isAdc ? handleOpenAdcEdit(cam) : handleOpenEdit(cam))}
                            className="h-7 w-7 p-0 text-slate-300 hover:text-white"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                          </Button>
                          {!isAdc && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteCamera(cam)}
                              className="h-7 w-7 p-0 text-slate-500 hover:text-rose-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

      </main>

      {/* Add / Edit IP Camera Modal (local LAN cameras only) */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Camera className="w-5 h-5 text-sky-400" /> {editingCam ? "Edit IP Camera Config" : "Add IP Camera Feed"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-slate-300">Camera Name *</Label>
              <Input
                value={camName}
                onChange={(e) => setCamName(e.target.value)}
                placeholder="e.g. Scale License Plate OCR Cam"
                className="bg-slate-900 border-slate-800 text-white font-bold text-xs mt-1 h-10"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label className="text-slate-300">IP Address or Hostname *</Label>
                <Input
                  value={camIp}
                  onChange={(e) => handleIpChange(e.target.value)}
                  placeholder="192.168.1.150"
                  className="bg-slate-900 border-slate-800 text-sky-300 font-mono font-bold text-xs mt-1 h-10"
                />
              </div>

              <div>
                <Label className="text-slate-300">Port</Label>
                <Input
                  type="number"
                  value={camPort}
                  onChange={(e) => setCamPort(parseInt(e.target.value) || 8080)}
                  className="bg-slate-900 border-slate-800 text-white font-mono text-xs mt-1 h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-slate-300">Stream Protocol Type</Label>
                <select
                  value={camType}
                  onChange={(e) => setCamType(e.target.value as IpCameraType)}
                  className="w-full h-10 bg-slate-900 border border-slate-800 rounded-md text-xs text-white px-2 mt-1 font-mono"
                >
                  <option value="MJPEG">MJPEG Video Stream</option>
                  <option value="SNAPSHOT">HTTP Image Snapshot Refresh</option>
                  <option value="HLS">HLS / WebRTC Stream</option>
                  <option value="RTSP_STREAM">RTSP Network Stream</option>
                </select>
              </div>

              <div>
                <Label className="text-slate-300">Yard Workstation Assignment</Label>
                <select
                  value={camAssignment}
                  onChange={(e) => setCamAssignment(e.target.value as IpCameraAssignment)}
                  className="w-full h-10 bg-slate-900 border border-slate-800 rounded-md text-xs text-white px-2 mt-1"
                >
                  <option value="LICENSE_PLATE">Scale Entrance Automatic LPR</option>
                  <option value="SELLER_FACE">Seller Face Verification</option>
                  <option value="CARGO_BAY">Overhead Scale Cargo Bay</option>
                  <option value="SCALE_DESK">Scale Desk Overall</option>
                  <option value="YARD_OVERVIEW">Yard Security Overview</option>
                  <option value="OTHER">General View</option>
                </select>
              </div>
            </div>

            <div>
              <Label className="text-slate-300">Full Video Stream URL (Auto-Generated or Custom)</Label>
              <Input
                value={camStreamUrl}
                onChange={(e) => setCamStreamUrl(e.target.value)}
                placeholder="http://192.168.1.150:8080/video"
                className="bg-slate-900 border-slate-800 text-sky-300 font-mono text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-slate-300">Snapshot Image URL {camAssignment === "LICENSE_PLATE" ? "(Required for automatic entrance LPR)" : "(Optional)"}</Label>
              <Input
                value={camSnapshotUrl}
                onChange={(e) => setCamSnapshotUrl(e.target.value)}
                placeholder="http://192.168.1.150:8080/shot.jpg"
                className="bg-slate-900 border-slate-800 text-slate-300 font-mono text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-slate-300">Notes / Location Description</Label>
              <Input
                value={camNotes}
                onChange={(e) => setCamNotes(e.target.value)}
                placeholder="Positioned at scale desk drive-on tag line..."
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-800">
            <Button variant="ghost" onClick={() => setAddModalOpen(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button onClick={handleSaveCamera} className="bg-sky-600 hover:bg-sky-500 text-white font-bold">
              {editingCam ? "Update Camera" : "Save Camera"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Alarm.com Camera Modal (assignment + notes only) */}
      <Dialog open={!!adcEditing} onOpenChange={(open) => !open && setAdcEditing(null)}>
        <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Cloud className="w-5 h-5 text-sky-400" /> Edit Alarm.com Camera
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <p className="text-sm font-bold text-white">{adcEditing?.name}</p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                alarm.com{adcEditing?.adcLocation ? ` · ${adcEditing.adcLocation}` : ""} · device {adcEditing?.adcDeviceId}
              </p>
              <p className="text-[10px] text-slate-500 mt-1.5">
                Snapshot URLs are bridge-managed — only the yard assignment and notes can be edited here.
              </p>
            </div>

            <div>
              <Label className="text-slate-300">Yard Workstation Assignment</Label>
              <select
                value={adcEditAssignment}
                onChange={(e) => setAdcEditAssignment(e.target.value as IpCameraAssignment)}
                className="w-full h-10 bg-slate-900 border border-slate-800 rounded-md text-xs text-white px-2 mt-1"
              >
                <option value="LICENSE_PLATE">Scale Entrance Automatic LPR</option>
                <option value="SELLER_FACE">Seller Face Verification</option>
                <option value="CARGO_BAY">Overhead Scale Cargo Bay</option>
                <option value="SCALE_DESK">Scale Desk Overall</option>
                <option value="YARD_OVERVIEW">Yard Security Overview</option>
                <option value="OTHER">General View</option>
              </select>
            </div>

            <div>
              <Label className="text-slate-300">Notes / Location Description</Label>
              <Input
                value={adcEditNotes}
                onChange={(e) => setAdcEditNotes(e.target.value)}
                placeholder="e.g. Building front, left of the main gate"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-800">
            <Button variant="ghost" onClick={() => setAdcEditing(null)} className="text-slate-400">
              Cancel
            </Button>
            <Button onClick={() => void handleSaveAdcEdit()} disabled={savingAdc} className="bg-sky-600 hover:bg-sky-500 text-white font-bold">
              {savingAdc ? "Saving…" : "Update Camera"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Camera Stream Dialog */}
      {selectedCamForFullscreen && (
        <Dialog open={!!selectedCamForFullscreen} onOpenChange={() => setSelectedCamForFullscreen(null)}>
          <DialogContent className="bg-black text-white border-slate-800 max-w-4xl p-4">
            <DialogHeader className="border-b border-slate-800 pb-2 flex flex-row items-center justify-between">
              <div>
                <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                  {selectedCamForFullscreen.provider === "ALARM_COM" ? (
                    <Cloud className="w-5 h-5 text-sky-400" />
                  ) : (
                    <Video className="w-5 h-5 text-sky-400" />
                  )}
                  {selectedCamForFullscreen.name}
                </DialogTitle>
                <p className="text-xs text-slate-400 font-mono">
                  {selectedCamForFullscreen.provider === "ALARM_COM"
                    ? `alarm.com${selectedCamForFullscreen.adcLocation ? ` · ${selectedCamForFullscreen.adcLocation}` : ""} · auto-refresh ${ADC_FULLSCREEN_REFRESH_MS / 1000}s`
                    : `${selectedCamForFullscreen.ipAddress}:${selectedCamForFullscreen.port || 8080}`}
                </p>
              </div>
            </DialogHeader>

            <div className="aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center my-2 relative">
              {selectedCamForFullscreen.provider === "ALARM_COM" ? (
                <AdcSnapshotView cam={selectedCamForFullscreen} refreshMs={ADC_FULLSCREEN_REFRESH_MS} large />
              ) : (
                <img
                  src={selectedCamForFullscreen.streamUrl}
                  alt={selectedCamForFullscreen.name}
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            {selectedCamForFullscreen.provider === "ALARM_COM" && selectedCamForFullscreen.adcDeviceId && (
              <AdcClipsPanel deviceId={selectedCamForFullscreen.adcDeviceId} />
            )}
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}

/** Recent motion-triggered recordings for the fullscreen Alarm.com camera. */
function AdcClipsPanel({ deviceId }: { deviceId: string }) {
  const [clips, setClips] = useState<AdcClip[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadClips = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await alarmComService.fetchClips(deviceId);
      setClips(response.clips);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Alarm.com did not return the clip list");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <Film className="w-3.5 h-3.5 text-sky-400" /> Recent motion clips
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void loadClips()}
          disabled={loading}
          className="h-7 text-[10px] border-slate-800 bg-slate-900 text-slate-300 hover:text-white gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          {clips ? "Reload" : "Load clips"}
        </Button>
      </div>

      {error ? (
        <p className="mt-2 text-[11px] text-amber-300/80">{error}</p>
      ) : clips === null ? (
        <p className="mt-2 text-[11px] text-slate-500">
          Motion-triggered recordings from alarm.com (unofficial API — list may be empty if the endpoint changed).
        </p>
      ) : clips.length === 0 ? (
        <p className="mt-2 text-[11px] text-slate-500">No recent clips for this camera.</p>
      ) : (
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2 max-h-44 overflow-y-auto pr-1">
          {clips.slice(0, 10).map((clip) => (
            <div key={clip.clipId} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-200 truncate">{clip.name || "Motion clip"}</p>
                <p className="text-[10px] text-slate-500 font-mono">
                  {clip.startTime ? new Date(clip.startTime).toLocaleString() : ""}
                  {clip.durationSeconds ? ` · ${Math.round(clip.durationSeconds)}s` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={clip.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-sky-600/80 hover:bg-sky-500 text-white text-[10px] font-bold px-2 py-1"
                >
                  <ExternalLink className="w-3 h-3" /> Watch
                </a>
                <a
                  href={clip.videoUrl}
                  download={`adc-clip-${clip.clipId}.mp4`}
                  className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 p-1"
                  title="Download MP4"
                >
                  <Download className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
