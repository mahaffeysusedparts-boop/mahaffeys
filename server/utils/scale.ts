import { access } from "node:fs/promises";
import { connect as netConnect, type Socket } from "node:net";
import { SerialPort } from "serialport";
import type { ScaleConfig } from "./scaleConfig";

export type ServerScaleStatus = {
  connected: boolean;
  connectionType: "serial" | "tcp";
  weight: number;
  unit: "LBS" | "KG";
  isStable: boolean;
  isZero: boolean;
  portName?: string;
  baudRate?: number;
  scanning: boolean;
  errorMessage?: string;
  updatedAt?: string;
};

export type ScaleDetection = {
  path: string;
  baudRate: number;
  sample: string;
};

export type TcpProbeResult = {
  reachable: boolean;
  sample: string | null;
  detail?: string;
};

const KNOWN_SERVER_PORTS = ["/dev/ttyS4", "/dev/ttyS5", "/dev/ttyS6", "/dev/ttyS7", "/dev/tty16"];
const DEFAULT_BAUD_RATES = [2400, 9600, 4800, 19200];

export async function listSerialPorts() {
  const listed = await SerialPort.list().catch(() => []);
  const paths = new Set(listed.map((port) => port.path));

  await Promise.all(KNOWN_SERVER_PORTS.map(async (path) => {
    try {
      await access(path);
      paths.add(path);
    } catch {
      // Port is not exposed to this server process.
    }
  }));

  return [...paths]
    .filter((path) => /^\/dev\/(tty16|ttyS\d+|ttyUSB\d+|ttyACM\d+|serial\/by-id\/.+)$/.test(path))
    .sort();
}

function detectScaleLine(buffer: string) {
  const lines = buffer.split(/[\r\n]+/);
  for (const line of lines) {
    const clean = line.trim();
    if (!clean || !/[-+]?\d+(?:\.\d+)?/.test(clean)) continue;
    const printable = [...clean].filter((character) => character >= " " && character <= "~").length;
    if (printable / clean.length >= 0.85) return clean.slice(0, 120);
  }
  return null;
}

async function probePort(path: string, baudRate: number, timeoutMs = 1400): Promise<string | null> {
  const port = new SerialPort({ path, baudRate, dataBits: 8, stopBits: 1, parity: "none", autoOpen: false });

  return new Promise((resolve) => {
    let complete = false;
    let buffer = "";
    let timer: ReturnType<typeof setTimeout>;

    const finish = (sample: string | null) => {
      if (complete) return;
      complete = true;
      clearTimeout(timer);
      port.removeAllListeners();
      if (port.isOpen) port.close(() => resolve(sample));
      else resolve(sample);
    };

    port.on("data", (chunk: Buffer) => {
      buffer = (buffer + chunk.toString("utf8")).slice(-2048);
      const sample = detectScaleLine(buffer);
      if (sample) finish(sample);
    });
    port.on("error", () => finish(null));
    timer = setTimeout(() => finish(null), timeoutMs);
    port.open((error) => {
      if (error) finish(null);
    });
  });
}

export async function probeTcpScale(host: string, port: number, timeoutMs = 2500): Promise<TcpProbeResult> {
  return new Promise((resolve) => {
    let complete = false;
    let buffer = "";
    let connected = false;
    const socket: Socket = netConnect({ host, port });

    const finish = (result: TcpProbeResult) => {
      if (complete) return;
      complete = true;
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.on("connect", () => {
      connected = true;
    });
    socket.on("data", (chunk: Buffer) => {
      buffer = (buffer + chunk.toString("utf8")).slice(-2048);
      const sample = detectScaleLine(buffer);
      if (sample) finish({ reachable: true, sample });
    });
    socket.on("timeout", () => {
      finish(connected
        ? { reachable: true, sample: null, detail: "Connected, but no weight data was received yet." }
        : { reachable: false, sample: null, detail: `Could not reach ${host}:${port} within ${timeoutMs / 1000}s.` });
    });
    socket.on("error", (error) => {
      finish({ reachable: false, sample: null, detail: error.message });
    });
    socket.on("close", () => {
      finish({ reachable: connected, sample: null, detail: connected ? undefined : `The connection to ${host}:${port} was refused.` });
    });
  });
}

class ServerScaleReader {
  private port: SerialPort | null = null;
  private socket: Socket | null = null;
  private starting = false;
  private scanning = false;
  private buffer = "";
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private options: ScaleConfig | null = null;
  private status: ServerScaleStatus = {
    connected: false,
    connectionType: "serial",
    weight: 0,
    unit: "LBS",
    isStable: false,
    isZero: true,
    baudRate: 2400,
    scanning: false,
  };

  async start(options: ScaleConfig) {
    if (this.scanning || this.starting) return;

    const sameSerial = this.port?.isOpen
      && this.options?.type === "serial" && options.type === "serial"
      && this.options.path === options.path && this.options.baudRate === options.baudRate;
    const sameTcp = this.socket && !this.socket.destroyed
      && this.options?.type === "tcp" && options.type === "tcp"
      && this.options.host === options.host && this.options.port === options.port;
    if (sameSerial || sameTcp) return;

    await this.stop();
    this.options = options;
    this.status.updatedAt = undefined;
    this.status.weight = 0;

    if (options.type === "tcp") {
      await this.startTcp(options);
      return;
    }

    this.starting = true;
    this.status.connectionType = "serial";
    this.status.baudRate = options.baudRate;
    try {
      const path = options.path || (await listSerialPorts())[0];
      if (!path) throw new Error("No serial scale port was found on the app server.");

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

  private async startTcp(options: Extract<ScaleConfig, { type: "tcp" }>) {
    this.starting = true;
    this.status.connectionType = "tcp";
    this.status.baudRate = undefined;
    this.status.portName = `TCP ${options.host}:${options.port}`;
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = netConnect({ host: options.host, port: options.port }, () => resolve());
        this.socket = socket;
        socket.on("data", (chunk: Buffer) => this.consume(chunk.toString("utf8")));
        socket.on("error", (error) => {
          this.handleDisconnect(`TCP scale error: ${error.message}`);
          reject(error);
        });
        socket.on("close", () => this.handleDisconnect(`The TCP scale connection to ${options.host}:${options.port} closed.`));
      });

      this.status.connected = true;
      this.status.errorMessage = undefined;
    } catch (error) {
      this.status.connected = false;
      this.status.errorMessage = error instanceof Error ? error.message : `Could not connect to the TCP scale at ${options.host}:${options.port}.`;
      this.scheduleRetry();
    } finally {
      this.starting = false;
    }
  }

  async scan(baudRates = DEFAULT_BAUD_RATES): Promise<ScaleDetection | null> {
    if (this.scanning) return null;
    const previousOptions = this.options;
    this.scanning = true;
    this.status.scanning = true;
    this.status.connected = false;
    this.status.errorMessage = undefined;
    await this.stop();

    try {
      const paths = await listSerialPorts();
      for (const baudRate of baudRates) {
        for (const path of paths) {
          const sample = await probePort(path, baudRate);
          if (!sample) continue;
          const detection = { path, baudRate, sample };
          this.options = { type: "serial", path, baudRate };
          return detection;
        }
      }
      this.status.errorMessage = "No valid scale weight data was detected on the available serial ports. For an Ethernet indicator, switch the connection type to TCP Network.";
      return null;
    } finally {
      this.scanning = false;
      this.status.scanning = false;
      const selected = this.options ?? previousOptions;
      if (selected) await this.start(selected);
    }
  }

  async stop() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    const port = this.port;
    this.port = null;
    if (port) {
      port.removeAllListeners();
      if (port.isOpen) {
        await new Promise<void>((resolve) => port.close(() => resolve()));
      }
    }

    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.removeAllListeners();
      socket.destroy();
    }
  }

  getStatus(): ServerScaleStatus {
    return { ...this.status, scanning: this.scanning };
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
    this.socket = null;
    this.scheduleRetry();
  }

  private scheduleRetry() {
    if (this.retryTimer || this.scanning) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.options) void this.start(this.options);
    }, 5000);
  }
}

export const serverScale = new ServerScaleReader();
