import { apiRequest } from "./apiClient";

export type PrinterKind = "standard" | "sticker";

export interface NetworkPrinter {
  id: string;
  name: string;
  host: string;
  kind: PrinterKind;
  createdAt: string;
}

export interface PrintJobResult {
  queued: boolean;
  printer: string;
}

export const networkPrinterService = {
  list: () => apiRequest<NetworkPrinter[]>("/api/printers"),
  add: (printer: { name: string; host: string; queuePath?: string; kind: PrinterKind }) =>
    apiRequest<NetworkPrinter>("/api/printers", { method: "POST", body: JSON.stringify(printer) }),
  remove: (id: string) => apiRequest<{ removed: boolean }>(`/api/printers/${id}`, { method: "DELETE" }),
  print: (id: string, html: string, documentName?: string) =>
    apiRequest<PrintJobResult>(`/api/printers/${id}/print`, {
      method: "POST",
      body: JSON.stringify({ html, documentName }),
    }),
};
