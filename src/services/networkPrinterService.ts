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

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function gzipBase64(input: string) {
  if (!("CompressionStream" in window)) return undefined;
  const stream = new Blob([input]).stream().pipeThrough(new CompressionStream("gzip"));
  const buffer = await new Response(stream).arrayBuffer();
  return bytesToBase64(new Uint8Array(buffer));
}

export const networkPrinterService = {
  list: () => apiRequest<NetworkPrinter[]>("/api/printers"),
  add: (printer: { name: string; host: string; queuePath?: string; kind: PrinterKind }) =>
    apiRequest<NetworkPrinter>("/api/printers", { method: "POST", body: JSON.stringify(printer) }),
  remove: (id: string) => apiRequest<{ removed: boolean }>(`/api/printers/${id}`, { method: "DELETE" }),
  print: async (id: string, html: string, documentName?: string) => {
    const htmlGzipBase64 = await gzipBase64(html).catch(() => undefined);
    const body = htmlGzipBase64 && htmlGzipBase64.length < html.length
      ? { htmlGzipBase64, documentName }
      : { html, documentName };
    return apiRequest<PrintJobResult>(`/api/printers/${id}/print`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
