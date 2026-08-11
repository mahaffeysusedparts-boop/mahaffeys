import React, { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Camera,
  CreditCard,
  Car,
  Package,
  CheckCircle2,
  AlertCircle,
  Scan,
  Upload,
  Zap,
  Sparkles,
  ShieldCheck,
  UserCheck,
  Trash2,
  Video,
  RefreshCw,
} from "lucide-react";
import { ComplianceCaptures } from "@/types/scrap";
import {
  DLScanResult,
  SAMPLE_DL_PROFILES,
  generateSamplePhoto,
  calculateComplianceScore,
} from "@/utils/complianceUtils";
import { toast } from "sonner";

interface ComplianceCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCaptures?: ComplianceCaptures;
  onSaveCaptures: (captures: ComplianceCaptures, scannedProfile?: DLScanResult) => void;
  intakeType?: 'CAR_SALVAGE' | 'SCRAP_METAL';
}

export const ComplianceCaptureModal: React.FC<ComplianceCaptureModalProps> = ({
  isOpen,
  onClose,
  initialCaptures,
  onSaveCaptures,
}) => {
  const [captures, setCaptures] = useState<ComplianceCaptures>(
    initialCaptures || {
      personPhotoUrl: undefined,
      idPhotoUrl: undefined,
      vehiclePhotoUrl: undefined,
      licensePlatePhotoUrl: undefined,
      loadPhotoUrl: undefined,
    }
  );

  const [activeTab, setActiveTab] = useState<string>("id");
  const [scannedProfile, setScannedProfile] = useState<DLScanResult | undefined>();
  const [isCapturing, setIsCapturing] = useState(false);
  const [useLiveCamera, setUseLiveCamera] = useState(false);

  // References for iPad Camera & File inputs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentUploadTarget, setCurrentUploadTarget] = useState<keyof ComplianceCaptures | null>(null);

  const complianceStats = calculateComplianceScore(captures);

  // Cleanup camera stream when modal closes
  useEffect(() => {
    if (!isOpen) {
      stopCameraStream();
    }
  }, [isOpen]);

  const stopCameraStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setUseLiveCamera(false);
  };

  // Launch live iPad Web Camera Stream
  const handleStartLiveCamera = async (targetKey: keyof ComplianceCaptures) => {
    setCurrentUploadTarget(targetKey);
    setUseLiveCamera(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.warn("Camera stream fallback to native file input:", err);
      toast.info("Opening iPad native camera...");
      handleTriggerCameraInput(targetKey);
    }
  };

  // Capture frame from iPad live camera video element
  const handleCaptureVideoFrame = () => {
    if (videoRef.current && canvasRef.current && currentUploadTarget) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

        setCaptures((prev) => ({
          ...prev,
          [currentUploadTarget]: dataUrl,
        }));

        toast.success("Photo captured from iPad camera!");
        stopCameraStream();
      }
    }
  };

  // Open native iPad device camera picker directly
  const handleTriggerCameraInput = (key: keyof ComplianceCaptures) => {
    setCurrentUploadTarget(key);
    cameraInputRef.current?.click();
  };

  const handleTriggerUpload = (key: keyof ComplianceCaptures) => {
    setCurrentUploadTarget(key);
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentUploadTarget) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setCaptures((prev) => ({
          ...prev,
          [currentUploadTarget]: result,
        }));
        toast.success("Photo uploaded successfully");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateSample = (key: keyof ComplianceCaptures, type: 'person' | 'id' | 'vehicle' | 'plate' | 'load') => {
    setIsCapturing(true);
    setTimeout(() => {
      const url = generateSamplePhoto(type);
      setCaptures((prev) => ({
        ...prev,
        [key]: url,
      }));
      setIsCapturing(false);
      toast.success(`${type.toUpperCase()} snapshot captured successfully!`);
    }, 250);
  };

  const handleScanDlProfile = (profile: DLScanResult) => {
    setIsCapturing(true);
    setTimeout(() => {
      const idPhoto = generateSamplePhoto('id');
      const platePhoto = generateSamplePhoto('plate');
      const personPhoto = generateSamplePhoto('person');

      setCaptures((prev) => ({
        ...prev,
        idPhotoUrl: idPhoto,
        licensePlatePhotoUrl: prev.licensePlatePhotoUrl || platePhoto,
        personPhotoUrl: prev.personPhotoUrl || personPhoto,
      }));
      setScannedProfile(profile);
      setIsCapturing(false);
      toast.success(`DL Barcode Scanned: ${profile.fullName} (${profile.idNumber})`, {
        description: "Customer fields and license plate auto-filled!",
      });
    }, 300);
  };

  const handleClearCapture = (key: keyof ComplianceCaptures) => {
    setCaptures((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  const handleOneClickStudioScan = () => {
    setIsCapturing(true);
    setTimeout(() => {
      const randomProfile = SAMPLE_DL_PROFILES[Math.floor(Math.random() * SAMPLE_DL_PROFILES.length)];
      const updated: ComplianceCaptures = {
        personPhotoUrl: generateSamplePhoto('person'),
        idPhotoUrl: generateSamplePhoto('id'),
        vehiclePhotoUrl: generateSamplePhoto('vehicle'),
        licensePlatePhotoUrl: generateSamplePhoto('plate'),
        loadPhotoUrl: generateSamplePhoto('load'),
      };
      setCaptures(updated);
      setScannedProfile(randomProfile);
      setIsCapturing(false);
      toast.success("100% Studio Photo Capture Completed!", {
        description: `Verified for ${randomProfile.fullName} (${randomProfile.idNumber})`,
      });
    }, 400);
  };

  const handleSave = () => {
    stopCameraStream();
    onSaveCaptures(captures, scannedProfile);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) stopCameraStream(); onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[94vh] overflow-y-auto bg-slate-950 text-slate-100 border-slate-800 p-4 sm:p-6">
        
        {/* iPad Camera Native Input */}
        <input
          type="file"
          ref={cameraInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          capture="environment"
          className="hidden"
        />

        {/* Regular Upload Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          className="hidden"
        />

        <canvas ref={canvasRef} className="hidden" />

        <DialogHeader className="space-y-2 border-b border-slate-800 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  iPad 5-Point Photo & ID Compliance Studio
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-xs mt-0.5">
                  State Scrap Theft Statute & NMVTIS Anti-Fraud Digital Audit Suite
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${
                  complianceStats.score === 100
                    ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/50"
                    : "bg-amber-950/80 text-amber-400 border-amber-500/50"
                }`}
              >
                {complianceStats.score === 100 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-400 inline" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 mr-1.5 text-amber-400 inline" />
                )}
                {complianceStats.score}% Compliant
              </Badge>

              <Button
                size="sm"
                onClick={handleOneClickStudioScan}
                disabled={isCapturing}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-none shadow-md text-xs font-bold gap-1.5 min-h-[40px] px-4"
              >
                <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
                Auto-Studio (1-Click)
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Live iPad Web Camera Stream overlay if active */}
        {useLiveCamera && (
          <div className="p-4 bg-slate-900 border-2 border-emerald-500/50 rounded-2xl space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
              <span className="flex items-center gap-1.5">
                <Video className="w-4 h-4 animate-pulse" /> Live iPad Camera Viewfinder
              </span>
              <Button size="sm" variant="ghost" onClick={stopCameraStream} className="h-7 text-slate-400">
                Close Viewfinder
              </Button>
            </div>
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <div className="absolute inset-0 border-2 border-dashed border-emerald-400/40 pointer-events-none rounded-xl" />
            </div>
            <Button
              onClick={handleCaptureVideoFrame}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm gap-2 shadow-lg shadow-emerald-950"
            >
              <Camera className="w-5 h-5" /> Snap Photo Now
            </Button>
          </div>
        )}

        {/* Live Thumbnails Bar - Optimized 48px touch targets for iPad */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 my-3 p-2.5 bg-slate-900 rounded-xl border border-slate-800">
          {[
            { id: 'idPhotoUrl', title: 'DL / State ID', icon: CreditCard, val: captures.idPhotoUrl, tab: 'id' },
            { id: 'personPhotoUrl', title: 'Seller Face', icon: UserCheck, val: captures.personPhotoUrl, tab: 'person' },
            { id: 'vehiclePhotoUrl', title: 'Vehicle 45°', icon: Car, val: captures.vehiclePhotoUrl, tab: 'vehicle' },
            { id: 'licensePlatePhotoUrl', title: 'License Plate', icon: Scan, val: captures.licensePlatePhotoUrl, tab: 'plate' },
            { id: 'loadPhotoUrl', title: 'Cargo / Load', icon: Package, val: captures.loadPhotoUrl, tab: 'load' },
          ].map((item) => {
            const Icon = item.icon;
            const isDone = !!item.val;
            return (
              <div
                key={item.id}
                onClick={() => setActiveTab(item.tab)}
                className={`relative group cursor-pointer p-2 rounded-xl border text-center transition-all ${
                  isDone
                    ? "bg-slate-800/90 border-emerald-500/60 hover:border-emerald-400"
                    : "bg-slate-950/80 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="aspect-video bg-slate-950 rounded-lg overflow-hidden relative flex items-center justify-center mb-1 border border-slate-800/80">
                  {item.val ? (
                    <img src={item.val} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <Icon className="w-5 h-5 text-slate-500" />
                  )}
                  {isDone && (
                    <span className="absolute top-1 right-1 bg-emerald-500 text-slate-950 p-0.5 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-bold text-slate-200 truncate">{item.title}</div>
                <div className="text-[9px] font-semibold text-slate-500">
                  {isDone ? "VERIFIED" : "TAP TO CAPTURE"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Workspace Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 sm:grid-cols-5 bg-slate-900 border border-slate-800 p-1 rounded-xl h-auto">
            <TabsTrigger value="id" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs gap-1.5 h-10 font-bold">
              <CreditCard className="w-4 h-4" /> ID Scan
            </TabsTrigger>
            <TabsTrigger value="person" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs gap-1.5 h-10 font-bold">
              <UserCheck className="w-4 h-4" /> Seller Face
            </TabsTrigger>
            <TabsTrigger value="vehicle" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs gap-1.5 h-10 font-bold">
              <Car className="w-4 h-4" /> Vehicle
            </TabsTrigger>
            <TabsTrigger value="plate" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs gap-1.5 h-10 font-bold">
              <Scan className="w-4 h-4" /> Plate
            </TabsTrigger>
            <TabsTrigger value="load" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs gap-1.5 h-10 font-bold">
              <Package className="w-4 h-4" /> Cargo
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: ID BARCODE / OCR SCANNER */}
          <TabsContent value="id" className="mt-3 space-y-4">
            <Card className="bg-slate-900 border-slate-800 text-slate-100">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2 text-blue-400">
                    <CreditCard className="w-4 h-4" /> Driver License / State ID Scanner
                  </span>
                  {captures.idPhotoUrl && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">ID Verified</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid md:grid-cols-2 gap-6 items-center">
                  <div className="relative aspect-video bg-slate-950 rounded-xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center p-4 overflow-hidden group">
                    {captures.idPhotoUrl ? (
                      <>
                        <img src={captures.idPhotoUrl} alt="ID Scan" className="w-full h-full object-contain rounded" />
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button size="sm" variant="secondary" onClick={() => handleTriggerCameraInput('idPhotoUrl')}>
                            <Camera className="w-3.5 h-3.5 mr-1" /> Re-Snap
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleClearCapture('idPhotoUrl')}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center space-y-2">
                        <div className="w-12 h-12 mx-auto rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                          <Scan className="w-6 h-6 animate-pulse" />
                        </div>
                        <p className="text-xs text-slate-400">Point iPad camera at DL or tap camera button below</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => handleTriggerCameraInput('idPhotoUrl')}
                        className="h-11 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-1.5"
                      >
                        <Camera className="w-4 h-4" /> iPad Camera
                      </Button>
                      <Button
                        onClick={() => handleStartLiveCamera('idPhotoUrl')}
                        className="h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs gap-1.5"
                      >
                        <Video className="w-4 h-4" /> Live Video
                      </Button>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-300 block">Simulate Barcode Scan:</span>
                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                        {SAMPLE_DL_PROFILES.map((profile, i) => (
                          <div
                            key={i}
                            onClick={() => handleScanDlProfile(profile)}
                            className="p-2.5 rounded-lg border bg-slate-950/80 border-slate-800 hover:border-blue-500 cursor-pointer text-xs flex items-center justify-between"
                          >
                            <div>
                              <div className="font-bold text-slate-100">{profile.fullName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{profile.idNumber} ({profile.idState})</div>
                            </div>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-400">
                              Scan
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: SELLER FACE SHOT */}
          <TabsContent value="person" className="mt-3 space-y-4">
            <Card className="bg-slate-900 border-slate-800 text-slate-100">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2 text-blue-400">
                    <UserCheck className="w-4 h-4" /> Seller Face Identification Shot
                  </span>
                  {captures.personPhotoUrl && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Face Shot Clear</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid md:grid-cols-2 gap-6 items-center">
                  <div className="relative aspect-video bg-slate-950 rounded-xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center p-4 overflow-hidden group">
                    {captures.personPhotoUrl ? (
                      <>
                        <img src={captures.personPhotoUrl} alt="Seller Face" className="w-full h-full object-cover rounded" />
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button size="sm" variant="secondary" onClick={() => handleTriggerCameraInput('personPhotoUrl')}>
                            <Camera className="w-3.5 h-3.5 mr-1" /> Re-Snap
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleClearCapture('personPhotoUrl')}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center space-y-2">
                        <UserCheck className="w-10 h-10 mx-auto text-slate-600" />
                        <p className="text-xs text-slate-400">Direct iPad front/rear camera at seller</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => handleTriggerCameraInput('personPhotoUrl')}
                        className="h-12 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-1.5"
                      >
                        <Camera className="w-4 h-4" /> iPad Camera
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleGenerateSample('personPhotoUrl', 'person')}
                        className="h-12 border-slate-700 bg-slate-800 text-slate-200 text-xs font-bold"
                      >
                        <Sparkles className="w-4 h-4 text-amber-400" /> Sample Image
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: VEHICLE SHOT */}
          <TabsContent value="vehicle" className="mt-3 space-y-4">
            <Card className="bg-slate-900 border-slate-800 text-slate-100">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2 text-blue-400">
                    <Car className="w-4 h-4" /> Vehicle 45° Angle Front Snapshot
                  </span>
                  {captures.vehiclePhotoUrl && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Vehicle Captured</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid md:grid-cols-2 gap-6 items-center">
                  <div className="relative aspect-video bg-slate-950 rounded-xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center p-4 overflow-hidden group">
                    {captures.vehiclePhotoUrl ? (
                      <>
                        <img src={captures.vehiclePhotoUrl} alt="Vehicle" className="w-full h-full object-cover rounded" />
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button size="sm" variant="secondary" onClick={() => handleTriggerCameraInput('vehiclePhotoUrl')}>
                            <Camera className="w-3.5 h-3.5 mr-1" /> Re-Snap
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleClearCapture('vehiclePhotoUrl')}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center space-y-2">
                        <Car className="w-10 h-10 mx-auto text-slate-600" />
                        <p className="text-xs text-slate-400">Snap vehicle overall body condition</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Button
                      onClick={() => handleTriggerCameraInput('vehiclePhotoUrl')}
                      className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-1.5"
                    >
                      <Camera className="w-4 h-4" /> Snap Vehicle with iPad Camera
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: LICENSE PLATE SHOT */}
          <TabsContent value="plate" className="mt-3 space-y-4">
            <Card className="bg-slate-900 border-slate-800 text-slate-100">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2 text-blue-400">
                    <Scan className="w-4 h-4" /> License Plate & Tag OCR Snapshot
                  </span>
                  {captures.licensePlatePhotoUrl && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Plate Verified</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid md:grid-cols-2 gap-6 items-center">
                  <div className="relative aspect-video bg-slate-950 rounded-xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center p-4 overflow-hidden group">
                    {captures.licensePlatePhotoUrl ? (
                      <>
                        <img src={captures.licensePlatePhotoUrl} alt="License Plate" className="w-full h-full object-cover rounded" />
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button size="sm" variant="secondary" onClick={() => handleTriggerCameraInput('licensePlatePhotoUrl')}>
                            <Camera className="w-3.5 h-3.5 mr-1" /> Re-Snap
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleClearCapture('licensePlatePhotoUrl')}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center space-y-2">
                        <Scan className="w-10 h-10 mx-auto text-slate-600" />
                        <p className="text-xs text-slate-400">Snap close-up of vehicle rear tag</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Button
                      onClick={() => handleTriggerCameraInput('licensePlatePhotoUrl')}
                      className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-1.5"
                    >
                      <Camera className="w-4 h-4" /> Snap Tag with iPad Camera
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 5: CARGO LOAD SHOT */}
          <TabsContent value="load" className="mt-3 space-y-4">
            <Card className="bg-slate-900 border-slate-800 text-slate-100">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2 text-blue-400">
                    <Package className="w-4 h-4" /> Scrap Cargo / Load Bed Snapshot
                  </span>
                  {captures.loadPhotoUrl && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Cargo Captured</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid md:grid-cols-2 gap-6 items-center">
                  <div className="relative aspect-video bg-slate-950 rounded-xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center p-4 overflow-hidden group">
                    {captures.loadPhotoUrl ? (
                      <>
                        <img src={captures.loadPhotoUrl} alt="Cargo Load" className="w-full h-full object-cover rounded" />
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button size="sm" variant="secondary" onClick={() => handleTriggerCameraInput('loadPhotoUrl')}>
                            <Camera className="w-3.5 h-3.5 mr-1" /> Re-Snap
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleClearCapture('loadPhotoUrl')}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center space-y-2">
                        <Package className="w-10 h-10 mx-auto text-slate-600" />
                        <p className="text-xs text-slate-400">Snap overhead or scale bed view</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Button
                      onClick={() => handleTriggerCameraInput('loadPhotoUrl')}
                      className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-1.5"
                    >
                      <Camera className="w-4 h-4" /> Snap Cargo Bed with iPad
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer actions */}
        <DialogFooter className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
          <Button variant="ghost" onClick={() => { stopCameraStream(); onClose(); }} className="text-slate-400 text-xs">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold px-6 h-11 gap-1.5 shadow-lg shadow-emerald-950"
          >
            <CheckCircle2 className="w-4 h-4" /> Apply Photo Suite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};