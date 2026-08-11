import { ScaleStatus, ScaleConnectionMode, WeightUnit } from '@/types/scrap';

type ScaleListener = (status: ScaleStatus) => void;

class ScaleService {
  private status: ScaleStatus = {
    weight: 0,
    unit: 'LBS',
    isStable: true,
    isZero: true,
    tareWeight: 0,
    grossWeight: 0,
    netWeight: 0,
    mode: 'WEB_SERIAL',
    connected: false,
  };

  private listeners: Set<ScaleListener> = new Set();
  private serialPort: any = null;
  private serialReader: any = null;
  private ws: WebSocket | null = null;

  constructor() {}

  public getStatus(): ScaleStatus {
    return { ...this.status };
  }

  public subscribe(listener: ScaleListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const statusCopy = this.getStatus();
    this.listeners.forEach((listener) => listener(statusCopy));
  }

  // --- Scale Commands ---
  public setZero() {
    this.status.grossWeight = 0;
    this.status.tareWeight = 0;
    this.updateWeights(0);
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
    if (unit === 'KG') {
      this.status.grossWeight = Math.round(this.status.grossWeight * 0.45359237);
      this.status.tareWeight = Math.round(this.status.tareWeight * 0.45359237);
    } else {
      this.status.grossWeight = Math.round(this.status.grossWeight * 2.20462);
      this.status.tareWeight = Math.round(this.status.tareWeight * 2.20462);
    }
    this.status.unit = unit;
    this.updateWeights(this.status.grossWeight);
  }

  private updateWeights(gross: number) {
    this.status.grossWeight = gross;
    this.status.netWeight = Math.max(0, this.status.grossWeight - this.status.tareWeight);
    this.status.weight = this.status.netWeight;
    this.status.isZero = this.status.grossWeight <= 0.2;
    this.notify();
  }

  // --- Web Serial API Driver ---
  public async connectWebSerial(baudRate = 9600): Promise<boolean> {
    if (!('serial' in navigator)) {
      this.status.errorMessage = 'Web Serial API is not supported in this browser. Use Chrome or Edge with USB scale.';
      this.notify();
      return false;
    }

    try {
      // Request serial port from browser
      this.serialPort = await (navigator as any).serial.requestPort();
      await this.serialPort.open({ baudRate });
      
      this.status.mode = 'WEB_SERIAL';
      this.status.connected = true;
      this.status.portName = 'USB/Serial Port';
      this.status.errorMessage = undefined;
      this.notify();

      this.readSerialStream();
      return true;
    } catch (err: any) {
      this.status.errorMessage = err.message || 'Failed to connect serial scale port.';
      this.notify();
      return false;
    }
  }

  private async readSerialStream() {
    if (!this.serialPort || !this.serialPort.readable) return;

    try {
      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = this.serialPort.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      this.serialReader = reader;

      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          this.parseScaleString(line);
        }
      }
    } catch (error: any) {
      console.warn('Serial reader disconnected:', error);
      this.status.connected = false;
      this.notify();
    }
  }

  // --- WebSocket Network Scale Driver ---
  public connectWebSocket(url: string): boolean {
    try {
      if (this.ws) this.ws.close();
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.status.mode = 'WEBSOCKET';
        this.status.connected = true;
        this.status.errorMessage = undefined;
        this.notify();
      };

      this.ws.onmessage = (event) => {
        this.parseScaleString(event.data);
      };

      this.ws.onerror = () => {
        this.status.errorMessage = `Failed to connect to scale endpoint at ${url}`;
        this.status.connected = false;
        this.notify();
      };

      this.ws.onclose = () => {
        this.status.connected = false;
        this.notify();
      };

      return true;
    } catch (err: any) {
      this.status.errorMessage = err.message;
      return false;
    }
  }

  public setMode(mode: ScaleConnectionMode) {
    this.status.mode = mode;
    this.notify();
  }

  // Parse industrial scale formats (e.g. "ST,GS,+00142.5LB", "142.5 lb", "US,GS,1020.0KG")
  private parseScaleString(raw: string) {
    if (!raw) return;
    const clean = raw.trim().toUpperCase();

    // Check stability indicator
    if (clean.includes('ST') || clean.includes('STABLE')) {
      this.status.isStable = true;
    } else if (clean.includes('US') || clean.includes('MOTION')) {
      this.status.isStable = false;
    }

    // Extract numbers
    const numMatch = clean.match(/[-+]?\d*\.?\d+/);
    if (numMatch) {
      const parsed = parseFloat(numMatch[0]);
      if (!isNaN(parsed)) {
        this.updateWeights(parsed);
      }
    }
  }
}

export const scaleService = new ScaleService();