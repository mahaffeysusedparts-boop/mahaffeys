"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";

/**
 * Full-width amber banner rendered above the navbar whenever the browser
 * reports no network connection. Renders in normal flow so it pushes the
 * sticky navbar down instead of covering it.
 */
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handler = (event: Event) => setIsOnline(event.type === "online");
    window.addEventListener("online", handler);
    window.addEventListener("offline", handler);
    return () => {
      window.removeEventListener("online", handler);
      window.removeEventListener("offline", handler);
    };
  }, []);

  if (isOnline) return null;

  const handleSyncNow = () => {
    toast("Syncing now", { description: "Attempting to sync queued changes..." });
    import("@/services/sharedStorage").then((mod) => {
      mod.sharedStorage.hydrate().then(() => {
        toast("Sync completed", { description: "All changes synced." });
      });
    });
  };

  return (
    <div
      role="status"
      className="z-50 border-b border-amber-700 bg-amber-500 px-4 py-2.5 text-slate-950 shadow-lg"
      style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 sm:flex-row">
        <p className="flex items-center gap-2 text-center text-xs font-bold sm:text-sm">
          <WifiOff className="h-4 w-4 shrink-0" />
          You're offline — changes are saved locally and sync automatically when the network returns.
        </p>
        <button
          onClick={handleSyncNow}
          className="shrink-0 rounded-lg bg-slate-950 px-3.5 py-1.5 text-xs font-bold text-amber-300 shadow transition-colors hover:bg-slate-800 active:scale-95"
        >
          Sync Now
        </button>
      </div>
    </div>
  );
}
