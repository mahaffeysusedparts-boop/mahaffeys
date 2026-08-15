import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, Loader2, Radio, ScanLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { storageService } from "@/services/storageService";
import type { Customer, Ticket, VisionScan } from "@/types/scrap";
import { looksLikePlate, measurePlateFrame } from "./lprDetection";

interface EntranceLprMonitorProps {
  onTicketCreated: (ticket: Ticket) => void;
}

interface LookupResponse {
  plate: string;
  customer: Customer | null;
}

type MonitorState = "offline" | "watching" | "reading" | "created" | "error";

async function jsonRequest<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, credentials: "include" });
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { statusMessage?: string } | null;
    throw new Error(error?.statusMessage || "Entrance LPR request failed");
  }
  return response.json() as Promise<T>;
}

async function inspectSnapshot(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 80;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    return { plateLike: false, signature: [] as number[] };
  }

  const cropX = Math.round(bitmap.width * 0.1);
  const cropY = Math.round(bitmap.height * 0.25);
  const cropWidth = Math.round(bitmap.width * 0.8);
  const cropHeight = Math.round(bitmap.height * 0.5);
  context.drawImage(bitmap, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const metrics = measurePlateFrame(image.data, canvas.width, canvas.height);
  const signature: number[] = [];
  for (let blockY = 0; blockY < 4; blockY += 1) {
    for (let blockX = 0; blockX < 8; blockX += 1) {
      let total = 0;
      let count = 0;
      for (let y = blockY * 20; y < (blockY + 1) * 20; y += 4) {
        for (let x = blockX * 20; x < (blockX + 1) * 20; x += 4) {
          const offset = (y * canvas.width + x) * 4;
          total += image.data[offset] * 0.299 + image.data[offset + 1] * 0.587 + image.data[offset + 2] * 0.114;
          count += 1;
        }
      }
      signature.push(total / count);
    }
  }
  return { plateLike: looksLikePlate(metrics), signature };
}

function signatureDifference(left: number[], right: number[]) {
  if (!left.length || left.length !== right.length) return Number.POSITIVE_INFINITY;
  return left.reduce((total, value, index) => total + Math.abs(value - right[index]), 0) / left.length;
}

function normalizePlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function EntranceLprMonitor({ onTicketCreated }: EntranceLprMonitorProps) {
  const camera = storageService.getIpCameras().find((item) => item.isActive && item.assignment === "LICENSE_PLATE");

  const busyRef = useRef(false);
  const previousSignatureRef = useRef<number[]>([]);
  const capturedSignatureRef = useRef<number[]>([]);
  const stableFramesRef = useRef(0);
  const onTicketCreatedRef = useRef(onTicketCreated);
  onTicketCreatedRef.current = onTicketCreated;
  const [state, setState] = useState<MonitorState>(camera ? "watching" : "offline");
  const [message, setMessage] = useState(camera ? `Watching ${camera.name}` : "No active entrance plate camera configured");
  const [lastPlate, setLastPlate] = useState("");

  useEffect(() => {

    if (!camera) return;
    let cancelled = false;

    const createPendingTicket = async (scan: VisionScan, plate: string, customer: Customer | null) => {
      const duplicate = storageService.getTickets().find((ticket) =>
        normalizePlate(ticket.vehicleLicensePlate || "") === plate
        && Date.now() - new Date(ticket.createdAt).getTime() < 10 * 60 * 1000,
      );
      if (duplicate) {
        setState("watching");
        setMessage(`${plate} already has recent ticket #${duplicate.id}`);
        return;
      }

      await jsonRequest(`/api/vision/scans/${scan.id}/confirm`, {

        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selections: { vin: null, plate, materials: [] } }),
      });

      const ticket: Ticket = {
        id: storageService.generateScrapReceiptNumber(),
        ticketType: "SCRAP_METAL",
        createdAt: new Date().toISOString(),
        status: "PENDING",
        customerId: customer?.id,
        customerName: customer?.fullName || `New Customer — ${plate}`,
        customerPhone: customer?.phone || undefined,
        customerIdNumber: customer?.idNumber || undefined,
        vehicleLicensePlate: plate,
        scrapLines: [],
        complianceCaptures: {
          idPhotoUrl: customer?.idPhotoUrl,
          licensePlatePhotoUrl: scan.imageUrl,
        },
        grossTotal: 0,
        totalDeductions: 0,
        finalPayout: 0,
        payoutMethod: "Cash",
        operatorName: storageService.getSettings().operatorName,
        notes: customer
          ? "Automatically created by the scale entrance LPR. Existing customer profile matched; verify details before completion."
          : "Automatically created by the scale entrance LPR. No customer profile matched; add seller details before completion.",
      };
      storageService.saveTicket(ticket);
      setLastPlate(plate);
      setState("created");
      setMessage(`${customer ? customer.fullName : "New customer"} · ticket #${ticket.id} ready to edit`);
      onTicketCreatedRef.current(ticket);
    };

    const processSnapshot = async (blob: Blob) => {
      setState("reading");
      setMessage("Vehicle detected — reading license plate…");
      const type = blob.type.match(/^image\/(jpeg|png|webp)$/) ? blob.type : "image/jpeg";
      const extension = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";

      const form = new FormData();
      form.set("purpose", "plate");
      form.set("image", new File([blob], `entrance-${Date.now()}.${extension}`, { type }));
      const scan = await jsonRequest<VisionScan>("/api/vision/scans", { method: "POST", body: form });
      const recognized = scan.result.plateText;
      if (!recognized || scan.status === "failed") throw new Error(scan.errorMessage || "No readable plate was found");
      const lookup = await jsonRequest<LookupResponse>(`/api/lpr/lookup?plate=${encodeURIComponent(recognized)}`);
      await createPendingTicket(scan, lookup.plate, lookup.customer);
    };

    const poll = async () => {

      if (busyRef.current || cancelled) return;
      busyRef.current = true;
      try {
        const response = await fetch(`/api/lpr/entrance-snapshot?t=${Date.now()}`, { credentials: "include", cache: "no-store" });
        if (!response.ok) {
          const error = await response.json().catch(() => null) as { statusMessage?: string } | null;
          throw new Error(error?.statusMessage || "Entrance camera snapshot unavailable");
        }
        const blob = await response.blob();
        const inspection = await inspectSnapshot(blob);
        const frameChange = signatureDifference(previousSignatureRef.current, inspection.signature);
        const newScene = signatureDifference(capturedSignatureRef.current, inspection.signature) > 8;
        stableFramesRef.current = inspection.plateLike && frameChange < 5 ? stableFramesRef.current + 1 : 0;
        previousSignatureRef.current = inspection.signature;

        if (stableFramesRef.current >= 2 && newScene) {
          stableFramesRef.current = 0;
          capturedSignatureRef.current = inspection.signature;
          await processSnapshot(blob);
        } else {
          setState("watching");
          setMessage(`Watching ${camera.name} for an arriving vehicle`);
        }
      } catch (error) {

        if (!cancelled) {
          setState("error");
          setMessage(error instanceof Error ? error.message : "Entrance LPR is unavailable");
        }
      } finally {
        busyRef.current = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 3_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [camera?.id, camera?.name]);

  const style = state === "error" || state === "offline"

    ? "border-amber-500/40 bg-amber-500/10"
    : state === "created"
      ? "border-emerald-400/50 bg-emerald-500/10"
      : "border-sky-400/40 bg-sky-500/10";

  return (
    <Card className={`overflow-hidden rounded-2xl border ${style} text-white shadow-xl`}>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${state === "created" ? "bg-emerald-400 text-slate-950" : state === "error" || state === "offline" ? "bg-amber-400 text-slate-950" : "bg-sky-400 text-slate-950"}`}>
            {state === "reading" ? <Loader2 className="h-6 w-6 animate-spin" /> : state === "created" ? <CheckCircle2 className="h-6 w-6" /> : state === "error" || state === "offline" ? <AlertTriangle className="h-6 w-6" /> : <ScanLine className="h-6 w-6" />}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2"><p className="font-black tracking-tight">Scale Entrance Automatic LPR</p><Badge className="rounded-full border border-sky-400/30 bg-slate-950/60 text-[10px] text-sky-200"><Radio className="mr-1 h-3 w-3" />{state === "watching" ? "LIVE" : state.toUpperCase()}</Badge></div>
            <p className="mt-1 text-xs text-slate-300">{message}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400"><Camera className="h-4 w-4" />{camera?.name || "Configure a LICENSE_PLATE camera"}{lastPlate && <span className="rounded-lg bg-amber-300 px-2 py-1 font-mono font-black text-slate-950">{lastPlate}</span>}</div>
      </CardContent>
    </Card>
  );
}
