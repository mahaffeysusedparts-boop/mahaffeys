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
  pendingWrites: number;
  isOnline: boolean;
}

export const SyncStatusIndicator: React.FC = () => {
  const navigate = useNavigate();
  const [syncState, setSyncState] = useState<SyncState>({
    syncStatus: "idle",
    lastSyncedAt: 0,
    connectionStatus: "local",
    queueSize: 0,
    pendingWrites: 0,
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);

  useEffect(() => {
    // Subscribe to sync service
    const unsubscribeSync = syncService.subscribe((status, lastSyncedAt) => {
      setSyncState((prev) => ({ ...prev, syncStatus: status, lastSyncedAt }));
    });

    // Subscribe to sharedStorage connection status
    const unsubscribeStorage = sharedStorage.subscribe((status) => {
      setSyncState((prev) => ({ ...prev, connectionStatus: status, pendingWrites: sharedStorage.getPendingWriteCount() }));
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
    setIsResyncing(true);
    try {
      toast.info("Re-syncing server data...");
      await offlineQueue.flushNow();
      // Upload pending edits before hydration can replace local snapshots.
      if (sharedStorage.getPendingWriteCount() > 0) await sharedStorage.flushNow();
      await sharedStorage.hydrate();
      await sharedStorage.flushNow();
      await syncService.syncNow();
      if (offlineQueue.getQueueSize() > 0) throw new Error("Offline changes are still waiting to sync.");
      diagnosticLogger.sync("SyncStatusIndicator", "Force re-sync completed");
      toast.success("Sync completed successfully");
      setIsDrawerOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      diagnosticLogger.error("SyncStatusIndicator", "Force re-sync failed", error as Error);
      toast.error(`Sync failed: ${message}`);
    } finally {
      setIsResyncing(false);
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

  const pendingCount = syncState.queueSize + syncState.pendingWrites;
  const syncError = syncState.connectionStatus === "error"
    ? sharedStorage.getLastError()
    : syncState.syncStatus === "error" ? syncService.getStatus().lastError : null;

  const getBadgeStatus = () => {
    if (!syncState.isOnline) {
      return {
        className: "border-yellow-500/50 bg-yellow-950/30 text-yellow-300",
        text: "Offline", icon: WifiOff,
        tooltip: "You are offline - changes queued locally",
      };
    }
    if (syncState.syncStatus === "error" || syncState.connectionStatus === "error") {
      return {
        className: "border-red-500/50 bg-red-950/30 text-red-300",
        text: "Sync Alert", icon: AlertTriangle,
        tooltip: syncError || "Sync error - click for details",
      };
    }
    if (isResyncing || pendingCount > 0 || syncState.syncStatus === "polling" || syncState.connectionStatus === "connecting") {
      return {
        className: "border-blue-500/50 bg-blue-950/30 text-blue-300",
        text: pendingCount > 0 ? `Syncing (${pendingCount})` : "Syncing...",
        icon: RefreshCw, tooltip: "Syncing with server",
      };
    }
    if (syncState.connectionStatus === "local" || syncState.lastSyncedAt === 0) {
      return {
        className: "border-yellow-500/50 bg-yellow-950/30 text-yellow-300",
        text: "Not synced", icon: Clock,
        tooltip: "Server sync has not completed yet",
      };
    }
    return {
      className: "border-emerald-500/50 bg-emerald-950/30 text-emerald-300",
      text: "Synced", icon: CheckCircle2,
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
                className={`relative h-9 px-2.5 gap-1.5 rounded-lg border transition-colors ${badge.className}`}
                aria-label={`Sync status: ${badge.text}`}
              >
                <Icon className={`w-4 h-4 ${Icon === RefreshCw ? "motion-safe:animate-spin" : ""}`} />
                <span className="text-xs font-semibold hidden sm:inline">{badge.text}</span>
                {pendingCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full px-1 flex items-center justify-center text-[9px] bg-amber-500 text-slate-950"
                  >
                    {pendingCount}
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
                {syncError && (
                  <div role="alert" className="rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-200">
                    <div className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Server sync failed</div>
                    <p className="break-words">{syncError}</p>
                    <p className="mt-2 text-xs">Pending uploads are retained for retry. Use Re-sync Now to try again.</p>
                  </div>
                )}
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
                    <div className="text-sm font-bold mt-1 text-amber-400">{pendingCount}</div>
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
                    disabled={isResyncing || !syncState.isOnline}
                    className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
                    size="sm"
                  >
                    <RefreshCw className={`w-4 h-4 ${isResyncing ? "motion-safe:animate-spin" : ""}`} />
                    {isResyncing ? "Re-syncing..." : "Re-sync Now"}
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