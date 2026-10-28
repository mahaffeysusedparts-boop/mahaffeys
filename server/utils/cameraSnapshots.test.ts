import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({load:vi.fn(),rtsp:vi.fn(),source:vi.fn(),http:vi.fn()}));
vi.mock('./rtspProxy',() => ({loadCameraById:mocks.load,grabRtspFrame:mocks.rtsp,resolveRtspSource:mocks.source}));
vi.mock('./httpCameraProxy',() => ({proxyHttpCamera:mocks.http}));
import { acquireCameraSnapshot, snapshotContentType } from './cameraSnapshots';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYp0AAAAASUVORK5CYII=','base64');
beforeEach(() => {vi.resetAllMocks();mocks.load.mockResolvedValue({id:'stored-camera'});mocks.source.mockReturnValue(null);});
describe('bounded camera snapshots (synthetic sources)',() => {
  it('returns stored camera ID, real bytes and separate response time',async () => {
    mocks.http.mockResolvedValue(new Response(new Uint8Array(png)));
    const snapshot = await acquireCameraSnapshot('stored-camera');
    expect(snapshot.bytes).toEqual(png);expect(snapshot.contentType).toBe('image/png');
    expect(snapshot.cameraId).toBe('stored-camera');expect(Number.isFinite(Date.parse(snapshot.capturedAt))).toBe(true);
  });
  it('rejects empty, non-image, truncated and oversized bodies',() => {
    for (const bytes of [Buffer.alloc(0),Buffer.from('<html>camera error</html>'),png.subarray(0,png.length-12),Buffer.alloc(9*1024*1024),Buffer.from([255,216,255,217])]) expect(() => snapshotContentType(bytes)).toThrow();
  });
  it('fails honestly without generating a replacement image',async () => {
    mocks.http.mockRejectedValue(new Error('Camera disconnected'));
    await expect(acquireCameraSnapshot('stored-camera')).rejects.toThrow('Camera disconnected');
    expect(mocks.rtsp).not.toHaveBeenCalled();
  });
  it('uses stored RTSP source and checks its result',async () => {
    mocks.source.mockReturnValue('rtsp://synthetic-camera/live');mocks.rtsp.mockResolvedValue(Buffer.from('not an image'));
    await expect(acquireCameraSnapshot('stored-camera')).rejects.toThrow('complete JPEG or PNG');expect(mocks.http).not.toHaveBeenCalled();
  });
});
