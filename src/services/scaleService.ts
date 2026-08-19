import { ScaleStatus, WeightUnit } from '@/types/scrap';

type ScaleListener = (status: ScaleStatus) => void;

type ServerScaleStatus = {
  connected: boolean;
  weight: number;
  unit: WeightUnit;
  isStable: boolean;
  isZero: boolean;
  portName?: string;
  baudRate: number;
  errorMessage?: string;
};

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

  constructor() {
    this.connectServer();
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

  private async pollServer() {
    if (this.requestInFlight) return;
    this.requestInFlight = true;

    try {
      const response = await fetch('/api/scale/status', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Scale server returned ${response.status}`);
      const serverStatus = await response.json() as ServerScaleStatus;

      this.status.connected = serverStatus.connected;
      this.status.isStable = serverStatus.isStable;
      this.status.isZero = serverStatus.isZero;
      this.status.portName = serverStatus.portName
        ? `${serverStatus.portName} @ ${serverStatus.baudRate} baud`
        : undefined;
      this.status.errorMessage = serverStatus.errorMessage;
      this.status.unit = serverStatus.unit;
      this.updateWeights(serverStatus.weight);
    } catch (error) {
      this.status.connected = false;
      this.status.errorMessage = error instanceof Error
        ? error.message
        : 'Could not reach the scale service on the app server.';
      this.notify();
    } finally {
      this.requestInFlight = false;
    }
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
