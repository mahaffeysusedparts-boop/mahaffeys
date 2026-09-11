import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ScanLine,
  Upload,
  Zap,
  ZapOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { analyzeLicensePlateImage } from "@/services/aiVisionService";
import { looksLikePlate, measurePlateFrame, type PlateFrameMetrics } from "./lprDetection";

type Stage = "capture" | "analyzing" | "review";

interface PlateQuality extends PlateFrameMetrics {
  isPlateLike: boolean;
  contrastOk: boolean;
  edgeOk: boolean;
  brightnessOk: boolean;
}

function lookLikePlateFeedback(data: Uint8ClampedArray, width: number, height: number): PlateQuality {
  const metrics = measurePlateFrame(data, width, height);
  return {
    ...metrics,
    isPlateLike: looksLikePlate(metrics),
    contrastOk: metrics.contrast > 30,
    edgeOk: metrics.edgeDensity > 0.055,
    brightnessOk: metrics.brightness > 35 && metrics.brightness < 235,
  };
}

interface PlateScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the operator-confirmed plate text (alphanumeric, uppercase). */
  onConfirm: (plate: string) => void;
}

/**
 * Rear-camera license-plate capture. A frame-grab heuristic gives instant
 * quality feedback while the OCR pass runs; the confirmed plate is returned
 * to the intake form, which then fires the LPR seller-history lookup.
 */
export function PlateScannerModal({ open, onOpenChange, onConfirm }: PlateScannerModalProps) {
  const [stage, setStage] = useState<Stage>("capture");
  const [cameraState, setCameraState] = useState<"starting" | "live" | "unavailable">("starting");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState("");
  const [quality, setQuality] = useState<PlateQuality | null>(null);
  const [frameLooksLikePlate, setFrameLooksLikePlate] = useState(false);
  const [manualPlate, setManualPlate] = useState("");
  const [detectedState, setDetectedState] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef<number | null>(null);

  /* ---------------- camera lifecycle ---------------- */

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraState("starting");
    setTorchSupported(false);
    setTorchOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("unavailable");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1440 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
      setTorchSupported(Boolean(capabilities?.torch));
      setCameraState("live");
    } catch {
      setCameraState("unavailable");
    }
  }, []);

  // Live frame-quality preview loop — instant heuristic feedback while framing.
  const tickQuality = useCallback(() => {
    const video = videoRef.current;
    if (video && video.videoWidth) {
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 120;
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const data = context.getImageData(0, 0, canvas.width, canvas.height);
        const feedback = lookLikePlateFeedback(data.data, canvas.width, canvas.height);
        setQuality(feedback);
        setFrameLooksLikePlate(feedback.isPlateLike);
      }
    }
    rafRef.current = requestAnimationFrame(tickQuality);
  }, []);

  useEffect(() => {
    if (open && stage === "capture") {
      void startCamera();
    }
    return () => stopCamera();
  }, [open, stage, startCamera, stopCamera]);

  useEffect(() => {
    if (stage === "capture" && cameraState === "live") {
      rafRef.current = requestAnimationFrame(tickQuality);
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [stage, cameraState, tickQuality]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints);
      setTorchOn(next);
    } catch {
      toast.error("This camera does not support the flash");
    }
  };

  /* ---------------- capture + analysis ---------------- */

  const resetAll = useCallback(() => {
    setStage("capture");
    setCapturedPhoto("");
    setQuality(null);
    setFrameLooksLikePlate(false);
    setManualPlate("");
    setDetectedState("");
  }, []);

  useEffect(() => {
    if (!open) resetAll();
  }, [open, resetAll]);

  const handlePhoto = useCallback(async (fullDataUrl: string) => {
    setCapturedPhoto(fullDataUrl);
    setStage("analyzing");
    try {
      const result = await analyzeLicensePlateImage(fullDataUrl);
      setManualPlate(result.plateNumber.replace(/[^A-Z0-9]/g, ""));
      setDetectedState(result.state || "");
      setStage("review");
      if (!result.plateNumber || result.confidence < 45) {
        toast.info("Low-confidence plate read — verify or correct the characters");
      }
    } catch {
      toast.error("Plate OCR failed", { description: "Type the plate manually below." });
      setManualPlate("");
      setStage("review");
    }
  }, []);

  const captureFromCamera = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0);
    await handlePhoto(canvas.toDataURL("image/jpeg", 0.92));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => toast.error("Could not read the selected photo");
    reader.onload = () => void handlePhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  /* ---------------- confirm ---------------- */

  const plateValid = /^[A-Z0-9]{2,10}$/.test(manualPlate);

  const handleConfirm = () => {
    if (!plateValid) return;
    onConfirm(manualPlate);
    onOpenChange(false);
  };

  const handleDialogChange = (next: boolean) => {
    if (stage === "analyzing") return;
    if (!next) resetAll();
    onOpenChange(next);
  };

  /* ---------------- render ---------------- */

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-lg gap-0 overflow-y-auto rounded-2xl border-slate-800 bg-slate-950 p-0 text-slate-100">
        <DialogHeader className="border-b border-slate-800 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ScanLine className="h-5 w-5 text-sky-400" />
            License Plate Scanner
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Fill the plate inside the frame and capture — OCR reads the tag, you confirm it, and the
            seller lookup runs automatically.
          </DialogDescription>
        </DialogHeader>

        {/* ============ CAPTURE ============ */}
        {stage === "capture" && (
          <div className="space-y-4 p-5">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              {cameraState === "live" ? (
                <>
                  <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" />

                  {/* Wide plate framing guide */}
                  <div className="pointer-events-none absolute inset-x-[12%] top-[38%] h-[24%]">
                    <div className="absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-4 border-t-4 border-sky-400" />
                    <div className="absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-4 border-t-4 border-sky-400" />
                    <div className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 border-sky-400" />
                    <div className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-4 border-r-4 border-sky-400" />
                    <div
                      className={`absolute inset-x-4 inset-y-2 rounded-lg border border-dashed transition-colors ${
                        frameLooksLikePlate ? "border-emerald-400/80" : "border-sky-400/50"
                      }`}
                    />
                  </div>

                  <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                    <span
                      className={`rounded-full px-4 py-1.5 text-[11px] font-semibold shadow-lg ${
                        frameLooksLikePlate ? "bg-emerald-950/90 text-emerald-300" : "bg-slate-950/85 text-sky-300"
                      }`}
                    >
                      {frameLooksLikePlate
                        ? "Plate detected — hold steady and capture"
                        : "Center the license plate inside the frame"}
                    </span>
                  </div>

                  {torchSupported && (
                    <Button
                      size="sm"
                      onClick={() => void toggleTorch()}
                      className={`absolute right-3 top-3 h-10 w-10 rounded-xl p-0 shadow-lg ${
                        torchOn
                          ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                          : "bg-slate-950/85 text-slate-200 hover:bg-slate-800"
                      }`}
                      title={torchOn ? "Turn flash off" : "Turn flash on"}
                    >
                      {torchOn ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
                    </Button>
                  )}
                </>
              ) : cameraState === "starting" ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
                  <p className="text-xs font-semibold">Starting camera…</p>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
                  <Camera className="h-10 w-10 text-slate-500" />
                  <p className="text-sm font-semibold text-slate-200">Camera unavailable</p>
                  <p className="text-xs text-slate-400">
                    Grant camera permission, upload a plate photo, or type the plate manually.
                  </p>
                </div>
              )}
            </div>

            {quality && cameraState === "live" && (
              <div className="grid grid-cols-3 gap-2 text-center font-mono text-[10px]">
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-1.5">
                  <p className="text-slate-500 uppercase">Contrast</p>
                  <p className={quality.contrastOk ? "text-emerald-400 font-bold" : "text-slate-400"}>
                    {Math.round(quality.contrast)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-1.5">
                  <p className="text-slate-500 uppercase">Edges</p>
                  <p className={quality.edgeOk ? "text-emerald-400 font-bold" : "text-slate-400"}>
                    {Math.round(quality.edgeDensity * 100)}%
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-1.5">
                  <p className="text-slate-500 uppercase">Light</p>
                  <p className={quality.brightnessOk ? "text-emerald-400 font-bold" : "text-slate-400"}>
                    {Math.round(quality.brightness)}
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => void captureFromCamera()}
                disabled={cameraState !== "live"}
                className="h-12 flex-1 rounded-xl bg-sky-600 text-sm font-black text-white hover:bg-sky-500"
              >
                <Camera className="mr-2 h-5 w-5" /> Capture Plate
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="h-12 flex-1 rounded-xl border-slate-700 bg-slate-900 text-sm font-bold text-slate-200 hover:bg-slate-800"
              >
                <Upload className="mr-2 h-4 w-4 text-sky-400" /> Use Existing Photo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => void handleFileUpload(event)}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* ============ ANALYZING ============ */}
        {stage === "analyzing" && (
          <div className="flex flex-col items-center justify-center gap-3 p-10">
            <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
            <p className="text-xs font-semibold text-slate-300">Reading plate characters…</p>
          </div>
        )}

        {/* ============ REVIEW ============ */}
        {stage === "review" && (
          <div className="space-y-4 p-5">
            <div className="overflow-hidden rounded-2xl border border-slate-800">
              {capturedPhoto && <img src={capturedPhoto} alt="Captured plate" className="max-h-56 w-full object-cover" />}
            </div>

            <div className="space-y-2.5 rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Verify the plate
                </span>
                {detectedState && (
                  <span className="rounded-full border border-slate-600 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                    State detected: {detectedState}
                  </span>
                )}
              </div>

              <Input
                value={manualPlate}
                onChange={(event) => setManualPlate(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                maxLength={10}
                placeholder="ABC1234"
                className="h-12 rounded-xl border-slate-700 bg-slate-950 text-center font-mono text-lg font-black tracking-[0.3em] text-sky-300"
              />

              {manualPlate.length > 0 && !plateValid && (
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Plates are 2–10 letters and digits.
                </p>
              )}
              {plateValid && (
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Looks good — confirming will run the seller history lookup.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => setStage("capture")}
                variant="outline"
                className="h-11 flex-1 rounded-xl border-slate-700 bg-slate-900 font-bold text-slate-300 hover:bg-slate-800"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Retake
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!plateValid}
                className="h-11 flex-1 rounded-xl bg-emerald-600 text-sm font-black text-white hover:bg-emerald-500"
              >
                <CheckCircle2 className="mr-2 h-5 w-5" /> Use This Plate
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
