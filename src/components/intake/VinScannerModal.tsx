import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Camera,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ScanLine,
  ShieldCheck,
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
import { decodeVin } from "@/services/vinService";
import {
  checkVinFormat,
  scanVinPhoto,
  toCompliancePhoto,
  type VinCandidate,
  type VinScanProgress,
  type VinScanResult,
} from "@/services/vinOcrService";

type Stage = "capture" | "analyzing" | "review";
type StepStatus = "active" | "done";
interface AnalysisStep { label: string; status: StepStatus }

interface VinScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the operator-confirmed VIN and (when captured) a JPEG data URL of the door jamb. */
  onConfirm: (vin: string, photoDataUrl?: string) => void;
}

export function VinScannerModal({ open, onOpenChange, onConfirm }: VinScannerModalProps) {
  const [stage, setStage] = useState<Stage>("capture");
  const [cameraState, setCameraState] = useState<"starting" | "live" | "unavailable">("starting");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const [capturedPhoto, setCapturedPhoto] = useState("");
  const [compliancePhoto, setCompliancePhoto] = useState("");
  const [scanResult, setScanResult] = useState<VinScanResult | null>(null);
  const [steps, setSteps] = useState<AnalysisStep[]>([]);
  const [manualVin, setManualVin] = useState("");
  const [decodeState, setDecodeState] = useState<"idle" | "loading" | "ok" | "miss">("idle");
  const [decodedLabel, setDecodedLabel] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---------------- camera lifecycle ---------------- */

  const stopCamera = useCallback(() => {
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

  useEffect(() => {
    if (open && stage === "capture") {
      void startCamera();
    }
    return () => stopCamera();
  }, [open, stage, startCamera, stopCamera]);

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
    setCompliancePhoto("");
    setScanResult(null);
    setSteps([]);
    setManualVin("");
    setDecodeState("idle");
    setDecodedLabel("");
  }, []);

  // Reopening must always land on a fresh capture stage.
  useEffect(() => {
    if (!open) resetAll();
  }, [open, resetAll]);

  const handleProgress = useCallback((progress: VinScanProgress) => {
    setSteps((previous) =>
      previous
        .map((step) => ({ ...step, status: "done" as StepStatus }))
        .concat({ label: progress.label, status: "active" as StepStatus }),
    );
  }, []);

  const handlePhoto = useCallback(
    async (fullDataUrl: string) => {
      setCapturedPhoto(fullDataUrl);
      setStage("analyzing");
      setSteps([]);
      toCompliancePhoto(fullDataUrl).then(setCompliancePhoto).catch(() => setCompliancePhoto(""));
      try {
        const result = await scanVinPhoto(fullDataUrl, handleProgress);
        setSteps((previous) => previous.map((step) => ({ ...step, status: "done" as StepStatus })));
        setScanResult(result);
        setManualVin(result.best?.vin ?? "");
        setStage("review");
      } catch (error) {
        toast.error("VIN analysis failed", {
          description: error instanceof Error ? error.message : "Try better lighting or a closer shot.",
        });
        setStage("capture");
      }
    },
    [handleProgress],
  );

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

  /* ---------------- review helpers ---------------- */

  const validation = checkVinFormat(manualVin);

  // Live NHTSA verification: catches OCR reads that pass the check digit but
  // still reference a vehicle that does not exist.
  useEffect(() => {
    if (stage !== "review" || !validation.valid) {
      setDecodeState("idle");
      setDecodedLabel("");
      return;
    }
    let cancelled = false;
    setDecodeState("loading");
    decodeVin(validation.normalized)
      .then((result) => {
        if (cancelled) return;
        const label = [result.year, result.make, result.model].filter(Boolean).join(" ");
        setDecodedLabel(label);
        setDecodeState("ok");
      })
      .catch(() => {
        if (!cancelled) setDecodeState("miss");
      });
    return () => {
      cancelled = true;
    };
  }, [stage, validation.valid, validation.normalized]);

  const handleConfirm = () => {
    if (!validation.valid) return;
    onConfirm(validation.normalized, compliancePhoto || undefined);
    onOpenChange(false);
  };

  const handleDialogChange = (next: boolean) => {
    if (stage === "analyzing") return; // don't abandon a running scan
    if (!next) resetAll();
    onOpenChange(next);
  };

  const alternatives: VinCandidate[] = (scanResult?.candidates ?? []).filter(
    (candidate) => candidate.vin !== manualVin,
  );

  /* ---------------- render ---------------- */

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-xl gap-0 overflow-y-auto rounded-2xl border-slate-800 bg-slate-950 p-0 text-slate-100">
        <style>{`@keyframes vin-scan-sweep { 0% { top: 4%; } 50% { top: 90%; } 100% { top: 4%; } }`}</style>

        <DialogHeader className="border-b border-slate-800 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ScanLine className="h-5 w-5 text-amber-400" />
            AI Door-Jamb VIN Scanner
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Photo the VIN sticker inside the driver's door jamb — the engine reads it, validates the
            check digit, and decodes the vehicle automatically.
          </DialogDescription>
        </DialogHeader>

        {/* ============ CAPTURE STAGE ============ */}
        {stage === "capture" && (
          <div className="space-y-4 p-5">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              {cameraState === "live" ? (
                <>
                  <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" />

                  {/* Door-jamb framing guide */}
                  <div className="pointer-events-none absolute inset-x-[9%] top-[30%] h-[34%]">
                    <div className="absolute left-0 top-0 h-9 w-9 rounded-tl-xl border-l-4 border-t-4 border-amber-400" />
                    <div className="absolute right-0 top-0 h-9 w-9 rounded-tr-xl border-r-4 border-t-4 border-amber-400" />
                    <div className="absolute bottom-0 left-0 h-9 w-9 rounded-bl-xl border-b-4 border-l-4 border-amber-400" />
                    <div className="absolute bottom-0 right-0 h-9 w-9 rounded-br-xl border-b-4 border-r-4 border-amber-400" />
                    <div className="absolute inset-x-6 inset-y-0 rounded-xl border border-dashed border-amber-400/50" />
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                    <span className="rounded-full bg-slate-950/85 px-4 py-1.5 text-[11px] font-semibold text-amber-300 shadow-lg">
                      Open the driver's door · line the sticker up inside the box
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
                  <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
                  <p className="text-xs font-semibold">Starting camera…</p>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
                  <Camera className="h-10 w-10 text-slate-500" />
                  <p className="text-sm font-semibold text-slate-200">Camera unavailable</p>
                  <p className="text-xs text-slate-400">
                    Grant camera permission, or upload a photo of the door-jamb sticker instead.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => void captureFromCamera()}
                disabled={cameraState !== "live"}
                className="h-12 flex-1 rounded-xl bg-amber-500 text-sm font-black text-slate-950 hover:bg-amber-400"
              >
                <Camera className="mr-2 h-5 w-5" /> Capture VIN Photo
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="h-12 flex-1 rounded-xl border-slate-700 bg-slate-900 text-sm font-bold text-slate-200 hover:bg-slate-800"
              >
                <Upload className="mr-2 h-4 w-4 text-amber-400" /> Use Existing Photo
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

        {/* ============ ANALYZING STAGE ============ */}
        {stage === "analyzing" && (
          <div className="space-y-4 p-5">
            <div className="relative overflow-hidden rounded-2xl border border-slate-800">
              {capturedPhoto && (
                <img src={capturedPhoto} alt="Captured door jamb" className="max-h-72 w-full object-cover" />
              )}
              <div
                className="pointer-events-none absolute inset-x-0 h-9 border-y border-amber-400/70 bg-amber-400/15 blur-[1px]"
                style={{ animation: "vin-scan-sweep 2.2s ease-in-out infinite" }}
              />
            </div>

            <div className="space-y-2.5 rounded-2xl border border-slate-800 bg-slate-900 p-4">
              {steps.map((step) => (
                <div key={step.label} className="flex items-center gap-2.5">
                  {step.status === "done" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-400" />
                  )}
                  <span className={`text-xs font-semibold ${step.status === "done" ? "text-slate-400" : "text-slate-100"}`}>
                    {step.label}
                  </span>
                </div>
              ))}
              {steps.length === 0 && (
                <div className="flex items-center gap-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                  <span className="text-xs font-semibold text-slate-100">Preparing engine…</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============ REVIEW STAGE ============ */}
        {stage === "review" && (
          <div className="space-y-4 p-5">
            {scanResult?.best ? (
              <div className="space-y-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
                    AI Extraction {scanResult.passesRun.length} passes · {scanResult.durationMs} ms
                  </span>
                  <div className="flex items-center gap-1.5">
                    {scanResult.best.checkDigitValid && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-black uppercase text-slate-950">
                        <BadgeCheck className="h-3 w-3" /> Check digit valid
                      </span>
                    )}
                    <span className="rounded-full border border-slate-600 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                      {Math.round(scanResult.best.ocrConfidence)}% OCR
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-950/70 p-3 text-center font-mono text-lg font-black tracking-[0.18em] text-amber-300 sm:text-2xl">
                  {scanResult.best.vin}
                </div>

                {scanResult.best.repairs.length > 0 && (
                  <div className="flex items-start gap-2 text-[11px] font-semibold text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>Auto-corrected: {scanResult.best.repairs.join(" · ")}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-200">
                  <AlertTriangle className="h-4 w-4" /> No VIN detected
                </div>
                <p className="text-xs text-amber-100/80">
                  Retake closer with the sticker filling the guide box and even lighting — or type the
                  VIN manually below.
                </p>
              </div>
            )}

            {/* Alternate candidates */}
            {alternatives.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Other candidates — tap to switch
                </p>
                <div className="flex flex-wrap gap-2">
                  {alternatives.map((candidate) => (
                    <button
                      key={candidate.vin}
                      type="button"
                      onClick={() => setManualVin(candidate.vin)}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs font-bold tracking-wider text-slate-300 transition hover:border-amber-500/60 hover:text-amber-300"
                    >
                      {candidate.vin}
                      <span className="ml-1.5 text-[10px] font-sans text-slate-500">
                        {candidate.checkDigitValid ? "✓" : `${Math.round(candidate.ocrConfidence)}%`}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Operator verification */}
            <div className="space-y-2.5 rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Verify before saving
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    manualVin.length === 17
                      ? validation.charsetOk
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-rose-500/15 text-rose-300"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {manualVin.replace(/[^A-Z0-9]/gi, "").length}/17
                </span>
              </div>

              <Input
                value={manualVin}
                onChange={(event) => setManualVin(event.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, ""))}
                maxLength={17}
                placeholder="TYPE OR CORRECT THE VIN"
                className="h-12 rounded-xl border-slate-700 bg-slate-950 text-center font-mono text-base font-bold tracking-[0.25em] text-amber-300"
              />

              {/* Character grid with check-digit position highlighted */}
              {manualVin.length > 0 && (
                <div className="flex justify-center gap-1">
                  {Array.from({ length: 17 }).map((_, index) => {
                    const character = manualVin[index] ?? "";
                    const isCheckDigit = index === 8;
                    const illegal = character !== "" && !/^[A-HJ-NPR-Z0-9]$/.test(character);
                    return (
                      <div
                        key={index}
                        className={`flex h-8 w-6 items-center justify-center rounded-md border font-mono text-xs font-bold sm:h-9 sm:w-7 sm:text-sm ${
                          illegal
                            ? "border-rose-500/60 bg-rose-500/10 text-rose-300"
                            : character
                              ? isCheckDigit
                                ? "border-amber-400 bg-amber-500/15 text-amber-300"
                                : "border-slate-700 bg-slate-950 text-slate-200"
                              : "border-dashed border-slate-800 text-slate-600"
                        } ${isCheckDigit && !illegal ? "ring-1 ring-amber-400/60" : ""}`}
                        title={isCheckDigit ? "Position 9 — check digit" : `Position ${index + 1}`}
                      >
                        {character || "·"}
                      </div>
                    );
                  })}
                </div>
              )}

              {validation.warnings.length > 0 ? (
                validation.warnings.map((warning) => (
                  <p key={warning} className="flex items-start gap-1.5 text-[11px] font-semibold text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {warning}
                  </p>
                ))
              ) : (
                validation.valid && (
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Format valid · ISO 3779 check digit passes
                  </p>
                )
              )}

              {/* Live NHTSA verification */}
              {validation.valid && (
                <div>
                  {decodeState === "loading" && (
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying with NHTSA vPIC…
                    </p>
                  )}
                  {decodeState === "ok" && decodedLabel && (
                    <p className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-300">
                      <ShieldCheck className="h-3.5 w-3.5" /> NHTSA match: {decodedLabel}
                    </p>
                  )}
                  {decodeState === "ok" && !decodedLabel && (
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-200">
                      <AlertTriangle className="h-3.5 w-3.5" /> NHTSA returned no vehicle details for this VIN
                    </p>
                  )}
                  {decodeState === "miss" && (
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-200">
                      <AlertTriangle className="h-3.5 w-3.5" /> Could not reach NHTSA — you can still save this VIN
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => {
                  setStage("capture");
                  setScanResult(null);
                  setManualVin("");
                  setSteps([]);
                }}
                variant="outline"
                className="h-11 flex-1 rounded-xl border-slate-700 bg-slate-900 font-bold text-slate-300 hover:bg-slate-800"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Retake
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!validation.valid}
                className="h-11 flex-1 rounded-xl bg-emerald-600 text-sm font-black text-white hover:bg-emerald-500"
              >
                <CheckCircle2 className="mr-2 h-5 w-5" /> Use This VIN
              </Button>
            </div>

            {scanResult?.rawText && (
              <details className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Raw OCR output
                </summary>
                <p className="mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-slate-400">
                  {scanResult.rawText}
                </p>
              </details>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
