import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({load:vi.fn(),rtsp:vi.fn(),source:vi.fn(),http:vi.fn()}));
vi.mock('./rtspProxy',() => ({loadCameraById:mocks.load,grabRtspFrame:mocks.rtsp,resolveRtspSource:mocks.source}));
vi.mock('./httpCameraProxy',() => ({proxyHttpCamera:mocks.http}));
import { acquireCameraSnapshot, snapshotContentType } from './cameraSnapshots';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYp0AAAAASUVORK5CYII=','base64');

beforeEach(() => {vi.resetAllMocks();mocks.load.mockResolvedValue({id:'stored-camera'});mocks.source.mockReturnValue(null);});
describe('server camera snapshot acquisition (no hardware)',() => {
  it('returns image bytes, the stored camera ID and a separate snapshot time',async () => {
    mocks.http.mockResolvedValue(new Response(new Uint8Array(png),{headers:{'Content-Type':'image/png'}}));
    const snapshot = await acquireCameraSnapshot('stored-camera');
    expect(snapshot.bytes).toEqual(png);
    expect(snapshot.contentType).toBe('image/png');
    expect(snapshot.cameraId).toBe('stored-camera');
    expect(Number.isFinite(Date.parse(snapshot.capturedAt))).toBe(true);
    expect(mocks.load).toHaveBeenCalledWith('stored-camera');
  });
  it('rejects non-image, truncated, empty and oversized bodies even with image headers',() => {
    for (const bytes of [Buffer.alloc(0),Buffer.from('<html>camera error</html>'),png.subarray(0,png.length-12),Buffer.alloc(9*1024*1024),Buffer.from([255,216,255,217])]) expect(() => snapshotContentType(bytes)).toThrow();
  });
  it('surfaces camera failure without generating a placeholder',async () => {
    mocks.http.mockRejectedValue(new Error('Camera disconnected'));
    await expect(acquireCameraSnapshot('stored-camera')).rejects.toThrow('Camera disconnected');
    expect(mocks.rtsp).not.toHaveBeenCalled();
  });
  it('uses the saved RTSP source and validates returned bytes',async () => {
    mocks.source.mockReturnValue('rtsp://synthetic-camera/live');mocks.rtsp.mockResolvedValue(Buffer.from('not a frame'));
    await expect(acquireCameraSnapshot('stored-camera')).rejects.toThrow('complete JPEG or PNG');
    expect(mocks.http).not.toHaveBeenCalled();
  });
});
