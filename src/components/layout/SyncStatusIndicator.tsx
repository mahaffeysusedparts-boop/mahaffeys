"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Activity,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { syncService } from "@/services/syncService";
import { offlineQueue } from "@/services/offlineQueue";
import { diagnosticLogger } from "@/services/diagnosticLogger";
import { sharedStorage } from "@/services/sharedStorage";
import { toast } from "sonner";

type SyncStatus = "idle" | "polling" | "error";
type ConnectionStatus = "local" | "connecting" | "connected" | "error";

interface SyncState {
  syncStatus: SyncStatus;
  lastSyncedAt: number;
  connectionStatus: ConnectionStatus;
  queueSize: number;
  isOnline: boolean;
}

export const SyncStatusIndicator: React.FC = () => {
  const navigate = useNavigate();
  const [syncState, setSyncState] = useState<SyncState>({
    syncStatus: "idle",
    lastSyncedAt: 0,
    connectionStatus: "local",
    queueSize: 0,
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    // Subscribe to sync service
    const unsubscribeSync = syncService.subscribe((status, lastSyncedAt) => {
      setSyncState((prev) => ({ ...prev, syncStatus: status, lastSyncedAt }));
    });

    // Subscribe to sharedStorage connection status
    const unsubscribeStorage = sharedStorage.subscribe((status) => {
      setSyncState((prev) => ({ ...prev, connectionStatus: status }));
    });

    // Subscribe to offline queue
    const unsubscribeQueue = offlineQueue.subscribe((queue) => {
      setSyncState((prev) => ({ ...prev, queueSize: queue.length }));
    });

    // Listen for online/offline events
    const handleOnline = () => {
      setSyncState((prev) => ({ ...prev, isOnline: true }));
      toast.success("Back online - syncing queued changes");
    };

    const handleOffline = () => {
      setSyncState((prev) => ({ ...prev, isOnline: false }));
      toast.error("Network disconnected - changes queued locally");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      unsubscribeSync();
      unsubscribeStorage();
      unsubscribeQueue();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleForceResync = useCallback(async () => {
    try {
      toast.info("Force re-syncing all data...");
      await sharedStorage.hydrate();
      await sharedStorage.flushNow();
      diagnosticLogger.sync("SyncStatusIndicator", "Force re-sync completed");
      toast.success("Sync completed successfully");
      setIsDrawerOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      diagnosticLogger.error("SyncStatusIndicator", "Force re-sync failed", error as Error);
      toast.error(`Sync failed: ${message}`);
    }
  }, []);

  const handleDownloadDiagnostics = useCallback(() => {
    const logs = diagnosticLogger.exportLogs();
    const blob = new Blob([logs], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sync-diagnostics-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Diagnostic bundle downloaded");
  }, []);

  const formatTimeAgo = (timestamp: number): string => {
    if (timestamp === 0) return "Never";
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Determine badge status
  const getBadgeStatus = () => {
    if (!syncState.isOnline) {
      return {
        color: "bg-yellow-500",
        text: "Offline",
        icon: WifiOff,
        tooltip: "You are offline - changes queued locally",
      };
    }

    if (syncState.queueSize > 0) {
      return {
        color: "bg-blue-500",
        text: `Syncing (${syncState.queueSize})`,
        icon: RefreshCw,
        tooltip: "Syncing queued changes",
      };
    }

    if (syncState.syncStatus === "error" || syncState.connectionStatus === "error") {
      return {
        color: "bg-red-500",
        text: "Sync Alert",
        icon: AlertTriangle,
        tooltip: "Sync error - click for details",
      };
    }

    if (syncState.syncStatus === "polling") {
      return {
        color: "bg-blue-400",
        text: "Syncing...",
        icon: RefreshCw,
        tooltip: "Syncing with server",
      };
    }

    return {
      color: "bg-emerald-500",
      text: "Synced",
      icon: CheckCircle2,
      tooltip: "All changes synced",
    };
  };

  const badge = getBadgeStatus();
  const Icon = badge.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`relative h-9 px-2.5 gap-1.5 rounded-lg border transition-all hover:scale-105 active:scale-95 ${
                  syncState.isOnline
                    ? syncState.queueSize > 0
                      ? "border-blue-500/50 bg-blue-950/30 text-blue-300"
                      : syncState.syncStatus === "error"
                        ? "border-red-500/50 bg-red-950/30 text-red-300"
                        : "border-emerald-500/50 bg-emerald-950/30 text-emerald-300"
                    : "border-yellow-500/50 bg-yellow-950/30 text-yellow-300"
                }`}
                aria-label="Sync status"
              >
                <Icon
                  className={`w-4 h-4 ${
                    syncState.queueSize > 0 && syncState.isOnline ? "animate-spin" : ""
                  }`}
                />
                <span className="text-xs font-semibold hidden sm:inline">{badge.text}</span>
                {syncState.queueSize > 0 && (
                  <Badge
                    variant="secondary"
                    className="absolute -top-1 -right-1 h-4 w-4 rounded-full p-0 flex items-center justify-center text-[9px] bg-amber-500 text-slate-950"
                  >
                    {syncState.queueSize}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-[380px] bg-slate-950 border-slate-800 text-slate-100">
              <SheetHeader className="pb-4 border-b border-slate-800">
                <SheetTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  Sync Diagnostics
                </SheetTitle>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto py-4 space-y-4">
                {/* Status Overview */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Network</div>
                    <div className={`text-sm font-bold mt-1 ${syncState.isOnline ? "text-emerald-400" : "text-yellow-400"}`}>
                      {syncState.isOnline ? "Online" : "Offline"}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Connection</div>
                    <div className={`text-sm font-bold mt-1 ${
                      syncState.connectionStatus === "connected" ? "text-emerald-400" :
                      syncState.connectionStatus === "error" ? "text-red-400" : "text-amber-400"
                    }`}>
                      {syncState.connectionStatus}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Sync Status</div>
                    <div className={`text-sm font-bold mt-1 ${
                      syncState.syncStatus === "idle" ? "text-emerald-400" :
                      syncState.syncStatus === "error" ? "text-red-400" : "text-blue-400"
                    }`}>
                      {syncState.syncStatus}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Queued</div>
                    <div className="text-sm font-bold mt-1 text-amber-400">{syncState.queueSize}</div>
                  </div>
                </div>

                {/* Last Sync */}
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center gap-3">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Last Synced</div>
                    <div className="text-sm font-mono text-white">{formatTimeAgo(syncState.lastSyncedAt)}</div>
                  </div>
                </div>

                {/* Offline Queue Details */}
                {syncState.queueSize > 0 && (
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-white">Offline Queue</div>
                      <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-400">
                        {syncState.queueSize} pending
                      </Badge>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {offlineQueue.getQueue().slice(-5).map((mutation) => (
                        <div key={mutation.id} className="text-[10px] font-mono text-slate-400 flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          <span className="truncate">{mutation.type}</span>
                          {mutation.key && <span className="text-slate-500">→ {mutation.key}</span>}
                          <span className={`ml-auto ${mutation.retries > 0 ? "text-amber-400" : "text-slate-500"}`}>
                            {mutation.retries > 0 ? `retry ${mutation.retries}` : "pending"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="space-y-2">
                  <Button
                    onClick={handleForceResync}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
                    size="sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Force Re-sync Now
                  </Button>
                  <Button
                    onClick={handleDownloadDiagnostics}
                    variant="outline"
                    className="w-full border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 gap-2"
                    size="sm"
                  >
                    <Database className="w-4 h-4" />
                    Download Diagnostic Bundle
                  </Button>
                </div>

                {/* Recent Sync Logs */}
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="text-xs font-semibold text-white mb-2">Recent Sync Logs</div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {diagnosticLogger.getLogs("sync", undefined, 10).map((log) => (
                      <div key={log.id} className="text-[10px] font-mono text-slate-400 flex items-start gap-2">
                        <span className="text-slate-500 shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={`
                          ${log.level === "error" ? "text-red-400" :
                            log.level === "warn" ? "text-amber-400" :
                            "text-emerald-400"}
                        `}>
                          {log.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{badge.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};