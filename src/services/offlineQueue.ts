"use strict";

// ---------------------------------------------------------------------------
// Offline Mutation Queue Service
// ---------------------------------------------------------------------------
// Persistent offline write queue with auto-drain on network reconnect.
// Ensures zero data loss during network hiccups.

export interface OfflineMutation {
  id: string;
  timestamp: string;
  type: "storage_set" | "storage_remove" | "api_call";
  key?: string;
  value?: string;
  path?: string;
  method?: string;
  body?: string;
  retries: number;
  lastError?: string;
}

const QUEUE_KEY = "mahaffeys_offline_queue";
const MAX_QUEUE_SIZE = 1000;
const MAX_RETRIES = 5;

type QueueListener = (queue: OfflineMutation[]) => void;

class OfflineQueue {
  private queue: OfflineMutation[] = [];
  private listeners = new Set<QueueListener>();
  private isDraining = false;
  private isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  private drainTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.loadFromStorage();
    this.setupNetworkListeners();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as OfflineMutation[];
        this.queue = Array.isArray(parsed) ? parsed.slice(-MAX_QUEUE_SIZE) : [];
      }
    } catch (error) {
      console.error("Failed to load offline queue:", error);
      this.queue = [];
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error("Failed to save offline queue:", error);
      // Try to trim queue if storage is full
      if (this.queue.length > 100) {
        this.queue = this.queue.slice(-100);
        try {
          localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
        } catch {
          // Give up if still failing
        }
      }
    }
  }

  private setupNetworkListeners(): void {
    if (typeof window === "undefined") return;

    window.addEventListener("online", () => {
      this.isOnline = true;
      this.scheduleDrain();
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
    });
  }

  private scheduleDrain(): void {
    if (this.drainTimer || !this.isOnline) return;
    this.drainTimer = setTimeout(() => {
      this.drainTimer = null;
      void this.drain();
    }, 500);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener([...this.queue]);
      } catch (error) {
        console.error("Error notifying queue listeners:", error);
      }
    });
  }

  public enqueue(mutation: Omit<OfflineMutation, "id" | "timestamp" | "retries">): string {
    const entry: OfflineMutation = {
      ...mutation,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      retries: 0,
    };

    this.queue.push(entry);
    this.saveToStorage();
    this.notifyListeners();
    this.scheduleDrain();

    return entry.id;
  }

  public dequeue(id: string): void {
    const index = this.queue.findIndex((m) => m.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  public markFailed(id: string, error: string): void {
    const entry = this.queue.find((m) => m.id === id);
    if (entry) {
      entry.retries += 1;
      entry.lastError = error;
      this.saveToStorage();
      this.notifyListeners();

      // If exceeded max retries, drop it
      if (entry.retries >= MAX_RETRIES) {
        console.warn(`Dropping offline mutation after ${MAX_RETRIES} retries:`, entry);
        this.dequeue(id);
      }
    }
  }

  public getQueue(): OfflineMutation[] {
    return [...this.queue];
  }

  public getQueueSize(): number {
    return this.queue.length;
  }

  public subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    listener([...this.queue]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public clear(): void {
    this.queue = [];
    this.saveToStorage();
    this.notifyListeners();
  }

  private async drain(): Promise<void> {
    if (this.isDraining || this.queue.length === 0 || !this.isOnline) return;
    this.isDraining = true;

    try {
      while (this.queue.length > 0 && this.isOnline) {
        const batch = this.queue.slice(0, 5); // Process in small batches
        const results = await Promise.allSettled(
          batch.map((mutation) => this.processMutation(mutation)),
        );

        let processedCount = 0;
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const mutation = batch[i];
          if (result.status === "fulfilled") {
            this.dequeue(mutation.id);
            processedCount++;
          } else {
            const error = result.reason;
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.markFailed(mutation.id, errorMessage);
          }
        }

        // If all in batch failed, back off
        if (processedCount === 0) {
          break;
        }
      }
    } finally {
      this.isDraining = false;
    }
  }

  private async processMutation(mutation: OfflineMutation): Promise<void> {
    switch (mutation.type) {
      case "storage_set": {
        if (!mutation.key || mutation.value === undefined) {
          throw new Error("Invalid storage_set mutation");
        }
        // Use sharedStorage's setItem which handles upload
        const { sharedStorage } = await import("./sharedStorage");
        sharedStorage.setItem(mutation.key, mutation.value);
        break;
      }
      case "storage_remove": {
        if (!mutation.key) {
          throw new Error("Invalid storage_remove mutation");
        }
        const { sharedStorage } = await import("./sharedStorage");
        sharedStorage.removeItem(mutation.key);
        break;
      }
      case "api_call": {
        if (!mutation.path || !mutation.method) {
          throw new Error("Invalid api_call mutation");
        }
        const { apiRequest } = await import("./apiClient");
        await apiRequest(mutation.path, {
          method: mutation.method,
          body: mutation.body,
        });
        break;
      }
      default:
        throw new Error(`Unknown mutation type: ${(mutation as any).type}`);
    }
  }

  public async flushNow(): Promise<void> {
    await this.drain();
  }
}

export const offlineQueue = new OfflineQueue();