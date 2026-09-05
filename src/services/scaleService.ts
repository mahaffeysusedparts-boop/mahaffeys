import { ScaleStatus, WeightUnit } from '@/types/scrap';
import { diagnosticLogger } from './diagnosticLogger';

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
    this.connectServer();
    this.startWatchdog();
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
      const response = await fetch('/api/scale/status', { cache: 'no-store' });
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

      // Apply noise filtering to weight readings
      const filteredWeight = this.applyNoiseFilter(serverStatus.weight);
      this.updateWeights(filteredWeight);
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

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach((listener) => listener(status));
  }
}

export const scaleService = new ScaleService();