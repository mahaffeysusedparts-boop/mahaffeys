import { grabRtspFrame, loadCameraById, resolveRtspSource } from './rtspProxy';
import { proxyHttpCamera } from './httpCameraProxy';

const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;

export function snapshotContentType(bytes: Buffer): 'image/jpeg' | 'image/png' {
  if (bytes.length > MAX_SNAPSHOT_BYTES) throw new Error('Camera snapshot exceeded the size limit');
  if (bytes.length >= 64 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes.includes(Buffer.from([0xff,0xda])) && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9) return 'image/jpeg';
  if (bytes.length >= 57 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.toString('ascii',12,16) === 'IHDR' && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0 && bytes.includes(Buffer.from('IDAT')) && bytes.subarray(-12).equals(Buffer.from([0,0,0,0,73,69,78,68,174,66,96,130]))) return 'image/png';
  throw new Error('Camera did not return a complete JPEG or PNG snapshot');
}

export async function acquireCameraSnapshot(cameraId: string, requestSignal?: AbortSignal) {
  const camera = await loadCameraById(cameraId);
  const source = resolveRtspSource(camera);
  const signal = requestSignal ? AbortSignal.any([requestSignal,AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000);
  signal.throwIfAborted();
  let bytes: Buffer;
  if (source) {
    bytes = await grabRtspFrame(source);
  } else {
    const response = await proxyHttpCamera(camera,true,signal);
    if (!response.body) throw new Error('Camera returned no image');
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let length = 0;
    try {
      while (true) {
        signal.throwIfAborted();
        const next = await reader.read();
        if (next.done) break;
        length += next.value.byteLength;
        if (length > MAX_SNAPSHOT_BYTES) throw new Error('Camera snapshot exceeded the size limit');
        chunks.push(Buffer.from(next.value));
      }
      bytes = Buffer.concat(chunks);
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
  signal.throwIfAborted();
  const contentType = snapshotContentType(bytes);
  return { cameraId: camera.id, bytes, contentType, capturedAt: new Date().toISOString() };
}
