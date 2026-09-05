"use client";

import React, { Component, ErrorInfo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Download, RotateCcw } from "lucide-react";
import { diagnosticLogger } from "@/services/diagnosticLogger";
import { toast } from "sonner";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Log to diagnostic logger
    diagnosticLogger.error("AppErrorBoundary", `Component error: ${error.message}`, error, {
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
    });

    // Call optional onError callback
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  handleExportDiagnostics = (): void => {
    const logs = diagnosticLogger.exportLogs();
    const blob = new Blob([logs], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagnostic-${this.state.errorId || "export"}-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Diagnostic log exported successfully");
  };

  handleSafeCacheRepair = (): void => {
    try {
      // Clear corrupted cache entries while preserving offline queue
      const offlineQueue = localStorage.getItem("mahaffeys_offline_queue");
      localStorage.clear();
      if (offlineQueue) {
        localStorage.setItem("mahaffeys_offline_queue", offlineQueue);
      }
      diagnosticLogger.info("AppErrorBoundary", "Safe cache repair completed - offline queue preserved");
      toast.success("Cache repaired - offline queue preserved");
      this.handleRetry();
    } catch (error) {
      diagnosticLogger.error("AppErrorBoundary", "Cache repair failed", error as Error);
      toast.error("Cache repair failed - please refresh the page");
    }
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <Card className="w-full max-w-lg bg-slate-900 border-slate-800 shadow-xl">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-lg text-white">Something went wrong</CardTitle>
                  <p className="text-xs text-slate-400 mt-0.5">
                    An unexpected error occurred in this section
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-slate-300">
                <div className="text-slate-400 mb-1">Error ID:</div>
                <div className="text-amber-400">{this.state.errorId}</div>
                {this.state.error && (
                  <>
                    <div className="text-slate-400 mt-2 mb-1">Message:</div>
                    <div className="text-red-400">{this.state.error.message}</div>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={this.handleRetry}
                  variant="default"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry Component
                </Button>

                <Button
                  onClick={this.handleExportDiagnostics}
                  variant="outline"
                  className="w-full border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export Diagnostic Log
                </Button>

                <Button
                  onClick={this.handleSafeCacheRepair}
                  variant="outline"
                  className="w-full border-amber-500/50 bg-amber-950/20 text-amber-400 hover:bg-amber-950/40 gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Safe Cache Repair & Re-sync
                </Button>
              </div>

              <p className="text-xs text-slate-500 text-center">
                Other tabs and sessions remain unaffected
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for functional components to trigger error boundary recovery
export function useErrorBoundary(): { showBoundary: (error: Error) => void } {
  // This is a simplified hook - in practice, you'd use context or a more complex pattern
  return {
    showBoundary: (error: Error) => {
      diagnosticLogger.error("useErrorBoundary", `Triggered boundary: ${error.message}`, error);
      throw error;
    },
  };
}