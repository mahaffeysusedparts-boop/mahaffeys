"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const navigate = useNavigate();

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

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-amber-600 text-slate-950 border-b border-slate-800 px-4 py-3 shadow-lg text-center"
    >
      <div className="max-w-7xl mx-auto">
        <p className="text-sm font-medium">
          You are offline. Changes are saved locally and will sync when you're back online.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            toast("Syncing now", { description: "Attempting to sync queued changes..." });
            // Trigger a manual sync via the shared storage service
            import("@/services/sharedStorage").then((mod) => {
              mod.sharedStorage.hydrate().then(() => {
                toast("Sync completed", { description: "All changes synced." });
              });
            });
          }}
        >
          Sync Now
        </Button>
      </div>
    </div>
  );
}