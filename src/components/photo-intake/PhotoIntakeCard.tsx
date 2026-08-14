import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, RefreshCw, ScanLine, Upload, WifiOff } from "lucide-react";
import { toast } from "sonner";
import type { VisionScan, VisionScanPurpose } from "@/types/scrap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const labels: Record<VisionScanPurpose, { title: string; guidance: string; processing: string }> = {
  vehicle: { title: "Scan VIN / Vehicle", guidance: "Frame the VIN plate or door jamb tightly in clear, even light.", processing: "Reading VIN and decoding vehicle" },
  plate: { title: "Scan License Plate", guidance: "Keep the full plate level, readable, and free of glare.", processing: "Reading license plate" },
  scrap: { title: "Scan Scrap Load", guidance: "Capture the full load and visible contaminants. Classification stays advisory.", processing: "Classifying material" },
};

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, credentials: "include" });
  if (!response.ok) { const error = await response.json().catch(() => null) as { statusMessage?: string } | null; throw new Error(error?.statusMessage || "Vision service request failed"); }
  return response.json() as Promise<T>;
}

export function PhotoIntakeCard({ onConfirmed }: { onConfirmed?: (scan: VisionScan) => void }) {
  const [scans, setScans] = useState<VisionScan[]>([]);
  const [status, setStatus] = useState<"online" | "processing_unavailable" | "nhtsa_unavailable">("processing_unavailable");
  const [purpose, setPurpose] = useState<VisionScanPurpose | null>(null);
  const [scan, setScan] = useState<VisionScan | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const [recent, health] = await Promise.all([request<VisionScan[]>("/api/vision/scans?limit=5"), request<{ status: typeof status }>("/api/vision/health")]);
      setScans(recent); setStatus(health.status);
    } catch { setStatus("processing_unavailable"); }
  };
  useEffect(() => { void load(); }, []);

  const upload = async (file?: File) => {
    if (!file || !purpose) return;
    if (!file.type.match(/^image\/(jpeg|png|webp)$/) || file.size > 10 * 1024 * 1024) { toast.error("Choose a JPEG, PNG, or WebP image under 10 MB."); return; }
    setBusy(true);
    try {
      const body = new FormData(); body.set("purpose", purpose); body.set("image", file);
      const created = await request<VisionScan>("/api/vision/scans", { method: "POST", body });
      setScan(created); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Scan could not be created"); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  };
  const retry = async (id: string) => { setBusy(true); try { setScan(await request<VisionScan>(`/api/vision/scans/${id}/retry`, { method: "POST" })); await load(); } catch (e) { toast.error(e instanceof Error ? e.message : "Retry failed"); } finally { setBusy(false); } };
  const confirm = async () => { if (!scan) return; setBusy(true); try { const confirmed = await request<VisionScan>(`/api/vision/scans/${scan.id}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selections: { vin: scan.result.normalizedVin || null, plate: scan.result.plateText || null, materials: scan.result.materials } }) }); setScan(confirmed); onConfirmed?.(confirmed); await load(); toast.success("Recognition result confirmed and recorded."); } catch (e) { toast.error(e instanceof Error ? e.message : "Confirmation failed"); } finally { setBusy(false); } };

  const statusLabel = status === "online" ? "Vision worker online" : status === "nhtsa_unavailable" ? "NHTSA decode unavailable" : "Processing unavailable";
  return <>
    <Card className="bg-slate-900 border-sky-500/30 text-white shadow-xl overflow-hidden">
      <CardHeader className="pb-3 border-b border-slate-800 bg-slate-950/50"><div className="flex items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><ScanLine className="h-5 w-5 text-sky-400" /> Vision Intake Scanner</CardTitle><p className="text-xs text-slate-400 mt-1">Images stay on-premises; only a validated VIN may be sent to NHTSA.</p></div><Badge className={status === "online" ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40" : "bg-amber-500/15 text-amber-300 border border-amber-500/40"}>{status === "online" ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <WifiOff className="mr-1 h-3 w-3" />}{statusLabel}</Badge></div></CardHeader>
      <CardContent className="p-4 space-y-4"><div className="grid grid-cols-1 sm:grid-cols-3 gap-2">{(Object.keys(labels) as VisionScanPurpose[]).map((kind) => <Button key={kind} onClick={() => { setPurpose(kind); setScan(null); }} className="h-auto py-3 bg-slate-800 hover:bg-sky-700 border border-slate-700 text-left justify-start gap-2"><Camera className="h-4 w-4 text-sky-300" />{labels[kind].title}</Button>)}</div>
      <div className="space-y-2">{scans.length ? scans.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl bg-slate-950/70 border border-slate-800 p-2.5"><img src={item.imageUrl} className="h-10 w-10 rounded-lg object-cover" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold capitalize">{item.purpose} scan <span className="text-slate-500">· {Math.round(item.confidence * 100)}% confidence</span></p><p className="text-[11px] text-slate-400 truncate">{item.status === "failed" ? item.errorMessage : item.status.replace("_", " ")}</p></div><Button size="sm" variant="outline" onClick={() => item.status === "failed" ? void retry(item.id) : setScan(item)} className="border-slate-700 bg-slate-800 text-xs">{item.status === "failed" ? <RefreshCw className="h-3.5 w-3.5" /> : "Review"}</Button></div>) : <p className="text-xs text-slate-500 text-center py-2">No scans have been captured yet.</p>}</div></CardContent>
    </Card>
    <Dialog open={purpose !== null} onOpenChange={(open) => !open && !busy && setPurpose(null)}><DialogContent className="max-w-lg bg-slate-950 border-slate-700 text-white"><DialogHeader><DialogTitle>{purpose && labels[purpose].title}</DialogTitle><DialogDescription className="text-slate-400">{purpose && labels[purpose].guidance}</DialogDescription></DialogHeader>{!scan ? <div className="space-y-4"><div className="rounded-2xl border border-dashed border-sky-500/40 bg-sky-500/5 p-7 text-center"><Upload className="h-8 w-8 mx-auto text-sky-300 mb-2" /><p className="text-sm font-semibold">{busy ? (purpose && labels[purpose].processing) : "Capture or choose a photo"}</p><p className="text-xs text-slate-400 mt-1">JPEG, PNG, or WebP · 320px minimum · 10 MB maximum</p></div><Input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy} onChange={(event) => void upload(event.target.files?.[0])} className="bg-slate-900 border-slate-700" />{busy && <Loader2 className="h-5 w-5 animate-spin mx-auto text-sky-400" />}</div> : <Review scan={scan} busy={busy} onRetry={() => void retry(scan.id)} onConfirm={() => void confirm()} />}</DialogContent></Dialog>
  </>;
}

function Review({ scan, busy, onRetry, onConfirm }: { scan: VisionScan; busy: boolean; onRetry: () => void; onConfirm: () => void }) { const low = scan.confidence < .75; return <div className="space-y-4"><img src={scan.imageUrl} className="w-full max-h-56 object-contain rounded-xl bg-slate-900" /><div className={`rounded-xl p-3 border ${low ? "border-amber-500/50 bg-amber-500/10" : "border-emerald-500/40 bg-emerald-500/10"}`}><p className="text-xs font-bold uppercase">{low ? "Low confidence — verify every field" : "Operator review required"}</p><p className="text-sm mt-1">VIN: {scan.result.normalizedVin || "No VIN found"} {scan.result.vinValid ? "✓" : ""}</p>{scan.result.plateText && <p className="text-sm">Plate: {scan.result.plateText}</p>}{scan.result.vinWarnings.map((warning) => <p key={warning} className="text-xs text-amber-200 mt-1">{warning}</p>)}</div>{scan.result.decode && <div className="text-xs text-slate-300 rounded-xl bg-slate-900 p-3">NHTSA: {[scan.result.decode.year, scan.result.decode.make, scan.result.decode.model].filter(Boolean).join(" ") || "No decoded vehicle details"}<br />{scan.result.decode.bodyClass || ""} {scan.result.decode.fuelType ? `· ${scan.result.decode.fuelType}` : ""}</div>}{scan.result.materials.map((item) => <p key={item.label} className="text-xs text-slate-300">Material: {item.label} ({Math.round(item.confidence * 100)}%)</p>)}<p className="text-xs text-slate-500 whitespace-pre-wrap">Raw OCR: {scan.result.rawOcrText || "No text recognized"}</p><div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={onRetry} className="border-slate-700 bg-slate-900">Retry</Button><Button disabled={busy || scan.status === "confirmed"} onClick={onConfirm} className="bg-emerald-600 hover:bg-emerald-500">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm reviewed result"}</Button></div></div>; }
