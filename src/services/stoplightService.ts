export type StoplightState = "red" | "green" | "off";

export type StoplightStatus = {
  configured: boolean;
  state: StoplightState;
  /** true/false after the first command attempt; null = never tried */
  relayReachable: boolean | null;
  lastError?: string;
  lastCommandAt?: string;
  updatedAt: string;
};

type StoplightListener = (status: StoplightStatus) => void;

class StoplightService {
  private status: StoplightStatus = {
    configured: false,
    state: "off",
    relayReachable: null,
    updatedAt: new Date().toISOString(),
  };

  private listeners = new Set<StoplightListener>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private requestInFlight = false;
  private commandInFlight = false;

  public getStatus(): StoplightStatus {
    return { ...this.status };
  }

  public subscribe(listener: StoplightListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    void this.refresh();
    this.ensurePolling();
    return () => this.listeners.delete(listener);
  }

  private ensurePolling() {
    if (!this.pollTimer) {
      this.pollTimer = setInterval(() => void this.refresh(), 3000);
    }
  }

  public async refresh() {
    if (this.requestInFlight) return;
    this.requestInFlight = true;
    try {
      const response = await fetch("/api/stoplight/status", { cache: "no-store" });
      if (!response.ok) return;
      const next = await response.json() as StoplightStatus;
      if (this.commandInFlight) return;
      this.status = next;
      this.notify();
    } catch {
      // The desk panel keeps showing the last known state; commands surface errors.
    } finally {
      this.requestInFlight = false;
    }
  }

  /** Switches the physical stoplight. Resolves with the server-confirmed state. */
  public async setState(state: StoplightState): Promise<StoplightStatus> {
    this.commandInFlight = true;
    this.status = { ...this.status, state };
    this.notify();
    try {
      const response = await fetch("/api/stoplight/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null) as { statusMessage?: string } | null;
        throw new Error(detail?.statusMessage || "The stoplight relay did not respond");
      }
      this.status = await response.json() as StoplightStatus;
      this.notify();
      return this.getStatus();
    } finally {
      this.commandInFlight = false;
    }
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach((listener) => listener(status));
  }
}

export const stoplightService = new StoplightService();
