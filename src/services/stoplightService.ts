export type StoplightState = "red" | "green" | "off";

export type StoplightStatus = {
  configured: boolean;
  state: StoplightState | "unknown" | "conflict";
  relayReachable: boolean | null;
  lastError?: string;
  lastCommandAt?: string;
  verifiedAt?: string;
  updatedAt: string;
};

type StoplightListener = (status: StoplightStatus) => void;

class StoplightService {
  private status: StoplightStatus = {
    configured: false,
    state: "unknown",
    relayReachable: null,
    updatedAt: new Date().toISOString(),
  };
  private listeners = new Set<StoplightListener>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private requestInFlight: AbortController | null = null;
  private commandInFlight = false;
  private revision = 0;

  public getStatus(): StoplightStatus {
    return { ...this.status };
  }

  public subscribe(listener: StoplightListener): () => void {
    if (!this.listeners.size) this.markUnknown();
    this.listeners.add(listener);
    listener(this.getStatus());
    void this.refresh();
    if (!this.pollTimer) this.pollTimer = setInterval(() => void this.refresh(), 3000);
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size && this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    };
  }

  private markUnknown(lastError?: string) {
    this.status = { ...this.status, state: "unknown", relayReachable: null, verifiedAt: undefined, lastError };
    this.notify();
  }

  public async refresh() {
    if (this.requestInFlight || this.commandInFlight) return;
    const controller = new AbortController();
    const revision = this.revision;
    this.requestInFlight = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch("/api/stoplight/status", { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Server could not read the stoplight outputs");
      const next = await response.json() as StoplightStatus;
      if (revision !== this.revision) return;
      this.status = next;
      this.notify();
    } catch {
      if (revision === this.revision) this.markUnknown("Live stoplight feedback is unavailable. Check the physical lights before directing the driver.");
    } finally {
      clearTimeout(timeout);
      if (this.requestInFlight === controller) this.requestInFlight = null;
    }
  }

  /** Never illuminate a requested light until the server reads it back. */
  public async setState(state: StoplightState): Promise<StoplightStatus> {
    if (this.commandInFlight) throw new Error("A stoplight command is already in progress");
    this.commandInFlight = true;
    this.revision++;
    this.requestInFlight?.abort();
    this.requestInFlight = null;
    this.markUnknown();
    let failed = false;
    try {
      const response = await fetch("/api/stoplight/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null) as { statusMessage?: string } | null;
        throw new Error(detail?.statusMessage || "The stoplight relay did not respond");
      }
      this.status = await response.json() as StoplightStatus;
      this.notify();
      if (this.status.state !== state) {
        throw new Error(this.status.lastError || `The relay did not confirm ${state.toUpperCase()}. Check the manual switch.`);
      }
      return this.getStatus();
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      this.commandInFlight = false;
      if (failed) await this.refresh();
    }
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach((listener) => listener(status));
  }
}

export const stoplightService = new StoplightService();
