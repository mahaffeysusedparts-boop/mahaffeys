import { spawn, type ChildProcess } from "node:child_process";
import ffmpegStatic from "ffmpeg-static";
import { query } from "./db";

const FFMPEG_BIN: string = (ffmpegStatic as unknown as string) || "ffmpeg";

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

    child.stdout?.on("data", (chunk: Buffer) => chunks.push(chunk));
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

/**
 * Restreams an RTSP camera to the browser as multipart/x-mixed-replace MJPEG
 * (what an <img> tag renders as live video). The first frame is awaited so a
 * bad path/credential fails fast with ffmpeg's actual error, and the multipart
 * boundary is sniffed from the stream so the Content-Type header always matches.
 * The ffmpeg child is killed when the browser cancels the request.
 */
export async function startRtspMjpegRestream(
  source: string,
  options: { fps?: number; width?: number } = {},
): Promise<Response> {
  if (activeStreams.size >= MAX_CONCURRENT_STREAMS) {
    throw new Error(`Too many live RTSP views are already open (limit ${MAX_CONCURRENT_STREAMS}) — close a few camera tiles and retry`);
  }

  const fps = options.fps ?? 6;
  const width = options.width ?? 800;

  const child = spawn(FFMPEG_BIN, [
    "-hide_banner", "-loglevel", "error",
    "-rtsp_transport", "tcp",
    "-fflags", "nobuffer",
    "-i", source,
    "-an",
    "-vf", `fps=${fps},scale=${width}:-2`,
    "-q:v", "7",
    "-f", "mpjpeg",
    "-",
  ], { stdio: ["ignore", "pipe", "pipe"] });

  activeStreams.add(child);
  child.on("close", () => activeStreams.delete(child));

  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString("latin1")).slice(-800); });

  let exitError: string | null = null;
  const exited = new Promise<void>((resolve) => {
    child.once("close", () => {
      if (!exitError) exitError = compactFfmpegError(stderr) || "ffmpeg exited before producing video";
      resolve();
    });
    child.once("error", (err) => {
      if (!exitError) exitError = `ffmpeg failed to start on the server: ${err.message}`;
      resolve();
    });
  });

  const timedOut = new Promise<void>((resolve) => {
    setTimeout(() => {
      if (!exitError) exitError = `Camera did not start streaming within ${Math.round(RESTREAM_START_TIMEOUT_MS / 1000)}s — check the RTSP path, port and credentials`;
      resolve();
    }, RESTREAM_START_TIMEOUT_MS);
  });

  if (!child.stdout) {
    child.kill("SIGKILL");
    throw new Error("ffmpeg produced no output stream");
  }
  const frames = child.stdout[Symbol.asyncIterator]();

  const first = await Promise.race([frames.next(), exited, timedOut]);
  if (exitError) {
    child.kill("SIGKILL");
    throw new Error(exitError);
  }
  const firstChunk = Buffer.from((first as { value: Buffer }).value);

  // Sniff the multipart boundary ffmpeg wrote (e.g. "--ffmpeg\r\n...").
  const head = firstChunk.toString("latin1").slice(0, 200);
  const boundary = head.match(/--([!-~]+)\r?\n/)?.[1] ?? "ffmpeg";

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(new Uint8Array(firstChunk));
        while (true) {
          const { done, value } = await frames.next();
          if (done) break;
          controller.enqueue(new Uint8Array(value as Buffer));
        }
      } catch {
        /* camera dropped mid-stream — the browser retry loop reconnects */
      }
      try { controller.close(); } catch { /* already closed by cancel */ }
    },
    cancel() {
      void frames.return?.();
      child.kill("SIGKILL");
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": `multipart/x-mixed-replace; boundary=${boundary}`,
      "Cache-Control": "no-store, private",
      "X-Accel-Buffering": "no",
    },
  });
}
