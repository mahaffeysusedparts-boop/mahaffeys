const MAX_FRAME_BYTES = 8 * 1024 * 1024;

/** Read the complete JPEGs inside the server's multipart live response. */
export async function* readJpegFrames(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  let pending = new Uint8Array(0);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      const combined = new Uint8Array(pending.length + value.length);
      combined.set(pending);
      combined.set(value, pending.length);
      pending = combined;
      while (pending.length) {
        let start = -1;
        for (let i = 0; i + 1 < pending.length; i++) {
          if (pending[i] === 0xff && pending[i + 1] === 0xd8) { start = i; break; }
        }
        if (start < 0) {
          pending = pending.slice(-1);
          break;
        }
        if (start) pending = pending.slice(start);
        let end = -1;
        for (let i = 2; i + 1 < pending.length; i++) {
          if (pending[i] === 0xff && pending[i + 1] === 0xd9) { end = i + 2; break; }
        }
        if (end < 0) {
          if (pending.length > MAX_FRAME_BYTES) throw new Error("Live camera frame exceeds the supported size");
          break;
        }
        if (end > MAX_FRAME_BYTES) throw new Error("Live camera frame exceeds the supported size");
        yield pending.slice(0, end);
        pending = pending.slice(end);
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
