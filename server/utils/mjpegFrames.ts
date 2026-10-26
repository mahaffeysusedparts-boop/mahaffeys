const SOI = Buffer.from([0xff, 0xd8]);
const EOI = Buffer.from([0xff, 0xd9]);
const MAX_FRAME_BYTES = 8 * 1024 * 1024;

/** FFmpeg pipe chunks can split JPEG markers or contain several complete frames. */
export async function* mjpegFrames(chunks: AsyncIterable<Buffer>): AsyncGenerator<Buffer> {
  let pending = Buffer.alloc(0);
  for await (const chunk of chunks) {
    pending = Buffer.concat([pending, chunk]);
    while (pending.length) {
      const start = pending.indexOf(SOI);
      if (start < 0) {
        pending = pending.subarray(Math.max(0, pending.length - 1));
        break;
      }
      if (start) pending = pending.subarray(start);
      const end = pending.indexOf(EOI, 2);
      if (end < 0) {
        if (pending.length > MAX_FRAME_BYTES) throw new Error("Camera frame exceeded the size limit");
        break;
      }
      if (end + 2 > MAX_FRAME_BYTES) throw new Error("Camera frame exceeded the size limit");
      yield pending.subarray(0, end + 2);
      pending = pending.subarray(end + 2);
    }
  }
}
