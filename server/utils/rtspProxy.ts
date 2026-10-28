import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { query } from "./db";
import { mjpegFrames } from "./mjpegFrames";
import { cameraErrorDetails } from "./cameraErrorDetails";

// The production image installs FFmpeg; do not bundle ffmpeg-static's CommonJS loader.
const FFMPEG_BIN: string = process.env.NODE_ENV === "production"
  ? "ffmpeg"
  : createRequire(import.meta.url)("ffmpeg-static") || "ffmpeg";

/** Guard rail: every open browser tile keeps one ffmpeg process alive. */
const MAX_CONCURRENT_STREAMS = 12;
const FRAME_TIMEOUT_MS = 12_000;
const RESTREAM_START_TIMEOUT_MS = 15_000;

const activeStreams = new Set<ChildProcess>();

export interface RtspCapableCamera {
  rtspUrl?: string;
  streamUrl?: string;
  username?: string;
  password?: string;
}

export interface StoredIpCamera extends RtspCapableCamera {
  id: string;
  ipAddress: string;
  port?: number;
  snapshotUrl?: string;
  cameraType: string;
  assignment: string;
  isActive: boolean;
}

/** Last meaningful stderr line — ffmpeg errors worth showing an operator. */
function compactFfmpegError(stderr: string): string {
  const lines = stderr.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines[lines.length - 1] ?? "";
}

/** Embeds basic-auth credentials into a raw rtsp:// URL when not already present. */
export function embedRtspCredentials(rawUrl: string, username?: string, password?: string): string {
  const url = new URL(rawUrl);
  if (!url.username && username) {
    url.username = encodeURIComponent(username);
    if (password) url.password = encodeURIComponent(password);
  }
  return url.toString();
}

/** Resolves the fully-qualified rtsp:// source for a synced camera record (null when not an RTSP cam). */
export function resolveRtspSource(camera: RtspCapableCamera): string | null {
  const raw = (camera.rtspUrl ?? "").trim() || (camera.streamUrl ?? "").trim();
  if (!raw.toLowerCase().startsWith("rtsp://")) return null;
  try {
    return embedRtspCredentials(raw, camera.username, camera.password);
  } catch {
    return null;
  }
}

/** Loads one active camera from the workstation-synced state store. */
export async function loadCameraById(id: string | undefined): Promise<StoredIpCamera> {
  if (!id) throw new Error("Camera id is required");
  const result = await query<{ value: unknown }>(
    "SELECT value FROM app_state WHERE key = 'mahaffeys_ip_cameras'",
  );
  const cameras = Array.isArray(result.rows[0]?.value)
    ? (result.rows[0]!.value as StoredIpCamera[])
    : [];
  const camera = cameras.find((item) => item.id === id && item.isActive !== false);
  if (!camera) throw new Error("Camera not found or is paused");
  return camera;
}

/** Grabs a single JPEG frame from an RTSP source (used for snapshots & connection tests). */
export async function grabRtspFrame(source: string, timeoutMs: number = FRAME_TIMEOUT_MS): Promise<Buffer> {
  const child = spawn(FFMPEG_BIN, [
    "-hide_banner", "-loglevel", "error",
    "-rtsp_transport", "tcp",
    "-i", source,
    "-frames:v", "1",
    "-f", "mjpeg",
    "-",
  ], { stdio: ["ignore", "pipe", "pipe"] });

  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      finish(() => {
        child.kill("SIGKILL");
        reject(new Error(`Camera did not produce a frame within ${Math.round(timeoutMs / 1000)}s — check the RTSP path, port and credentials`));
      });
    }, timeoutMs);

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    let byteSize = 0;
    child.stdout?.on("data", (chunk: Buffer) => {
      if (settled) return;
      byteSize += chunk.length;
      if (byteSize > 8 * 1024 * 1024) finish(() => {
        child.kill("SIGKILL");
        reject(new Error('Camera snapshot exceeded the size limit'));
      });
      else chunks.push(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString("latin1")).slice(-800); });
    child.on("error", (err) =>
      finish(() => reject(new Error(`ffmpeg failed to start on the server: ${err.message}`))));
    child.on("close", (code) =>
      finish(() => {
        const frame = Buffer.concat(chunks);
        if (code === 0 && frame.byteLength > 0) {
          resolve(frame);
        } else {
          reject(new Error(compactFfmpegError(stderr) || `ffmpeg exited with code ${code}`));
        }
      }));
  });
}

/** Restream complete JPEG frames with explicit multipart framing and bounded buffering. */
export async function startRtspMjpegRestream(
  source: string,
  options: { fps?: number; width?: number; signal?: AbortSignal } = {},
): Promise<Response> {
  if (options.signal?.aborted) throw new Error("Camera view canceled");
  if (activeStreams.size >= MAX_CONCURRENT_STREAMS) {
    throw new Error(`Too many live RTSP views are already open (limit ${MAX_CONCURRENT_STREAMS}) — close a few camera tiles and retry`);
  }

  const fps = options.fps ?? 6;
  const width = options.width ?? 800;
  const child = spawn(FFMPEG_BIN, [
    "-hide_banner", "-loglevel", "error",
    "-rtsp_transport", "tcp",
    "-threads", "1",
    "-i", source,
    "-map", "0:v:0", "-an", "-sn", "-dn",
    "-vf", `fps=${fps},scale=${width}:-2`,
    "-c:v", "mjpeg", "-pix_fmt", "yuvj420p", "-threads:v", "1",
    "-q:v", "7", "-flush_packets", "1",
    "-f", "mjpeg", "pipe:1",
  ], { stdio: ["ignore", "pipe", "pipe"] });

  activeStreams.add(child);
  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString("latin1")).slice(-1600); });
  // Classify failures without returning FFmpeg command lines, source URLs or credentials.
  const failureMessage = () => {
    if (/401|unauthorized|authorization failed/i.test(stderr)) return "Camera rejected live-view credentials";
    if (/404|not found/i.test(stderr)) return "Camera RTSP stream path was not found";
    if (/connection refused|no route|network is unreachable|timed out/i.test(stderr)) return "Server could not reach the camera RTSP feed";
    if (/encoder|pixel format|filter|resource temporarily unavailable/i.test(stderr)) return "Server could not encode the camera's live frames";
    return "Camera stopped before delivering a complete live frame";
  };
  let rejectFailure: (error: Error) => void = () => {};
  const failed = new Promise<never>((_resolve, reject) => { rejectFailure = reject; });
  const stop = () => {
    options.signal?.removeEventListener("abort", abort);
    activeStreams.delete(child);
    child.kill("SIGKILL");
  };
  const abort = () => {
    rejectFailure(new Error("Camera view canceled"));
    stop();
  };
  child.once("close", () => {
    activeStreams.delete(child);
    options.signal?.removeEventListener("abort", abort);
  });
  child.once("error", () => rejectFailure(new Error("FFmpeg could not start on the server")));
  options.signal?.addEventListener("abort", abort, { once: true });

  if (!child.stdout) {
    stop();
    throw new Error("FFmpeg produced no output stream");
  }
  const frames = mjpegFrames(child.stdout);
  const nextFrame = async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Camera did not deliver a complete live frame within 15 seconds")), RESTREAM_START_TIMEOUT_MS);
      });
      return await Promise.race([frames.next(), failed, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const logFailure = (stage: "startup" | "live") => {
    if (options.signal?.aborted) return;
    console.warn("[camera-rtsp]", JSON.stringify({ stage, exitCode: child.exitCode, signal: child.signalCode, detail: cameraErrorDetails(stderr, source) }));
  };
  let first: IteratorResult<Buffer>;
  try {
    first = await nextFrame();
    if (first.done) throw new Error(failureMessage());
  } catch (error) {
    logFailure("startup");
    stop();
    throw error;
  }

  const boundary = "mahaffeys-frame";
  const multipartFrame = (frame: Buffer) => new Uint8Array(Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`),
    frame,
    Buffer.from("\r\n"),
  ]));
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(multipartFrame(first.value));
    },
    async pull(controller) {
      try {
        const next = await nextFrame();
        if (next.done) {
          logFailure("live");
          controller.close();
          stop();
        } else {
          controller.enqueue(multipartFrame(next.value));
        }
      } catch {
        logFailure("live");
        controller.error(new Error("Camera live stream disconnected"));
        stop();
      }
    },
    cancel() {
      stop();
      void frames.return(undefined).catch(() => {});
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": `multipart/x-mixed-replace; boundary=${boundary}`,
      "Cache-Control": "no-store, private",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
