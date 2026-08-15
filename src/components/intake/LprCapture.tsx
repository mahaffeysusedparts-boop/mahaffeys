import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, RefreshCw, ScanLine, ShieldCheck, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Customer, VisionScan } from "@/types/scrap";
import { looksLikePlate, measurePlateFrame } from "./lprDetection";

export interface LprCaptureResult {
  plate: string;
  customer: Customer | null;
  scanId: string;
  imageUrl: string;
}

interface LprCaptureProps {
  onCancel: () => void;
  onComplete: (result: LprCaptureResult) => void;
}

interface LookupResponse {
  plate: string;
  customer: Customer | null;
}

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, credentials: "include" });
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { statusMessage?: string } | null;
    throw new Error(error?.statusMessage || "License plate scan failed");
  }
  return response.json() as Promise<T>;
}

function plateCrop(video: HTMLVideoElement) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  return {
    x: Math.round(width * 0.11),
    y: Math.round(height * 0.35),
    width: Math.round(width * 0.78),
    height: Math.round(height * 0.3),
  };
}

export function LprCapture({ onCancel, onComplete }: LprCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyzingRef = useRef(false);
  const stableFramesRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"starting" | "scanning" | "capturing" | "error" | "match">("starting");
  const [message, setMessage] = useState("Requesting rear camera access…");
  const [pending, setPending] = useState<LprCaptureResult | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const confirmScan = useCallback(async (result: LprCaptureResult) => {
    await request(`/api/vision/scans/${result.scanId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selections: { vin: null, plate: result.plate, materials: [] } }),
    });
  }, []);

  const finishResult = useCallback(async (result: LprCaptureResult) => {
    if (result.customer) {
      setPending(result);
      setStatus("match");
      setMessage("Customer match found");
      return;
    }
    await confirmScan(result);
    onComplete(result);
  }, [confirmScan, onComplete]);

  const analyzeBlob = useCallback(async (blob: Blob) => {
    if (analyzingRef.current) return;
    analyzingRef.current = true;
    stopCamera();
    setStatus("capturing");
    setMessage("Reading plate with the high-accuracy LPR service…");

    try {
      const body = new FormData();
      const imageType = blob.type.match(/^image\/(jpeg|png|webp)$/) ? blob.type : "image/jpeg";
      const extension = imageType === "image/png" ? "png" : imageType === "image/webp" ? "webp" : "jpg";
      body.set("purpose", "plate");
      body.set("image", new File([blob], `lpr-${Date.now()}.${extension}`, { type: imageType }));
      const scan = await request<VisionScan>("/api/vision/scans", { method: "POST", body });
      const plate = scan.result.plateText;

      if (!plate || scan.status === "failed") throw new Error(scan.errorMessage || "No readable plate was found. Reposition the vehicle and retry.");

      setMessage(`Looking up ${plate} in customer records…`);
      const lookup = await request<LookupResponse>(`/api/lpr/lookup?plate=${encodeURIComponent(plate)}`);
      await finishResult({ plate: lookup.plate, customer: lookup.customer, scanId: scan.id, imageUrl: scan.imageUrl });
    } catch (error) {
      analyzingRef.current = false;
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "The plate could not be scanned");
    }
  }, [finishResult, stopCamera]);

  const captureVideoFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video?.videoWidth || analyzingRef.current) return;
    const crop = plateCrop(video);
    const scale = Math.min(1, 1280 / crop.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(crop.width * scale));
    canvas.height = Math.max(1, Math.round(crop.height * scale));
    canvas.getContext("2d")?.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => blob && void analyzeBlob(blob), "image/jpeg", 0.9);
  }, [analyzeBlob]);

  const startCamera = useCallback(async () => {
    analyzingRef.current = false;
    stableFramesRef.current = 0;
    setPending(null);
    setStatus("starting");
    setMessage("Requesting rear camera access…");
    stopCamera();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Live camera access is not supported on this device.");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("scanning");
      setMessage("Hold the plate steady inside the frame");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Camera permission was not granted");
    }
  }, [stopCamera]);

  useEffect(() => {
    void startCamera();
    return stopCamera;
  }, [startCamera, stopCamera]);

  useEffect(() => {
    if (status !== "scanning") return;
    const timer = window.setInterval(() => {
      const video = videoRef.current;
      if (!video?.videoWidth || analyzingRef.current) return;
      const crop = plateCrop(video);
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 60;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
      const metrics = measurePlateFrame(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
      stableFramesRef.current = looksLikePlate(metrics) ? stableFramesRef.current + 1 : 0;
      if (stableFramesRef.current >= 3) captureVideoFrame();
    }, 550);
    return () => window.clearInterval(timer);
  }, [captureVideoFrame, status]);

  const handleFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("error");
      setMessage("Choose an image file containing a license plate.");
      return;
    }
    void analyzeBlob(file);
  };

  const confirmCustomer = async () => {
    if (!pending) return;
    setStatus("capturing");
    setMessage("Applying customer information…");
    try {
      await confirmScan(pending);
      onComplete(pending);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "The match could not be confirmed");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-slate-950 text-white" role="dialog" aria-modal="true" aria-label="Automatic license plate scanner">
      <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-slate-950/25" />

      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-slate-950/80 px-4 py-4 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/20"><ScanLine className="h-6 w-6" /></span>
          <div><p className="font-black tracking-tight">Automatic LPR</p><p className="text-xs text-slate-300">Hands-free vehicle identification</p></div>
        </div>
        <Button type="button" size="icon" variant="ghost" onClick={onCancel} className="rounded-full bg-slate-800/80 text-white hover:bg-slate-700"><X className="h-5 w-5" /></Button>
      </header>

      {status !== "match" && (
        <div className="absolute inset-0 flex items-center justify-center px-5">
          <div className={`relative aspect-[3/1] w-full max-w-3xl rounded-[2rem] border-2 ${status === "scanning" ? "border-sky-400 shadow-[0_0_0_9999px_rgba(2,6,23,.55),0_0_45px_rgba(56,189,248,.25)]" : "border-slate-500 shadow-[0_0_0_9999px_rgba(2,6,23,.65)]"}`}>
            <span className="absolute -left-0.5 -top-0.5 h-10 w-10 rounded-tl-[2rem] border-l-4 border-t-4 border-amber-400" />
            <span className="absolute -right-0.5 -top-0.5 h-10 w-10 rounded-tr-[2rem] border-r-4 border-t-4 border-amber-400" />
            <span className="absolute -bottom-0.5 -left-0.5 h-10 w-10 rounded-bl-[2rem] border-b-4 border-l-4 border-amber-400" />
            <span className="absolute -bottom-0.5 -right-0.5 h-10 w-10 rounded-br-[2rem] border-b-4 border-r-4 border-amber-400" />
            {status === "scanning" && <div className="absolute inset-x-8 top-1/2 h-0.5 animate-pulse bg-sky-300 shadow-[0_0_16px_#7dd3fc]" />}
          </div>
        </div>
      )}

      {status === "match" && pending?.customer && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-slate-950/90 p-4 backdrop-blur-xl">
          <div className="w-full max-w-md rounded-[2rem] border border-emerald-400/40 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-400 text-slate-950"><ShieldCheck className="h-6 w-6" /></span><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Customer match</p><h2 className="text-2xl font-black tracking-tight">Confirm returning seller</h2></div></div>
            <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-950/70 p-4"><div className="flex items-center justify-between"><span className="text-xs text-slate-400">License plate</span><span className="rounded-lg bg-amber-300 px-3 py-1 font-mono font-black text-slate-950">{pending.plate}</span></div><div><p className="text-lg font-bold">{pending.customer.fullName}</p><p className="text-sm text-slate-400">{pending.customer.phone || "No phone on file"}</p></div><p className="text-xs text-slate-500">ID ending in {pending.customer.idNumber?.slice(-4) || "—"}</p></div>
            <div className="mt-5 grid grid-cols-2 gap-3"><Button type="button" variant="outline" onClick={() => void startCamera()} className="h-12 rounded-xl border-slate-700 bg-slate-800 text-white"><RefreshCw className="mr-2 h-4 w-4" /> Scan again</Button><Button type="button" onClick={() => void confirmCustomer()} className="h-12 rounded-xl bg-emerald-500 font-bold text-slate-950 hover:bg-emerald-400"><Check className="mr-2 h-4 w-4" /> Confirm</Button></div>
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-10 bg-slate-950/85 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 text-center backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-2 text-sm font-semibold">
          {(status === "starting" || status === "capturing") && <Loader2 className="h-4 w-4 animate-spin text-sky-400" />}
          {status === "scanning" && <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />}
          <span>{message}</span>
        </div>
        <p className="mt-1 text-xs text-slate-400">Capture starts automatically after the plate is stable for a moment.</p>
        <div className="mt-3 flex justify-center gap-2">
          {status === "scanning" && <Button type="button" onClick={captureVideoFrame} className="rounded-xl bg-sky-500 font-bold text-slate-950 hover:bg-sky-400"><Camera className="mr-2 h-4 w-4" /> Capture now</Button>}
          {status === "error" && <Button type="button" onClick={() => void startCamera()} className="rounded-xl bg-sky-500 font-bold text-slate-950 hover:bg-sky-400"><RefreshCw className="mr-2 h-4 w-4" /> Retry camera</Button>}
          {(status === "error" || status === "scanning") && <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="rounded-xl border-slate-600 bg-slate-800 text-white"><Upload className="mr-2 h-4 w-4" /> Choose photo</Button>}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />
      </div>
    </div>
  );
}
