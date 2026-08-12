import React, { useState, useEffect } from "react";
import { storageService } from "@/services/storageService";
import { IpCamera, IpCameraType, IpCameraAssignment } from "@/types/scrap";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Camera,
  Plus,
  Video,
  Scan,
  CheckCircle2,
  Trash2,
  Edit3,
  RefreshCw,
  Eye,
  Wifi,
  WifiOff,
  Sparkles,
  ShieldCheck,
  Maximize2,
  Layers,
  Activity,
  Car,
  CreditCard,
  Package,
  Globe,
  Radio,
} from "lucide-react";
import { toast } from "sonner";

export default function CamerasPage() {
  const [cameras, setCameras] = useState<IpCamera[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingCam, setEditingVeh] = useState<IpCamera | null>(null);
  const [selectedCamForFullscreen, setSelectedCamForFullscreen] = useState<IpCamera | null>(null);

  // Form State
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

  const loadData = () => {
    setCameras(storageService.getIpCameras());
  };

  useEffect(() => {
    loadData();
  }, []);

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
    setCamNotes("Positioned for scale drive-on vehicle tag capture");
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

  // Helper to build stream URL when user types IP/port
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
      storageService.deleteIpCamera(cam.id);
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

  const assignmentLabels: Record<IpCameraAssignment, { label: string; color: string; icon: any }> = {
    LICENSE_PLATE: { label: "License Plate OCR", color: "text-sky-400 border-sky-500/40 bg-sky-950/60", icon: Scan },
    SELLER_FACE: { label: "Seller Face Verification", color: "text-purple-400 border-purple-500/40 bg-purple-950/60", icon: CreditCard },
    CARGO_BAY: { label: "Overhead Scale Cargo", color: "text-amber-400 border-amber-500/40 bg-amber-950/60", icon: Package },
    SCALE_DESK: { label: "Scale Desk Overall", color: "text-emerald-400 border-emerald-500/40 bg-emerald-950/60", icon: Camera },
    YARD_OVERVIEW: { label: "Yard Security Overview", color: "text-indigo-400 border-indigo-500/40 bg-indigo-950/60", icon: Car },
    OTHER: { label: "General View", color: "text-slate-300 border-slate-700 bg-slate-900", icon: Video },
  };

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
                  IP Camera Feeds & Video Stream Station
                </h1>
                <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/40 text-xs gap-1">
                  <Radio className="w-3 h-3 text-sky-400 animate-pulse" /> LIVE STREAM HUB
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Add IP cameras by entering host IP addresses, stream URLs, or HTTP snapshot endpoints for scale & compliance feeds
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleOpenAdd}
              className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs gap-1.5 shadow-lg shadow-sky-950"
            >
              <Plus className="w-4 h-4" /> Add IP Camera
            </Button>
          </div>
        </div>

        {/* Top Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Total Configured IP Cameras</p>
                <p className="text-2xl font-black text-sky-400 font-mono mt-0.5">{cameras.length}</p>
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
                  {cameras.filter((c) => c.isActive).length}
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
                  {cameras.filter((c) => c.assignment === "LICENSE_PLATE" || c.assignment === "SELLER_FACE").length}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Automated OCR inspection sources</p>
              </div>
              <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Scan className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* IP Camera Feeds Multi-Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Video className="w-5 h-5 text-sky-400" /> Live Multi-Camera Stream Grid ({cameras.length})
            </h2>
            <Button
              size="sm"
              variant="outline"
              onClick={loadData}
              className="border-slate-800 bg-slate-900 text-slate-300 hover:text-white text-xs gap-1 h-8"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Feeds
            </Button>
          </div>

          {cameras.length === 0 ? (
            <Card className="bg-slate-900 border-slate-800 text-slate-400 p-12 text-center space-y-3">
              <Camera className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-white">No IP Cameras Added Yet</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Tap <strong>"Add IP Camera"</strong> to enter camera IP addresses (e.g. 192.168.1.150) for scale desk license plate OCR or seller face verification.
              </p>
              <Button onClick={handleOpenAdd} className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs gap-1.5">
                <Plus className="w-4 h-4" /> Add Your First IP Camera
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cameras.map((cam) => {
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
                          <AssignIcon className="w-4 h-4 text-sky-400 shrink-0" />
                          <span className="truncate max-w-[180px]">{cam.name}</span>
                        </CardTitle>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {cam.ipAddress}:{cam.port || 8080}
                        </p>
                      </div>

                      <Badge className={`text-[10px] font-mono border ${assignInfo.color}`}>
                        {assignInfo.label}
                      </Badge>
                    </CardHeader>

                    {/* Stream Live Preview Frame */}
                    <div className="relative aspect-video bg-black overflow-hidden flex items-center justify-center border-b border-slate-800">
                      {cam.isActive ? (
                        cam.cameraType === "SNAPSHOT" ? (
                          <img
                            src={`${cam.snapshotUrl || cam.streamUrl}?t=${Date.now()}`}
                            alt={cam.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback display if IP is unreachable locally
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
                        <Badge variant="outline" className="bg-slate-950/80 text-slate-300 border-slate-800 text-[9px] font-mono">
                          {cam.cameraType}
                        </Badge>
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
                          onClick={() => handleToggleActive(cam)}
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
                            onClick={() => handleOpenEdit(cam)}
                            className="h-7 w-7 p-0 text-slate-300 hover:text-white"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteCamera(cam)}
                            className="h-7 w-7 p-0 text-slate-500 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
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

      {/* Add / Edit IP Camera Modal */}
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
                  <option value="LICENSE_PLATE">License Plate OCR Cam</option>
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
              <Label className="text-slate-300">Snapshot Image URL (Optional for instant photo capture)</Label>
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

      {/* Fullscreen Camera Stream Dialog */}
      {selectedCamForFullscreen && (
        <Dialog open={!!selectedCamForFullscreen} onOpenChange={() => setSelectedCamForFullscreen(null)}>
          <DialogContent className="bg-black text-white border-slate-800 max-w-4xl p-4">
            <DialogHeader className="border-b border-slate-800 pb-2 flex flex-row items-center justify-between">
              <div>
                <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                  <Video className="w-5 h-5 text-sky-400" /> {selectedCamForFullscreen.name}
                </DialogTitle>
                <p className="text-xs text-slate-400 font-mono">{selectedCamForFullscreen.ipAddress}:{selectedCamForFullscreen.port || 8080}</p>
              </div>
            </DialogHeader>

            <div className="aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center my-2">
              <img
                src={selectedCamForFullscreen.streamUrl}
                alt={selectedCamForFullscreen.name}
                className="w-full h-full object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}