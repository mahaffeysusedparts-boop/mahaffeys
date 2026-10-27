export function cameraErrorDetails(stderr: string, source: string): string {
  let detail = stderr.replaceAll(source, "[camera source]");
  detail = detail.replace(/rtsps?:\/\/[^\s]+/gi, "[camera source]");
  try {
    const url = new URL(source);
    for (const value of [url.username, url.password]) {
      if (value) {
        detail = detail.replaceAll(value, "[redacted]");
        detail = detail.replaceAll(decodeURIComponent(value), "[redacted]");
      }
    }
  } catch {
    return "Invalid RTSP source";
  }
  return detail.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(-3).join(" | ").slice(0, 500) || "FFmpeg ended without an error message";
}
