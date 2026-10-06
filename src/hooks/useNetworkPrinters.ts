import { useEffect, useState } from "react";
import { toast } from "sonner";
import { networkPrinterService, type NetworkPrinter } from "@/services/networkPrinterService";

export function useNetworkPrinters() {
  const [printers, setPrinters] = useState<NetworkPrinter[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setPrinters(await networkPrinterService.list());
    } catch (error) {
      toast.error("Could not load network printers", { description: error instanceof Error ? error.message : "Printer service unavailable" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return { printers, loading, reload: load };
}
