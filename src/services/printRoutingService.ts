import { networkPrinterService, type NetworkPrinter, type PrinterKind } from "./networkPrinterService";

const STORAGE_KEY = "mahaffeys_print_defaults";

interface PrintDefaults {
  standardPrinterId?: string;
  stickerPrinterId?: string;
}

function readDefaults(): PrintDefaults {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeDefaults(value: PrintDefaults) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export const printRoutingService = {
  getDefaults: readDefaults,
  setStandardPrinter: (id: string) => writeDefaults({ ...readDefaults(), standardPrinterId: id }),
  setStickerPrinter: (id: string) => writeDefaults({ ...readDefaults(), stickerPrinterId: id }),

  /** Resolves the printer to use for a given document kind, preferring the user's saved default. */
  resolvePrinter: (printers: NetworkPrinter[], kind: PrinterKind): NetworkPrinter | undefined => {
    const defaults = readDefaults();
    const preferredId = kind === "sticker" ? defaults.stickerPrinterId : defaults.standardPrinterId;
    if (preferredId) return printers.find((printer) => printer.id === preferredId);
    return printers.find((printer) => printer.kind === kind);
  },

  /** Sends an HTML document to a network printer, falling back to the browser print dialog. */
  printToNetwork: async (printer: NetworkPrinter, html: string, documentName?: string): Promise<boolean> => {
    try {
      await networkPrinterService.print(printer.id, html, documentName);
      return true;
    } catch (error) {
      console.error("Network print failed, falling back to browser dialog:", error);
      return false;
    }
  },
};
