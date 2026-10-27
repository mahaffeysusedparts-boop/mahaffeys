import { useEffect, useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import type { IpCamera } from "@/types/scrap";
import { readJpegFrames } from "@/utils/readJpegFrames";

export function RtspLiveView({ cam, objectFit = "object-cover" }: { cam: IpCamera; objectFit?: string }) {
  const [imageUrl, setImageUrl] = useState<string>();
  const [status, setStatus] = useState<"connecting" | "live" | "reconnecting">("connecting");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!cam.isActive) return;
    let stopped = false;
    let attempts = 0;
    let controller: AbortController | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let frameTimer: ReturnType<typeof setTimeout> | undefined;
    let currentUrl: string | undefined;
    setStatus("connecting");
    setError("");
    setImageUrl(undefined);

    const connect = async () => {
      if (stopped) return;
      const connection = new AbortController();
      controller = connection;
      const armFrameTimeout = () => {
        clearTimeout(frameTimer);
        frameTimer = setTimeout(() => connection.abort(), 20_000);
      };
      armFrameTimeout();
      try {
        const response = await fetch(`/api/cameras/${encodeURIComponent(cam.id)}/stream?t=${attempts++}`, {
          credentials: "same-origin", cache: "no-store", signal: connection.signal,
        });
        if (!response.ok) throw new Error(`Server live feed unavailable (${response.status})`);
        if (!response.headers.get("content-type")?.startsWith("multipart/x-mixed-replace") || !response.body) {
          throw new Error("Server did not return a live camera feed");
        }
        for await (const jpeg of readJpegFrames(response.body)) {
          if (stopped) return;
          armFrameTimeout();
          const nextUrl = URL.createObjectURL(new Blob([jpeg], { type: "image/jpeg" }));
          if (currentUrl) URL.revokeObjectURL(currentUrl);
          currentUrl = nextUrl;
          setImageUrl(nextUrl);
          setStatus("live");
          setError("");
        }
        throw new Error("Live feed ended");
      } catch (failure) {
        if (stopped) return;
        setStatus("reconnecting");
        setError(connection.signal.aborted ? "No live frame received for 20 seconds" : failure instanceof Error ? failure.message : "Live feed disconnected");
      } finally {
        clearTimeout(frameTimer);
        connection.abort();
      }
      if (!stopped) retryTimer = setTimeout(() => void connect(), 5000);
    };
    void connect();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      clearTimeout(frameTimer);
      controller?.abort();
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [cam.id, cam.isActive, cam.rtspUrl, cam.streamUrl, cam.username, cam.password]);

  if (!cam.isActive) return <span className="text-xs text-slate-400 font-mono">CAMERA STREAM PAUSED</span>;

  return (
    <>
      <img src={imageUrl} alt={cam.name} className={`w-full h-full ${objectFit}`} />
      {status !== "live" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/95 p-4 text-center" role="status">
          {status === "connecting" ? <RefreshCw className="w-6 h-6 animate-spin text-sky-400" /> : <WifiOff className="w-7 h-7 text-slate-500" />}
          <span className={`text-[11px] font-mono ${status === "connecting" ? "text-sky-300" : "text-amber-300"}`}>
            {status === "connecting" ? "WAITING FOR LIVE FRAME…" : "STREAM RECONNECTING…"}
          </span>
          {error && <span className="text-[10px] text-slate-400 max-w-64">{error}. Retrying automatically.</span>}
        </div>
      )}
    </>
  );
}
