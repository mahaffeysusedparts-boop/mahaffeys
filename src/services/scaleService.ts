import { ScaleConfig, ScaleRegistryEntry, ScaleStatus, ScaleWeightEvent, WeightUnit, YardSettings } from '@/types/scrap';
import { diagnosticLogger } from './diagnosticLogger';
import { storageService } from './storageService';

type ScaleListener = (status: ScaleStatus) => void;

type ServerScaleStatus = {
  connected: boolean;
  connectionType: 'serial' | 'tcp';
  weight: number;
  unit: WeightUnit;
  isStable: boolean;
  isZero: boolean;
  portName?: string;
  baudRate?: number;
  errorMessage?: string;
  /** All-scales registry snapshot (one entry per platform the server has seen). */
  registry?: ScaleRegistryEntry[];
};

// Circuit breaker states
type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreaker {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureTime: number;
  cooldownMs: number;
  maxFailures: number;
}

class ScaleService {
  private status: ScaleStatus = {
    weight: 0,
    unit: 'LBS',
    isStable: false,
    isZero: true,
    tareWeight: 0,
    grossWeight: 0,
    netWeight: 0,
    mode: 'SERVER',
    connected: false,
  };

  private scales: ScaleConfig[] = [];
  private currentScaleId: string | null = null;

  // Per-scale tare/zero snapshots (stored in LBS) so platform A's tare never
  // leaks onto platform B's NET readings.
  private tareByScale = new Map<string, number>();

  // Weight Activity Journal — last settled platform reading (LBS). A new
  // event is emitted when a stable reading crosses the configured threshold.
  private baselineGrossLbs: number | null = null;

  // All-scales registry mirrored from the server poll for the Scale Wall.
  private registry: ScaleRegistryEntry[] = [];

  private listeners = new Set<ScaleListener>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private requestInFlight = false;
  private circuitBreaker: CircuitBreaker = {
    state: 'CLOSED',
    failureCount: 0,
    lastFailureTime: 0,
    cooldownMs: 1000,
    maxFailures: 5,
  };
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdogTimeoutMs = 10000; // 10 seconds
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 15;
  private baseReconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _isManualMode = false;
  private lastSuccessfulWeight = 0;
  private noiseFilterWindow: number[] = [];
  private readonly NOISE_WINDOW_SIZE = 5;
  private readonly NOISE_THRESHOLD = 0.5;

  constructor() {
    this.loadScales();
    this.startWatchdog();
    // Start polling immediately — the Navbar HUD and journal depend on it even
    // before any scale-aware UI subscribes.
    this.connectServer();
  }

  private loadScales() {
    const settings = storageService.getSettings() as YardSettings & { currentScaleId?: string | null };
    this.scales = settings.scales || [];
    // Legacy installs carry no currentScaleId field: adopt the default (or
    // first) platform once. An explicit "No Scale" (null) is respected.
    if (settings.currentScaleId === undefined && this.scales.length > 0) {
      this.currentScaleId = (this.scales.find((s) => s.isDefault) ?? this.scales[0]).id;
      this.persistCurrentScale();
    } else {
      this.currentScaleId = settings.currentScaleId ?? null;
    }
    const scale = this.scales.find((s) => s.id === this.currentScaleId);
    this.status.mode = scale ? scale.connectionType : 'SERVER';
  }

  private persistCurrentScale() {
    const settings = storageService.getSettings();
    settings.currentScaleId = this.currentScaleId;
    settings.scales = this.scales;
    storageService.saveSettings(settings);
  }

  public getScales(): ScaleConfig[] {
    return [...this.scales];
  }

  public getCurrentScaleId(): string | null {
    return this.currentScaleId;
  }

  public getCurrentScale(): ScaleConfig | null {
    return this.scales.find((s) => s.id === this.currentScaleId) ?? null;
  }

  public setCurrentScale(id: string | null) {
    // Snapshot the outgoing platform's tare (normalized to LBS) so returning
    // to it later restores exactly what the operator left.
    if (this.currentScaleId && this.status.tareWeight > 0) {
      this.tareByScale.set(this.currentScaleId, this.toLbs(this.status.tareWeight, this.status.unit));
    } else if (this.currentScaleId) {
      this.tareByScale.delete(this.currentScaleId);
    }

    this.currentScaleId = id ?? null;
    const scale = this.scales.find((s) => s.id === this.currentScaleId);
    if (scale) {
      this.status.mode = scale.connectionType;
    } else {
      this.status.mode = 'SERVER';
    }

    // Restore the incoming platform's own tare (default 0) — never the
    // previous platform's value.
    const tareLbs = scale ? this.tareByScale.get(scale.id) : undefined;
    this.status.tareWeight = tareLbs != null
      ? this.fromLbs(tareLbs, this.status.unit)
      : 0;

    // Cross-platform deltas must never emit phantom journal events.
    this.baselineGrossLbs = null;

    this.persistCurrentScale();
    this.updateWeights(this.status.grossWeight);
    this.notify();
    // Trigger an immediate poll for the new scale
    void this.pollServer();
  }

  /** Re-reads scale configuration from storage (cross-workstation sync). */
  public reloadScales() {
    this.loadScales();
    if (this.currentScaleId && !this.scales.some((s) => s.id === this.currentScaleId)) {
      // The active platform was deleted on another workstation.
      this.currentScaleId = null;
      this.status.tareWeight = 0;
      this.status.mode = 'SERVER';
    }
    this.notify();
  }

  /**
   * Probes /api/scale/status with a platform's own parameters WITHOUT
   * switching the active scale. Used by the Settings "Test" button.
   */
  public async testScale(id: string): Promise<{ ok: boolean; message: string }> {
    const scale = this.scales.find((s) => s.id === id);
    if (!scale) return { ok: false, message: 'Scale not found — it may have been deleted' };
    const params = this.buildScaleParams(scale);
    try {
      const startedAt = Date.now();
      const response = await fetch(`/api/scale/status?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) {
        return { ok: false, message: `Scale host returned HTTP ${response.status}` };
      }
      const data = await response.json() as ServerScaleStatus;
      if (!data.connected) {
        return { ok: false, message: data.errorMessage || 'Host reached, but the platform is not reporting' };
      }
      const ms = Date.now() - startedAt;
      const via = data.portName
        ? `${data.portName}${data.baudRate ? ` @ ${data.baudRate} baud` : ''}`
        : scale.connectionType.replace('_', ' ');
      return {
        ok: true,
        message: `Connected via ${via} · reading ${Math.round(data.weight).toLocaleString()} ${data.unit} · ${ms} ms`,
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Could not reach the scale host' };
    }
  }

  /**
   * All-scales snapshot for the Scale Wall — every configured platform with
   * its last known live status, regardless of which one is active.
   */
  public getAllScaleStatuses(): ScaleRegistryEntry[] {
    const byId = new Map(this.registry.map((entry) => [entry.scaleId, entry]));
    return this.scales.map((scale) => {
      const live = byId.get(scale.id);
      // Local config is always the freshest source of name/location.
      return live
        ? { ...live, name: scale.name, location: scale.location }
        : {
            scaleId: scale.id,
            name: scale.name,
            location: scale.location,
            connectionType: scale.connectionType,
            connected: false,
            weight: 0,
            unit: 'LBS' as WeightUnit,
            isStable: false,
          };
    });
  }

  public connectScale(id: string) {
    this.setCurrentScale(id);
  }

  public addScale(scale: Omit<ScaleConfig, 'id'>): ScaleConfig {
    const newScale: ScaleConfig = {
      ...scale,
      id: `scale-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    this.scales = [...this.scales, newScale];
    this.persistCurrentScale();
    return newScale;
  }

  public updateScale(id: string, updates: Partial<Omit<ScaleConfig, 'id'>>): void {
    this.scales = this.scales.map((s) =>
      s.id === id ? { ...s, ...updates } : s,
    );
    this.persistCurrentScale();
    this.notify();
  }

  public deleteScale(id: string): void {
    this.scales = this.scales.filter((s) => s.id !== id);
    this.tareByScale.delete(id);
    if (this.currentScaleId === id) {
      this.currentScaleId = null;
      this.status.mode = 'SERVER';
      this.status.tareWeight = 0;
      this.baselineGrossLbs = null;
    }
    this.persistCurrentScale();
    this.notify();
  }

  public getStatus(): ScaleStatus {
    return { ...this.status };
  }

  public subscribe(listener: ScaleListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    this.connectServer();
    return () => this.listeners.delete(listener);
  }

  public connectServer() {
    void this.pollServer();
    if (!this.pollTimer) {
      this.pollTimer = setInterval(() => void this.pollServer(), 500);
    }
  }

  public setZero() {
    this.status.tareWeight = this.status.grossWeight;
    this.updateWeights(this.status.grossWeight);
  }

  public setTare() {
    this.status.tareWeight = this.status.grossWeight;
    this.updateWeights(this.status.grossWeight);
  }

  public clearTare() {
    this.status.tareWeight = 0;
    this.updateWeights(this.status.grossWeight);
  }

  public setUnit(unit: WeightUnit) {
    if (this.status.unit === unit) return;
    const factor = unit === 'KG' ? 0.45359237 : 2.20462262;
    this.status.grossWeight = this.status.grossWeight * factor;
    this.status.tareWeight = this.status.tareWeight * factor;
    this.status.unit = unit;
    this.updateWeights(this.status.grossWeight);
  }

  public isManualMode(): boolean {
      return this._isManualMode;
    }

  public getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  public getCircuitBreakerState(): CircuitBreakerState {
    return this.circuitBreaker.state;
  }

  // Manual entry mode - allows operators to enter weight manually when hardware is disconnected
    public setManualWeight(weight: number): void {
      this._isManualMode = true;
      this.lastSuccessfulWeight = weight;
      this.status.weight = weight;
      this.status.connected = false;
      this.updateWeights(weight);
      this.notify();
    }
  
    public clearManualMode(): void {
      this._isManualMode = false;
      this.connectServer();
    }

  private async pollServer() {
    if (this.requestInFlight) return;

    // Check circuit breaker
    if (this.circuitBreaker.state === 'OPEN') {
      const timeSinceFailure = Date.now() - this.circuitBreaker.lastFailureTime;
      if (timeSinceFailure < this.circuitBreaker.cooldownMs) {
        // Still in cooldown - schedule retry
        return;
      }
      // Cooldown expired - try half-open
      this.circuitBreaker.state = 'HALF_OPEN';
    }

    this.requestInFlight = true;

    try {
      const currentScale = this.getCurrentScale();
      const params = currentScale ? this.buildScaleParams(currentScale) : new URLSearchParams();

      const response = await fetch(`/api/scale/status?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Scale server returned ${response.status}`);
      const serverStatus = await response.json() as ServerScaleStatus;

      // Success - reset circuit breaker
      this.circuitBreaker = {
        ...this.circuitBreaker,
        state: 'CLOSED',
        failureCount: 0,
        cooldownMs: 1000,
      };
      this.reconnectAttempts = 0;
            this._isManualMode = false;

      this.status.connected = serverStatus.connected;
      this.status.isStable = serverStatus.isStable;
      this.status.isZero = serverStatus.isZero;
      this.status.portName = serverStatus.portName && serverStatus.baudRate
        ? `${serverStatus.portName} @ ${serverStatus.baudRate} baud`
        : serverStatus.portName;
      this.status.errorMessage = serverStatus.errorMessage;
      this.status.unit = serverStatus.unit;
      if (serverStatus.registry) {
        this.registry = serverStatus.registry;
      }

      // Apply noise filtering to weight readings
      const filteredWeight = this.applyNoiseFilter(serverStatus.weight);
      this.updateWeights(filteredWeight);

      // Weight Activity Journal — evaluate the settled reading against the
      // baseline so one truck-on/truck-off cycle yields exactly one event.
      this.evaluateJournalEvent(
        this.toLbs(filteredWeight, serverStatus.unit),
        serverStatus.isStable,
        serverStatus.connected,
      );
    } catch (error) {
      this.handleFailure(error);
    } finally {
      this.requestInFlight = false;
    }
  }

  private handleFailure(error: unknown): void {
    const now = Date.now();
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Update circuit breaker
    this.circuitBreaker.failureCount += 1;
    this.circuitBreaker.lastFailureTime = now;

    if (this.circuitBreaker.failureCount >= this.circuitBreaker.maxFailures) {
      this.circuitBreaker.state = 'OPEN';
      this.circuitBreaker.cooldownMs = Math.min(
        this.circuitBreaker.cooldownMs * 2,
        60000
      );
      this.scheduleReconnect();
    }

    this.status.connected = false;
    this.status.errorMessage = message;

    // If we have a recent weight, keep showing it with manual mode indicator
    if (this.lastSuccessfulWeight > 0) {
          this._isManualMode = true;
        }

    this.notify();
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // Max reconnects reached - stay in manual mode
      diagnosticLogger.warn("ScaleService", "Max reconnect attempts reached, staying in manual mode");
      return;
    }

    // Exponential backoff with jitter
    const baseDelay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    const jitter = Math.random() * baseDelay * 0.3; // ±30% jitter
    const delay = baseDelay + jitter;

    this.reconnectAttempts += 1;

    diagnosticLogger.hardware("ScaleService", `Scheduling reconnect attempt ${this.reconnectAttempts} in ${Math.round(delay)}ms`, {
      attempt: this.reconnectAttempts,
      delay,
      circuitBreakerState: this.circuitBreaker.state,
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.pollServer();
      if (!this.status.connected) {
        this.scheduleReconnect();
      }
    }, delay);
  }

  private startWatchdog(): void {
    this.watchdogTimer = setInterval(() => {
      // If no successful poll in watchdogTimeoutMs, trigger reconnect
      if (this.circuitBreaker.state === 'OPEN' && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    }, this.watchdogTimeoutMs);
  }

  private applyNoiseFilter(rawWeight: number): number {
    // Add to sliding window
    this.noiseFilterWindow.push(rawWeight);
    if (this.noiseFilterWindow.length > this.NOISE_WINDOW_SIZE) {
      this.noiseFilterWindow.shift();
    }

    // If window is full, check for noise
    if (this.noiseFilterWindow.length === this.NOISE_WINDOW_SIZE) {
      const variance = this.calculateVariance(this.noiseFilterWindow);
      if (variance > this.NOISE_THRESHOLD) {
        // Use median instead of raw value to filter noise
        const sorted = [...this.noiseFilterWindow].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        this.lastSuccessfulWeight = median;
        return median;
      }
    }

    this.lastSuccessfulWeight = rawWeight;
    return rawWeight;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  }

  private updateWeights(gross: number) {
    this.status.grossWeight = gross;
    this.status.netWeight = Math.max(0, gross - this.status.tareWeight);
    this.status.weight = this.status.netWeight;
    this.status.isZero = Math.abs(gross) <= 0.2;
    this.notify();
  }

  private buildScaleParams(scale: ScaleConfig): URLSearchParams {
    const params = new URLSearchParams();
    params.set('scaleId', scale.id);
    params.set('connectionType', scale.connectionType);
    params.set('name', scale.name);
    if (scale.location) params.set('location', scale.location);
    if (scale.portName) params.set('portName', scale.portName);
    if (scale.baudRate) params.set('baudRate', String(scale.baudRate));
    if (scale.webSocketUrl) params.set('webSocketUrl', scale.webSocketUrl);
    return params;
  }

  private toLbs(weight: number, unit: WeightUnit): number {
    return unit === 'KG' ? weight * 2.20462262 : weight;
  }

  private fromLbs(weightLbs: number, unit: WeightUnit): number {
    return unit === 'KG' ? weightLbs * 0.45359237 : weightLbs;
  }

  /**
   * Weight Activity Journal detection. The poll loop runs at 500 ms with a
   * noise filter; this method only acts on STABLE readings whose delta from
   * the last settled baseline crosses the configured threshold — so a truck
   * rolling on emits one ADDED event, and dumping/rolling off emits one
   * REMOVED event, instead of a stream of poll ticks.
   */
  private evaluateJournalEvent(grossLbs: number, isStable: boolean, connected: boolean) {
    if (!connected || !isStable) return;

    const settings = storageService.getSettings();
    if (settings.scaleEventLoggingEnabled === false) {
      this.baselineGrossLbs = grossLbs; // keep tracking silently while paused
      return;
    }
    const thresholdLbs = settings.scaleEventThresholdLbs && settings.scaleEventThresholdLbs > 0
      ? settings.scaleEventThresholdLbs
      : 20;

    if (this.baselineGrossLbs === null) {
      this.baselineGrossLbs = grossLbs;
      return;
    }

    const delta = grossLbs - this.baselineGrossLbs;
    if (Math.abs(delta) < thresholdLbs) {
      // Silently re-baseline idle near-zero readings so sub-threshold drift
      // can never accumulate into a phantom event later.
      if (Math.abs(grossLbs) < thresholdLbs) {
        this.baselineGrossLbs = grossLbs;
      }
      return;
    }

    const event: ScaleWeightEvent = {
      id: `swe-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      scaleId: this.currentScaleId,
      scaleName: this.getCurrentScale()?.name ?? 'Unconfigured Scale',
      direction: delta > 0 ? 'ADDED' : 'REMOVED',
      deltaLbs: Math.round(Math.abs(delta)),
      grossAfterLbs: Math.round(grossLbs),
      detectedAt: new Date().toISOString(),
    };
    storageService.addScaleEvent(event);
    this.baselineGrossLbs = grossLbs;
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach((listener) => listener(status));
  }
}

export const scaleService = new ScaleService();