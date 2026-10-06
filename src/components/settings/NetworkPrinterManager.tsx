import { useCallback, useEffect, useState } from "react";
import { Check, LoaderCircle, Printer, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { networkPrinterService, type NetworkPrinter, type PrinterKind } from "@/services/networkPrinterService";

export function NetworkPrinterManager() {
  const [printers, setPrinters] = useState<NetworkPrinter[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [queuePath, setQueuePath] = useState("/ipp/print");
  const [kind, setKind] = useState<PrinterKind>("standard");

  const loadPrinters = useCallback(async () => {
    setLoading(true);
    try {
      setPrinters(await networkPrinterService.list());
    } catch (error) {
      toast.error("Could not load network printers", { description: error instanceof Error ? error.message : "Printer service unavailable" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPrinters(); }, [loadPrinters]);

  const addPrinter = async () => {
    setAdding(true);
    try {
      const printer = await networkPrinterService.add({ name, host, queuePath, kind });
      setPrinters((current) => [...current, printer].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setHost("");
      toast.success("Network printer added", { description: `${printer.name} is ready for shared printing.` });
    } catch (error) {
      toast.error("Could not add printer", { description: error instanceof Error ? error.message : "CUPS could not configure this printer" });
    } finally {
      setAdding(false);
    }
  };

  const removePrinter = async (printer: NetworkPrinter) => {
    setRemovingId(printer.id);
    try {
      await networkPrinterService.remove(printer.id);
      setPrinters((current) => current.filter((item) => item.id !== printer.id));
      toast.success(`${printer.name} removed`);
    } catch (error) {
      toast.error("Could not remove printer", { description: error instanceof Error ? error.message : "CUPS could not remove this printer" });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Card className="overflow-hidden rounded-3xl border-slate-800 bg-slate-900 text-slate-100 shadow-xl">
      <CardHeader className="gap-4 border-b border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg"><Printer className="h-5 w-5 text-sky-400" /> Shared network printers</CardTitle>
          <p className="mt-1 text-xs text-slate-400">Add shared office and dedicated sticker printers once; all workstations can select them at print time.</p>
        </div>
        <Button onClick={() => void loadPrinters()} disabled={loading} variant="outline" className="rounded-xl border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh list
        </Button>
      </CardHeader>
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="grid gap-3 rounded-2xl border border-slate-700 bg-slate-950/60 p-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto] lg:items-end">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400">Printer name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Front office laser" disabled={adding} className="rounded-xl border-slate-700 bg-slate-900 text-slate-100" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400">Printer IP / hostname</Label>
            <Input value={host} onChange={(event) => setHost(event.target.value)} placeholder="192.168.1.45" disabled={adding} className="rounded-xl border-slate-700 bg-slate-900 font-mono text-slate-100" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400">IPP queue path</Label>
            <Input value={queuePath} onChange={(event) => setQueuePath(event.target.value)} placeholder="/ipp/print" disabled={adding} className="rounded-xl border-slate-700 bg-slate-900 font-mono text-slate-100" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400">Printer type</Label>
            <Select value={kind} onValueChange={(value) => setKind(value as PrinterKind)} disabled={adding}>
              <SelectTrigger className="rounded-xl border-slate-700 bg-slate-900 text-slate-100"><SelectValue /></SelectTrigger>
              <SelectContent className="border-slate-700 bg-slate-900 text-slate-100">
                <SelectItem value="standard">Receipts / documents</SelectItem>
                <SelectItem value="sticker">Vehicle stickers</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => void addPrinter()} disabled={adding || !name.trim() || !host.trim() || !queuePath.trim()} className="rounded-xl bg-sky-400 font-black text-slate-950 hover:bg-sky-300">
            {adding ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}{adding ? "Connecting…" : "Add printer"}
          </Button>
        </div>

        <div className="flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-xs leading-5 text-amber-100">
          <Printer className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p>Enter the printer's IPP path and give it a reserved/static LAN address. The app server needs CUPS and Chromium installed, with network access to printers on the local network.</p>
        </div>

        <div className="space-y-2">
          {loading ? <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-center text-sm text-slate-400">Loading configured printers…</div> : printers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-8 text-center">
              <Printer className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-3 font-bold text-slate-200">No shared printers yet</p>
              <p className="mt-1 text-xs text-slate-500">Add your first network printer above to share it across workstations.</p>
            </div>
          ) : printers.map((printer) => (
            <div key={printer.id} className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`rounded-xl p-2.5 ${printer.kind === "sticker" ? "bg-amber-500/15 text-amber-300" : "bg-sky-500/15 text-sky-300"}`}><Printer className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-bold text-white">{printer.name}</p><Badge variant="outline" className={`rounded-full ${printer.kind === "sticker" ? "border-amber-500/40 text-amber-300" : "border-sky-500/40 text-sky-300"}`}>{printer.kind === "sticker" ? "STICKER" : "STANDARD"}</Badge></div>
                  <p className="mt-1 truncate font-mono text-xs text-slate-400">{printer.host} · CUPS / IPP</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => void removePrinter(printer)} disabled={removingId === printer.id} className="rounded-xl border-red-500/30 bg-red-500/5 text-red-300 hover:bg-red-500/15 hover:text-red-200">
                {removingId === printer.id ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Remove
              </Button>
            </div>
          ))}
        </div>
        {printers.length > 0 ? <p className="flex items-center gap-2 text-[11px] text-emerald-300"><Check className="h-3.5 w-3.5" /> These printer profiles are stored on the server and available to all signed-in workstations.</p> : null}
      </CardContent>
    </Card>
  );
}
