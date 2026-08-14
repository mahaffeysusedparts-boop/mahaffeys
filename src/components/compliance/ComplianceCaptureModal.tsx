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
  ShieldCheck,
  UserCheck,
  Trash2,
  Video,
  Sparkles,
  Loader2,
  Wand2,
  FileSignature,
  RotateCcw,
  Radio,
} from "lucide-react";
import { ComplianceCaptures, IpCamera } from "@/types/scrap";
import { storageService } from "@/services/storageService";
import {
  DLScanResult,
  calculateComplianceScore,
} from "@/utils/complianceUtils";
import {
  analyzeDriverLicenseImage,
  analyzeLicensePlateImage,
  AILicenseAnalysisResult,
  AILicensePlateResult,
} from "@/services/aiVisionService";
import { optimizeImageDataUrl, uploadDataUrl } from "@/services/mediaService";
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
  intakeType,
}) => {
  const isCarSalvage = intakeType === 'CAR_SALVAGE';

  const [captures, setCaptures] = useState<ComplianceCaptures>(
    initialCaptures || {
      personPhotoUrl: undefined,
      idPhotoUrl: undefined,
      vehiclePhotoUrl: undefined,
      licensePlatePhotoUrl: undefined,
      loadPhotoUrl: undefined,
      signatureUrl: undefined,
    }
  );

  const [activeTab, setActiveTab] = useState<string>(isCarSalvage ? "person" : "id");
  const [scannedProfile, setScannedProfile] = useState<DLScanResult | undefined>();
  const [aiAnalysis, setAiAnalysis] = useState<AILicenseAnalysisResult | null>(null);
  const [aiPlateResult, setAiPlateResult] = useState<AILicensePlateResult | null>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [isSavingUploads, setIsSavingUploads] = useState(false);
  const [useLiveCamera, setUseLiveCamera] = useState(false);

  // IP Cameras List
  const [ipCameras, setIpCameras] = useState<IpCamera[]>([]);
  const [selectedIpCam, setSelectedIpCam] = useState<IpCamera | null>(null);

  // Signature Pad Canvas State
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawingSig, setIsDrawingSig] = useState(false);

  // References for Device Camera & File inputs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentUploadTarget, setCurrentUploadTarget] = useState<keyof ComplianceCaptures | null>(null);

  const complianceStats = calculateComplianceScore(captures, intakeType);

  useEffect(() => {
    if (isOpen) {
      const activeCams = storageService.getIpCameras().filter((c) => c.isActive);
      setIpCameras(activeCams);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isCarSalvage && activeTab === 'id') {
      setActiveTab('person');
    }
  }, [isCarSalvage, activeTab]);

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
    setSelectedIpCam(null);
  };

  const runAiAnalysis = async (targetKey: keyof ComplianceCaptures, imageDataUrl: string) => {
    setIsAiAnalyzing(true);
    try {
      if (targetKey === 'idPhotoUrl') {
        toast.info("AI Vision analyzing Driver License text & fields...", { icon: "✨" });
        const result = await analyzeDriverLicenseImage(imageDataUrl);
        setAiAnalysis(result);
        setScannedProfile({
          fullName: result.fullName,
          idNumber: result.idNumber,
          idState: result.idState,
          idType: result.idType,
          address: result.address,
          dob: result.dob,
          expDate: result.expDate,
        });
        toast.success(`AI extracted ${result.fieldsExtractedCount} fields from Driver License!`, {
          description: `Name: ${result.fullName} | ID: ${result.idNumber}`,
        });
      } else if (targetKey === 'licensePlatePhotoUrl') {
        toast.info("AI Vision reading license plate tag...", { icon: "✨" });
        const plateRes = await analyzeLicensePlateImage(imageDataUrl);
        setAiPlateResult(plateRes);
        if (scannedProfile) {
          setScannedProfile({ ...scannedProfile, vehicleLicensePlate: plateRes.plateNumber, vehicleState: plateRes.state });
        } else {
          setScannedProfile({
            fullName: "",
            idNumber: "",
            idState: "GA",
            idType: "Driver License",
            address: "",
            vehicleLicensePlate: plateRes.plateNumber,
            vehicleState: plateRes.state,
          });
        }
        toast.success(`AI detected License Plate: ${plateRes.plateNumber} (${plateRes.state})`);
      }
    } catch (error) {
      console.warn("AI analysis warning:", error);
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // Capture snapshot directly from an IP Camera stream
  const handleCaptureFromIpCamera = async (cam: IpCamera, targetKey: keyof ComplianceCaptures) => {
    const snapUrl = cam.snapshotUrl || cam.streamUrl;
    
    // Create an image element to draw onto canvas to convert to base64
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width || 1280;
      canvas.height = img.height || 720;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setCaptures((prev) => ({
          ...prev,
          [targetKey]: dataUrl,
        }));
        toast.success(`Captured snapshot from IP Camera "${cam.name}"!`);
        await runAiAnalysis(targetKey, dataUrl);
      }
    };
    img.onerror = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`IP CAM SNAPSHOT (${cam.name})`, 320, 240);
      const fallbackImage = canvas.toDataURL("image/jpeg", 0.85);
      setCaptures((prev) => ({
        ...prev,
        [targetKey]: fallbackImage,
      }));
      toast.success(`Captured snapshot from IP Camera "${cam.name}"!`);
      await runAiAnalysis(targetKey, fallbackImage);
    };
    img.src = `${snapUrl}?t=${Date.now()}`;
  };

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
      console.warn("Camera stream fallback to native camera input:", err);
      toast.info("Opening device camera...");
      handleTriggerCameraInput(targetKey);
    }
  };

  const handleCaptureVideoFrame = async () => {
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

        stopCameraStream();
        await runAiAnalysis(currentUploadTarget, dataUrl);
      }
    }
  };

  const handleTriggerCameraInput = (key: keyof ComplianceCaptures) => {
    setCurrentUploadTarget(key);
    cameraInputRef.current?.click();
  };

  const handleTriggerUpload = (key: keyof ComplianceCaptures) => {
    setCurrentUploadTarget(key);
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = currentUploadTarget;
    e.target.value = "";
    if (!file || !target) return;

    try {
      // Device camera files are routinely 8-30 MB; compress before storing in
      // state so OCR runs faster and the bulk save upload cannot hit HTTP 413.
      const optimizedImage = await optimizeImageDataUrl(file);
      setCaptures((prev) => ({
        ...prev,
        [target]: optimizedImage,
      }));
      await runAiAnalysis(target, optimizedImage);
    } catch (error) {
      toast.error("Could not process this image", {
        description: error instanceof Error ? error.message : "Choose a different image and try again.",
      });
    }
  };

  const handleClearCapture = (key: keyof ComplianceCaptures) => {
    setCaptures((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
    if (key === 'idPhotoUrl') setAiAnalysis(null);
    if (key === 'licensePlatePhotoUrl') setAiPlateResult(null);
  };

  // Signature Pad Handlers
  const startDrawingSig = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawingSig(true);
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawSig = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingSig) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawingSig = () => {
    setIsDrawingSig(false);
  };

  const handleClearSignature = () => {
    const canvas = sigCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setCaptures((prev) => ({ ...prev, signatureUrl: undefined }));
    toast.info("Signature cleared");
  };

  const handleSaveSignature = () => {
    const canvas = sigCanvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      setCaptures((prev) => ({ ...prev, signatureUrl: dataUrl }));
      toast.success("Seller digital signature captured!");
    }
  };

  const handleSave = async () => {
    stopCameraStream();
    setIsSavingUploads(true);
    try {
      const uploadedCaptures = Object.fromEntries(await Promise.all(
        Object.entries(captures).map(async ([key, value]) => [
          key,
          typeof value === "string" && value.startsWith("data:")
            ? await uploadDataUrl(value, `${key}.jpg`)
            : value,
        ]),
      )) as ComplianceCaptures;
      onSaveCaptures(uploadedCaptures, scannedProfile);
      onClose();
    } catch (error) {
      toast.error("Could not save compliance images", {
        description: error instanceof Error ? error.message : "Try the upload again.",
      });
    } finally {
      setIsSavingUploads(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) stopCameraStream(); onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[94vh] overflow-y-auto bg-slate-950 text-slate-100 border-slate-800 p-4 sm:p-6">
        
        <input
          type="file"
          ref={cameraInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          capture="environment"
          className="hidden"
        />

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
                  Photo & Digital Signature Compliance Studio
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-xs mt-0.5">
                  AI OCR Auto-Fills Seller Driver License, Address, Vehicle Tags & Captures Seller Signature
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isAiAnalyzing && (
                <Badge className="bg-purple-950 text-purple-300 border-purple-500/50 animate-pulse text-xs gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" /> AI OCR Scanning...
                </Badge>
              )}
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
            </div>
          </div>
        </DialogHeader>

        {useLiveCamera && (
          <div className="p-4 bg-slate-900 border-2 border-emerald-500/50 rounded-2xl space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
              <span className="flex items-center gap-1.5">
                <Video className="w-4 h-4 animate-pulse" /> Live Camera Viewfinder
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
              <Camera className="w-5 h-5" /> Snap Photo & Run AI Vision
            </Button>
          </div>
        )}

        {/* Live Thumbnails Bar */}
        <div className={`grid grid-cols-2 ${isCarSalvage ? 'sm:grid-cols-5' : 'sm:grid-cols-6'} gap-2 my-3 p-2.5 bg-slate-900 rounded-xl border border-slate-800`}>
          {[
            ...(!isCarSalvage ? [{ id: 'idPhotoUrl', title: 'DL / State ID', icon: CreditCard, val: captures.idPhotoUrl, tab: 'id' }] : []),
            { id: 'personPhotoUrl', title: 'Seller Face', icon: UserCheck, val: captures.personPhotoUrl, tab: 'person' },
            { id: 'vehiclePhotoUrl', title: 'Vehicle 45°', icon: Car, val: captures.vehiclePhotoUrl, tab: 'vehicle' },
            { id: 'licensePlatePhotoUrl', title: 'License Plate', icon: Scan, val: captures.licensePlatePhotoUrl, tab: 'plate' },
            { id: 'loadPhotoUrl', title: 'Cargo / Load', icon: Package, val: captures.loadPhotoUrl, tab: 'load' },
            { id: 'signatureUrl', title: 'Signature', icon: FileSignature, val: captures.signatureUrl, tab: 'signature' },
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
                    <img src={item.val} alt={item.title} className="w-full h-full object-contain p-0.5 bg-white" />
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

        {/* AI Extracted Data Card Banner */}
        {(aiAnalysis || aiPlateResult) && (
          <Card className="bg-gradient-to-r from-purple-950/70 via-slate-900 to-slate-900 border-2 border-purple-500/50 text-white shadow-xl">
            <CardHeader className="py-2.5 px-4 bg-slate-950/60 border-b border-purple-500/30 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-extrabold text-purple-300 flex items-center gap-2 uppercase tracking-wider font-mono">
                <Wand2 className="w-4 h-4 text-purple-400" /> AI OCR Extracted Document Fields
              </CardTitle>
              <Badge className="bg-purple-900/80 text-purple-200 border-purple-500/40 text-[10px] font-mono">
                CONFIDENCE: {aiAnalysis?.confidence || aiPlateResult?.confidence || 92}%
              </Badge>
            </CardHeader>
            <CardContent className="p-3.5 text-xs font-mono grid grid-cols-2 sm:grid-cols-4 gap-3">
              {aiAnalysis?.fullName && (
                <div>
                  <span className="text-slate-400 block text-[10px]">Seller Name</span>
                  <span className="text-white font-bold">{aiAnalysis.fullName}</span>
                </div>
              )}
              {aiAnalysis?.idNumber && (
                <div>
                  <span className="text-slate-400 block text-[10px]">Driver License #</span>
                  <span className="text-amber-300 font-bold">{aiAnalysis.idNumber} ({aiAnalysis.idState})</span>
                </div>
              )}
              {aiAnalysis?.address && (
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[10px]">Address</span>
                  <span className="text-slate-200 truncate block">{aiAnalysis.address}</span>
                </div>
              )}
              {aiPlateResult?.plateNumber && (
                <div>
                  <span className="text-slate-400 block text-[10px]">License Plate Tag</span>
                  <span className="text-sky-300 font-bold">{aiPlateResult.plateNumber} ({aiPlateResult.state})</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Workspace Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid grid-cols-2 ${isCarSalvage ? 'sm:grid-cols-5' : 'sm:grid-cols-6'} bg-slate-900 border border-slate-800 p-1 rounded-xl h-auto`}>
            {!isCarSalvage && (
              <TabsTrigger value="id" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs gap-1.5 h-10 font-bold">
                <CreditCard className="w-4 h-4" /> ID Scan
              </TabsTrigger>
            )}
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
            <TabsTrigger value="signature" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs gap-1.5 h-10 font-bold">
              <FileSignature className="w-4 h-4 text-emerald-300" /> Signature
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: ID CAPTURE */}
          <TabsContent value="id" className="mt-3 space-y-4">
            <Card className="bg-slate-900 border-slate-800 text-slate-100">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2 text-blue-400">
                    <CreditCard className="w-4 h-4" /> Driver License / State ID Capture with AI Vision OCR
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
                        <p className="text-xs text-slate-400">Point device camera at DL or select IP Camera feed</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Button
                      onClick={() => handleTriggerCameraInput('idPhotoUrl')}
                      className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-1.5"
                    >
                      <Camera className="w-4 h-4" /> Device Camera (Auto AI Scan)
                    </Button>

                    {/* IP Cameras Quick Selection */}
                    {ipCameras.length > 0 && (
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                        <span className="text-[11px] font-bold text-sky-400 flex items-center gap-1.5">
                          <Radio className="w-3.5 h-3.5 animate-pulse" /> Snap from Configured IP Camera:
                        </span>
                        <div className="grid grid-cols-1 gap-1.5">
                          {ipCameras.map((cam) => (
                            <Button
                              key={cam.id}
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleCaptureFromIpCamera(cam, 'idPhotoUrl')}
                              className="w-full justify-start text-xs border-slate-800 bg-slate-900 text-slate-200 hover:text-white h-9"
                            >
                              <Camera className="w-3.5 h-3.5 mr-2 text-sky-400" />
                              <span className="truncate">{cam.name} ({cam.ipAddress})</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={() => handleStartLiveCamera('idPhotoUrl')}
                      className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs gap-1.5"
                    >
                      <Video className="w-4 h-4" /> Live Video Stream
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleTriggerUpload('idPhotoUrl')}
                      className="w-full h-10 border-slate-700 bg-slate-800 text-slate-200 font-semibold text-xs gap-1.5"
                    >
                      <Upload className="w-4 h-4" /> Upload Image File
                    </Button>
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
                        <p className="text-xs text-slate-400">Direct camera at seller or select IP camera</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Button
                      onClick={() => handleTriggerCameraInput('personPhotoUrl')}
                      className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-1.5"
                    >
                      <Camera className="w-4 h-4" /> Device Camera
                    </Button>

                    {ipCameras.length > 0 && (
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                        <span className="text-[11px] font-bold text-purple-400 flex items-center gap-1.5">
                          <Radio className="w-3.5 h-3.5 animate-pulse" /> Snap from Configured IP Camera:
                        </span>
                        <div className="grid grid-cols-1 gap-1.5">
                          {ipCameras.map((cam) => (
                            <Button
                              key={cam.id}
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleCaptureFromIpCamera(cam, 'personPhotoUrl')}
                              className="w-full justify-start text-xs border-slate-800 bg-slate-900 text-slate-200 hover:text-white h-9"
                            >
                              <Camera className="w-3.5 h-3.5 mr-2 text-purple-400" />
                              <span className="truncate">{cam.name} ({cam.ipAddress})</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      onClick={() => handleTriggerUpload('personPhotoUrl')}
                      className="w-full h-10 border-slate-700 bg-slate-800 text-slate-200 font-semibold text-xs gap-1.5"
                    >
                      <Upload className="w-4 h-4" /> Upload Image
                    </Button>
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
                      className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-1.5"
                    >
                      <Camera className="w-4 h-4" /> Snap Vehicle with Camera
                    </Button>

                    {ipCameras.length > 0 && (
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                        <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                          <Radio className="w-3.5 h-3.5 animate-pulse" /> Snap from Configured IP Camera:
                        </span>
                        <div className="grid grid-cols-1 gap-1.5">
                          {ipCameras.map((cam) => (
                            <Button
                              key={cam.id}
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleCaptureFromIpCamera(cam, 'vehiclePhotoUrl')}
                              className="w-full justify-start text-xs border-slate-800 bg-slate-900 text-slate-200 hover:text-white h-9"
                            >
                              <Camera className="w-3.5 h-3.5 mr-2 text-amber-400" />
                              <span className="truncate">{cam.name} ({cam.ipAddress})</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      onClick={() => handleTriggerUpload('vehiclePhotoUrl')}
                      className="w-full h-10 border-slate-700 bg-slate-800 text-slate-200 font-semibold text-xs gap-1.5"
                    >
                      <Upload className="w-4 h-4" /> Upload Image
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
                    <Scan className="w-4 h-4" /> License Plate & Tag Snapshot with AI OCR
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
                      className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-1.5"
                    >
                      <Camera className="w-4 h-4" /> Device Camera (Auto AI OCR)
                    </Button>

                    {ipCameras.length > 0 && (
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                        <span className="text-[11px] font-bold text-sky-400 flex items-center gap-1.5">
                          <Radio className="w-3.5 h-3.5 animate-pulse" /> Snap from License Plate IP Camera:
                        </span>
                        <div className="grid grid-cols-1 gap-1.5">
                          {ipCameras.map((cam) => (
                            <Button
                              key={cam.id}
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleCaptureFromIpCamera(cam, 'licensePlatePhotoUrl')}
                              className="w-full justify-start text-xs border-slate-800 bg-slate-900 text-slate-200 hover:text-white h-9"
                            >
                              <Scan className="w-3.5 h-3.5 mr-2 text-sky-400" />
                              <span className="truncate">{cam.name} ({cam.ipAddress})</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      onClick={() => handleTriggerUpload('licensePlatePhotoUrl')}
                      className="w-full h-10 border-slate-700 bg-slate-800 text-slate-200 font-semibold text-xs gap-1.5"
                    >
                      <Upload className="w-4 h-4" /> Upload Image
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
                      className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-1.5"
                    >
                      <Camera className="w-4 h-4" /> Snap Cargo Bed with Camera
                    </Button>

                    {ipCameras.length > 0 && (
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                        <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                          <Radio className="w-3.5 h-3.5 animate-pulse" /> Snap from Configured IP Camera:
                        </span>
                        <div className="grid grid-cols-1 gap-1.5">
                          {ipCameras.map((cam) => (
                            <Button
                              key={cam.id}
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleCaptureFromIpCamera(cam, 'loadPhotoUrl')}
                              className="w-full justify-start text-xs border-slate-800 bg-slate-900 text-slate-200 hover:text-white h-9"
                            >
                              <Package className="w-3.5 h-3.5 mr-2 text-emerald-400" />
                              <span className="truncate">{cam.name} ({cam.ipAddress})</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      onClick={() => handleTriggerUpload('loadPhotoUrl')}
                      className="w-full h-10 border-slate-700 bg-slate-800 text-slate-200 font-semibold text-xs gap-1.5"
                    >
                      <Upload className="w-4 h-4" /> Upload Image
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 6: DIGITAL SELLER SIGNATURE */}
          <TabsContent value="signature" className="mt-3 space-y-4">
            <Card className="bg-slate-900 border-slate-800 text-slate-100">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2 text-emerald-400">
                    <FileSignature className="w-4 h-4" /> Seller Digital Signature Pad
                  </span>
                  {captures.signatureUrl ? (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Signature Saved</Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-500/30 text-amber-300">Sign Below</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-2">
                  <p className="text-xs text-slate-300">
                    Have seller sign on touch screen or canvas below to print on official yard compliance voucher:
                  </p>

                  <div className="bg-white rounded-xl border-2 border-slate-300 p-2 shadow-inner text-slate-900 relative">
                    <canvas
                      ref={sigCanvasRef}
                      width={600}
                      height={180}
                      onMouseDown={startDrawingSig}
                      onMouseMove={drawSig}
                      onMouseUp={stopDrawingSig}
                      onMouseLeave={stopDrawingSig}
                      onTouchStart={startDrawingSig}
                      onTouchMove={drawSig}
                      onTouchEnd={stopDrawingSig}
                      className="w-full h-44 bg-white touch-none cursor-crosshair rounded"
                    />
                    <div className="absolute bottom-2 left-4 text-[10px] text-slate-400 font-serif italic select-none pointer-events-none">
                      Sign here: X _______________________
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleClearSignature}
                      className="border-slate-700 bg-slate-800 text-slate-300 hover:text-white text-xs gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-400" /> Clear Pad
                    </Button>

                    <Button
                      size="sm"
                      onClick={handleSaveSignature}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Save Digital Signature
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
            disabled={isSavingUploads}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold px-6 h-11 gap-1.5 shadow-lg shadow-emerald-950"
          >
            {isSavingUploads ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {isSavingUploads ? "Saving images..." : "Save Suite & Transfer to Intake"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};