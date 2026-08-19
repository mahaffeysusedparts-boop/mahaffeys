import { SerialPort } from "serialport";

export type ServerScaleStatus = {
  connected: boolean;
  weight: number;
  unit: "LBS" | "KG";
  isStable: boolean;
  isZero: boolean;
  portName?: string;
  baudRate: number;
  errorMessage?: string;
  updatedAt?: string;
};

type ScaleOptions = {
  path?: string;
  baudRate: number;
};

class ServerScaleReader {
  private port: SerialPort | null = null;
  private starting = false;
  private buffer = "";
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private options: ScaleOptions = { baudRate: 2400 };
  private status: ServerScaleStatus = {
    connected: false,
    weight: 0,
    unit: "LBS",
    isStable: false,
    isZero: true,
    baudRate: 2400,
  };

  async start(options: ScaleOptions) {
    this.options = options;
    this.status.baudRate = options.baudRate;
    if (this.port?.isOpen || this.starting) return;

    this.starting = true;
    try {
      const path = options.path || (await this.findScalePort());
      if (!path) {
        throw new Error("No USB/serial scale port was found on the app server.");
      }

      this.status.portName = path;
      const port = new SerialPort({
        path,
        baudRate: options.baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        autoOpen: false,
      });
      this.port = port;

      port.on("data", (chunk: Buffer) => this.consume(chunk.toString("utf8")));
      port.on("error", (error) => this.handleDisconnect(error.message));
      port.on("close", () => this.handleDisconnect("The scale serial port closed."));

      await new Promise<void>((resolve, reject) => {
        port.open((error) => (error ? reject(error) : resolve()));
      });

      this.status.connected = true;
      this.status.errorMessage = undefined;
    } catch (error) {
      this.status.connected = false;
      this.status.errorMessage = error instanceof Error ? error.message : "Could not open the scale serial port.";
      this.scheduleRetry();
    } finally {
      this.starting = false;
    }
  }

  getStatus(): ServerScaleStatus {
    return { ...this.status };
  }

  private async findScalePort() {
    const ports = await SerialPort.list();
    const preferred = ports.find((port) =>
      /tty(USB|ACM)|cu\.usb|COM\d+/i.test(port.path),
    );
    return preferred?.path;
  }

  private consume(chunk: string) {
    this.buffer += chunk;
    const lines = this.buffer.split(/[\r\n]+/);
    this.buffer = lines.pop() || "";
    lines.forEach((line) => this.parse(line));
  }

  private parse(raw: string) {
    const clean = raw.trim().toUpperCase();
    if (!clean) return;

    const numberMatch = clean.match(/[-+]?\d+(?:\.\d+)?/);
    if (!numberMatch) return;

    const weight = Number(numberMatch[0]);
    if (!Number.isFinite(weight)) return;

    this.status.weight = weight;
    this.status.unit = clean.includes("KG") ? "KG" : "LBS";
    this.status.isStable = !clean.includes("US") && !clean.includes("MOTION");
    this.status.isZero = Math.abs(weight) <= 0.2;
    this.status.connected = true;
    this.status.errorMessage = undefined;
    this.status.updatedAt = new Date().toISOString();
  }

  private handleDisconnect(message: string) {
    this.status.connected = false;
    this.status.errorMessage = message;
    this.port = null;
    this.scheduleRetry();
  }

  private scheduleRetry() {
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.start(this.options);
    }, 5000);
  }
}

export const serverScale = new ServerScaleReader();
