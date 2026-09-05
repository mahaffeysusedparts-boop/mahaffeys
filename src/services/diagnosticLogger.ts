"use strict";

// ---------------------------------------------------------------------------
// Diagnostic Logger Service
// ---------------------------------------------------------------------------
// Centralized structured logger with ring buffer for crash-safe telemetry.
// Captures client crashes, network failures, scale timeouts, and sync anomalies.
// Integrates with SystemHealthPage for real-time log feed and export.

export type LogLevel = "debug" | "info" | "warn" | "error" | "sync" | "hardware";

export interface DiagnosticLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  context?: Record<string, unknown>;
  stack?: string;
  userAgent?: string;
  networkStatus?: string;
  offlineQueueSize?: number;
  scaleConnected?: boolean;
  syncStatus?: string;
}

// Ring buffer: max 500 entries to avoid storage quota issues
const MAX_LOG_ENTRIES = 500;
const STORAGE_KEY = "mahaffeys_diagnostic_logs";

class DiagnosticLogger {
  private logs: DiagnosticLog[] = [];
  private listeners = new Set<(logs: DiagnosticLog[]) => void>();
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Load existing logs from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as DiagnosticLog[];
        this.logs = Array.isArray(parsed) ? parsed.slice(-MAX_LOG_ENTRIES) : [];
      }
    } catch (error) {
      console.error("Failed to load diagnostic logs:", error);
      this.logs = [];
    }

    // Set up periodic cleanup
    setInterval(() => this.cleanup(), 60_000); // Every minute
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs.slice(-MAX_LOG_ENTRIES)));
    } catch (error) {
      console.error("Failed to save diagnostic logs:", error);
    }
  }

  private cleanup() {
    if (this.logs.length > MAX_LOG_ENTRIES) {
      this.logs = this.logs.slice(-MAX_LOG_ENTRIES);
      this.saveToStorage();
    }
  }

  public log(level: LogLevel, source: string, message: string, context?: Record<string, unknown>): void {
    const log: DiagnosticLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
      context,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      networkStatus: typeof navigator !== "undefined" ? (navigator.onLine ? "online" : "offline") : undefined,
    };

    this.logs.push(log);
    this.saveToStorage();
    this.notifyListeners();

    // Also output to console for debugging
    const consoleMethod = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    consoleMethod(`[${source}] ${message}`, context || "");
  }

  public error(source: string, message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log("error", source, message, {
      ...context,
      error: error?.message,
      stack: error?.stack,
    });
  }

  public warn(source: string, message: string, context?: Record<string, unknown>): void {
    this.log("warn", source, message, context);
  }

  public info(source: string, message: string, context?: Record<string, unknown>): void {
    this.log("info", source, message, context);
  }

  public debug(source: string, message: string, context?: Record<string, unknown>): void {
    this.log("debug", source, message, context);
  }

  public sync(source: string, message: string, context?: Record<string, unknown>): void {
    this.log("sync", source, message, context);
  }

  public hardware(source: string, message: string, context?: Record<string, unknown>): void {
    this.log("hardware", source, message, context);
 }

  public getLogs(level?: LogLevel, source?: string, limit?: number): DiagnosticLog[] {
    let filtered = this.logs;

    if (level) {
      filtered = filtered.filter((log) => log.level === level);
    }

    if (source) {
      filtered = filtered.filter((log) => log.source === source);
    }

    // Return most recent logs first
    filtered = filtered.reverse();

    if (limit) {
      filtered = filtered.slice(0, limit);
    }

    return filtered;
  }

  public exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  public clearLogs(): void {
    this.logs = [];
    this.saveToStorage();
    this.notifyListeners();
  }

  public subscribe(listener: (logs: DiagnosticLog[]) => void): () => void {
    this.listeners.add(listener);
    // Immediately notify with current logs
    listener(this.logs.slice().reverse());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.logs.slice().reverse());
      } catch (error) {
        console.error("Error notifying diagnostic logger listeners:", error);
      }
    });
  }

  public getStats() {
    const now = new Date();
    const last24h = this.logs.filter((log) => {
      const logTime = new Date(log.timestamp);
      return now.getTime() - logTime.getTime() < 24 * 60 * 60 * 1000;
    });

    const byLevel = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      sync: 0,
      hardware: 0,
    };

    last24h.forEach((log) => {
      if (log.level in byLevel) {
        byLevel[log.level as keyof typeof byLevel]++;
      }
    });

    return {
      total: this.logs.length,
      last24h: last24h.length,
      byLevel,
      oldest: this.logs[0]?.timestamp,
      newest: this.logs[this.logs.length - 1]?.timestamp,
    };
  }
}

export const diagnosticLogger = new DiagnosticLogger();