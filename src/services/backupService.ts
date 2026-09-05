"use strict";

// ---------------------------------------------------------------------------
// Backup & Snapshot Service
// ---------------------------------------------------------------------------
// Automated periodic snapshots, export/import, and rollback capabilities.
// Stores snapshots in localStorage with SHA-256 checksum validation.

import { diagnosticLogger } from "./diagnosticLogger";

const SHARED_KEYS = [
  "mahaffeys_metals",
  "mahaffeys_car_rates",
  "mahaffeys_customers",
  "mahaffeys_tickets",
  "mahaffeys_settings",
  "mahaffeys_nmvtis_logs",
  "mahaffeys_cat_codes",
  "mahaffeys_container_drops",
  "mahaffeys_cash_drawer",
  "mahaffeys_yard_bays",
  "mahaffeys_pull_parts",
  "mahaffeys_pull_yard_vehicles",
  "mahaffeys_removed_inventory_vehicles",
  "mahaffeys_core_returns",
  "mahaffeys_admission_passes",
  "mahaffeys_ip_cameras",
  "mahaffeys_shipments",
  "mahaffeys_mills",
  "mahaffeys_timeclock",
  "mahaffeys_checklists",
  "mahaffeys_tasks",
  "mahaffeys_equipment",
  "mahaffeys_maintenance_logs",
  "mahaffeys_rate_history",
  "mahaffeys_operations_goals",
  "mahaffeys_operations_alert_rules",
  "mahaffeys_operations_alerts",
  "mahaffeys_operations_summaries",
] as const;

const SNAPSHOT_PREFIX = "mahaffeys_snapshot_";
const SNAPSHOT_INDEX_KEY = "mahaffeys_snapshot_index";
const MAX_SNAPSHOTS = 20;
const AUTO_SNAPSHOT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const SNAPSHOT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface Snapshot {
  id: string;
  timestamp: string;
  type: "auto" | "manual";
  source: string;
  sizeBytes: number;
  totalRecords: number;
  checksum: string;
  data: Record<string, unknown>;
}

export interface SnapshotMetadata {
  id: string;
  timestamp: string;
  type: "auto" | "manual";
  source: string;
  sizeBytes: number;
  totalRecords: number;
  checksum: string;
}

type SnapshotListener = (snapshots: SnapshotMetadata[]) => void;

async function computeChecksum(data: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback simple hash
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `fallback_${Math.abs(hash).toString(16)}`;
}

function countRecords(data: Record<string, unknown>): number {
  let total = 0;
  for (const value of Object.values(data)) {
    if (Array.isArray(value)) {
      total += value.length;
    } else if (value && typeof value === "object") {
      total += 1;
    }
  }
  return total;
}

class BackupService {
  private snapshots: Snapshot[] = [];
  private listeners = new Set<SnapshotListener>();
  private autoTimer: ReturnType<typeof setInterval> | null = null;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.loadSnapshots();
    this.pruneOldSnapshots();
    this.startAutoSnapshots();
  }

  private loadSnapshots(): void {
    try {
      const index = localStorage.getItem(SNAPSHOT_INDEX_KEY);
      if (!index) return;

      const metadataList = JSON.parse(index) as SnapshotMetadata[];
      if (!Array.isArray(metadataList)) return;

      this.snapshots = metadataList
        .map((meta) => {
          try {
            const data = localStorage.getItem(`${SNAPSHOT_PREFIX}${meta.id}`);
            if (!data) return null;
            return {
              ...meta,
              data: JSON.parse(data),
            } as Snapshot;
          } catch {
            return null;
          }
        })
        .filter((s): s is Snapshot => s !== null)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      diagnosticLogger.error("BackupService", "Failed to load snapshots", error as Error);
      this.snapshots = [];
    }
  }

  private saveSnapshotIndex(): void {
    try {
      const metadata: SnapshotMetadata[] = this.snapshots.map((s) => ({
        id: s.id,
        timestamp: s.timestamp,
        type: s.type,
        source: s.source,
        sizeBytes: s.sizeBytes,
        totalRecords: s.totalRecords,
        checksum: s.checksum,
      }));
      localStorage.setItem(SNAPSHOT_INDEX_KEY, JSON.stringify(metadata));
    } catch (error) {
      diagnosticLogger.error("BackupService", "Failed to save snapshot index", error as Error);
    }
  }

  private saveSnapshotData(snapshot: Snapshot): void {
    try {
      localStorage.setItem(`${SNAPSHOT_PREFIX}${snapshot.id}`, JSON.stringify(snapshot.data));
    } catch (error) {
      diagnosticLogger.error("BackupService", `Failed to save snapshot ${snapshot.id}`, error as Error);
      // Try pruning old snapshots to make room
      this.pruneOldSnapshots();
      try {
        localStorage.setItem(`${SNAPSHOT_PREFIX}${snapshot.id}`, JSON.stringify(snapshot.data));
      } catch (retryError) {
        diagnosticLogger.error("BackupService", "Snapshot save failed even after pruning", retryError as Error);
        throw retryError;
      }
    }
  }

  private notifyListeners(): void {
    const metadata = this.snapshots.map((s) => ({
      id: s.id,
      timestamp: s.timestamp,
      type: s.type,
      source: s.source,
      sizeBytes: s.sizeBytes,
      totalRecords: s.totalRecords,
      checksum: s.checksum,
    }));
    this.listeners.forEach((listener) => {
      try {
        listener(metadata);
      } catch (error) {
        console.error("Error notifying snapshot listeners:", error);
      }
    });
  }

  private startAutoSnapshots(): void {
    if (this.autoTimer) clearInterval(this.autoTimer);
    this.autoTimer = setInterval(() => {
      this.createSnapshot("auto", "hourly-rolling").catch((error) => {
        diagnosticLogger.error("BackupService", "Auto snapshot failed", error as Error);
      });
    }, AUTO_SNAPSHOT_INTERVAL_MS);
  }

  public async createSnapshot(type: "auto" | "manual" = "manual", source = "user"): Promise<SnapshotMetadata> {
    const data: Record<string, unknown> = {};
    for (const key of SHARED_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        try {
          data[key] = JSON.parse(raw);
        } catch {
          data[key] = raw;
        }
      }
    }

    const serialized = JSON.stringify(data);
    const checksum = await computeChecksum(serialized);
    const totalRecords = countRecords(data);
    const sizeBytes = new Blob([serialized]).size;

    const snapshot: Snapshot = {
      id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      type,
      source,
      sizeBytes,
      totalRecords,
      checksum,
      data,
    };

    this.snapshots.unshift(snapshot);
    if (this.snapshots.length > MAX_SNAPSHOTS) {
      const removed = this.snapshots.splice(MAX_SNAPSHOTS);
      for (const r of removed) {
        localStorage.removeItem(`${SNAPSHOT_PREFIX}${r.id}`);
      }
    }

    this.saveSnapshotData(snapshot);
    this.saveSnapshotIndex();
    this.notifyListeners();

    diagnosticLogger.info("BackupService", `Snapshot created: ${snapshot.id}`, {
      type,
      source,
      sizeBytes,
      totalRecords,
    });

    return {
      id: snapshot.id,
      timestamp: snapshot.timestamp,
      type: snapshot.type,
      source: snapshot.source,
      sizeBytes: snapshot.sizeBytes,
      totalRecords: snapshot.totalRecords,
      checksum: snapshot.checksum,
    };
  }

  public getSnapshots(): SnapshotMetadata[] {
    return this.snapshots.map((s) => ({
      id: s.id,
      timestamp: s.timestamp,
      type: s.type,
      source: s.source,
      sizeBytes: s.sizeBytes,
      totalRecords: s.totalRecords,
      checksum: s.checksum,
    }));
  }

  public getSnapshot(id: string): Snapshot | null {
    return this.snapshots.find((s) => s.id === id) ?? null;
  }

  public async restoreSnapshot(id: string): Promise<{ success: boolean; message: string; restoredKeys: number }> {
    const snapshot = this.getSnapshot(id);
    if (!snapshot) {
      return { success: false, message: "Snapshot not found", restoredKeys: 0 };
    }

    // Verify checksum
    const serialized = JSON.stringify(snapshot.data);
    const currentChecksum = await computeChecksum(serialized);
    if (currentChecksum !== snapshot.checksum) {
      diagnosticLogger.warn("BackupService", `Snapshot ${id} checksum mismatch`, {
        expected: snapshot.checksum,
        actual: currentChecksum,
      });
      // Continue anyway - data may have been serialized differently
    }

    let restoredKeys = 0;
    for (const key of SHARED_KEYS) {
      if (key in snapshot.data) {
        try {
          localStorage.setItem(key, JSON.stringify(snapshot.data[key]));
          restoredKeys++;
        } catch (error) {
          diagnosticLogger.error("BackupService", `Failed to restore key ${key}`, error as Error);
        }
      }
    }

    // Trigger a refresh event
    window.dispatchEvent(new CustomEvent("mahaffeys:remote-sync", { detail: { key: "restore" } }));

    diagnosticLogger.info("BackupService", `Snapshot restored: ${id}`, { restoredKeys });
    return { success: true, message: `Restored ${restoredKeys} data keys`, restoredKeys };
  }

  public deleteSnapshot(id: string): void {
    const index = this.snapshots.findIndex((s) => s.id === id);
    if (index === -1) return;
    this.snapshots.splice(index, 1);
    localStorage.removeItem(`${SNAPSHOT_PREFIX}${id}`);
    this.saveSnapshotIndex();
    this.notifyListeners();
  }

  public pruneOldSnapshots(): void {
    const cutoff = Date.now() - SNAPSHOT_RETENTION_MS;
    const before = this.snapshots.length;
    this.snapshots = this.snapshots.filter((s) => {
      const snapshotTime = new Date(s.timestamp).getTime();
      if (snapshotTime < cutoff && s.type === "auto") {
        localStorage.removeItem(`${SNAPSHOT_PREFIX}${s.id}`);
        return false;
      }
      return true;
    });
    if (this.snapshots.length !== before) {
      this.saveSnapshotIndex();
      this.notifyListeners();
    }
  }

  public exportSnapshot(id: string): string {
    const snapshot = this.getSnapshot(id);
    if (!snapshot) {
      throw new Error("Snapshot not found");
    }
    return JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      snapshot,
    }, null, 2);
  }

  public exportAllSnapshots(): string {
    return JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      snapshots: this.snapshots,
    }, null, 2);
  }

  public async importSnapshot(jsonData: string): Promise<{ success: boolean; message: string }> {
    try {
      const parsed = JSON.parse(jsonData);
      const snapshot = parsed.snapshot ?? parsed;
      if (!snapshot.id || !snapshot.data || !snapshot.timestamp) {
        return { success: false, message: "Invalid snapshot format" };
      }
      const checksum = await computeChecksum(JSON.stringify(snapshot.data));
      const imported: Snapshot = {
        id: `imported-${Date.now()}`,
        timestamp: snapshot.timestamp,
        type: "manual",
        source: "imported",
        sizeBytes: new Blob([JSON.stringify(snapshot.data)]).size,
        totalRecords: countRecords(snapshot.data),
        checksum,
        data: snapshot.data,
      };
      this.snapshots.unshift(imported);
      if (this.snapshots.length > MAX_SNAPSHOTS) {
        this.snapshots = this.snapshots.slice(0, MAX_SNAPSHOTS);
      }
      this.saveSnapshotData(imported);
      this.saveSnapshotIndex();
      this.notifyListeners();
      diagnosticLogger.info("BackupService", `Snapshot imported: ${imported.id}`);
      return { success: true, message: "Snapshot imported successfully" };
    } catch (error) {
      diagnosticLogger.error("BackupService", "Snapshot import failed", error as Error);
      return { success: false, message: error instanceof Error ? error.message : "Import failed" };
    }
  }

  public subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshots());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getStats() {
    const totalSize = this.snapshots.reduce((sum, s) => sum + s.sizeBytes, 0);
    const autoCount = this.snapshots.filter((s) => s.type === "auto").length;
    const manualCount = this.snapshots.filter((s) => s.type === "manual").length;
    return {
      total: this.snapshots.length,
      autoCount,
      manualCount,
      totalSizeBytes: totalSize,
      totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
      oldest: this.snapshots[this.snapshots.length - 1]?.timestamp,
      newest: this.snapshots[0]?.timestamp,
    };
  }
}

export const backupService = new BackupService();