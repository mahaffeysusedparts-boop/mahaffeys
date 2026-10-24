import { useMemo, useState } from "react";
import { LoaderCircle, Printer, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNetworkPrinters } from "@/hooks/useNetworkPrinters";
import { networkPrinterService, type PrinterKind } from "@/services/networkPrinterService";
import { printRoutingService } from "@/services/printRoutingService";
import { preparePrintDocument, printBrowserDocument } from "@/utils/preparePrintDocument";

interface NetworkPrintButtonProps {
  kind: PrinterKind;
  rootSelector: string;
  documentName: string;
  className?: string;
  disabled?: boolean;
}

function collectStyles() {
  const styles: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      styles.push(Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n"));
    } catch {
      // Cross-origin stylesheets cannot be read by the browser.
    }
  }
  return styles.join("\n");
}

export function NetworkPrintButton({ kind, rootSelector, documentName, className, disabled = false }: NetworkPrintButtonProps) {
  const { printers, loading } = useNetworkPrinters();
  const available = useMemo(() => printers.filter((printer) => printer.kind === kind), [printers, kind]);
  const defaults = printRoutingService.getDefaults();
  const defaultId = kind === "sticker" ? defaults.stickerPrinterId : defaults.standardPrinterId;
  const [selectedId, setSelectedId] = useState(defaultId || "");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const selected = available.find((printer) => printer.id === selectedId);
    const root = document.querySelector(rootSelector);
    if (!selected) {
      toast.error(`Add or select a ${kind} printer in Settings first`);
      return;
    }
    if (!(root instanceof HTMLElement)) {
      toast.error("Could not find the printable document");
      return;
    }
    setSending(true);
    let html: string;
    try {
      html = `<style>${collectStyles()}</style><main>${await preparePrintDocument(root)}</main>`;
      if (html.length > 15_000_000) throw new Error("The document with photos is too large for direct printing. The print job was not sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not prepare photos. The print job was not sent.");
      setSending(false);
      return;
    }
    try {
      const result = await networkPrinterService.print(selected.id, html, documentName);
      if (kind === "sticker") printRoutingService.setStickerPrinter(selected.id);
      else printRoutingService.setStandardPrinter(selected.id);
      toast.success(`Sent to ${result.printer}`, { description: "The job was accepted by the shared printer." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The server could not print this document";
      toast.warning("Network printing failed — use device print dialog", {
        description: message,
        action: { label: "Print on this device", onClick: () => {
          void printBrowserDocument(root).catch(error => toast.error(error instanceof Error ? error.message : 'Could not prepare photos for printing'));
        } },
        actionButtonStyle: { backgroundColor: "#0ea5e9", color: "#0f172a" },
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Select value={selectedId} onValueChange={setSelectedId} disabled={loading || available.length === 0 || sending}>
        <SelectTrigger className="h-9 min-w-40 rounded-xl border-slate-700 bg-slate-900 text-xs text-slate-100">
          <SelectValue placeholder={loading ? "Loading…" : "Choose printer"} />
        </SelectTrigger>
        <SelectContent className="border-slate-700 bg-slate-900 text-slate-100">
          {available.map((printer) => <SelectItem key={printer.id} value={printer.id}>{printer.name} · {printer.host}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button type="button" onClick={() => void submit()} disabled={disabled || sending || loading || available.length === 0} className={className || "rounded-xl bg-sky-500 font-bold text-slate-950 hover:bg-sky-400"}>
        {sending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
        {sending ? "Sending…" : "Print direct"}
      </Button>
    </div>
  );
}
