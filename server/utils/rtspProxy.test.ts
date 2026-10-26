import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { spawn } = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn }));
vi.mock('./db', () => ({ query: vi.fn() }));
import { startRtspMjpegRestream } from './rtspProxy';
import { mjpegFrames } from './mjpegFrames';

const jpeg = Buffer.from([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
function processFixture() {
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(), stderr: new PassThrough(),
    kill: vi.fn(() => {
      child.stdout.destroy();
      child.stderr.destroy();
      child.emit('close', 0);
      return true;
    }),
  });
  spawn.mockReturnValue(child);
  return child;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe('RTSP browser restream', () => {
  it('waits for a complete JPEG and emits matching multipart headers', async () => {
    const child = processFixture();
    let ready = false;
    const responsePromise = startRtspMjpegRestream('rtsp://test-camera/live').then(response => { ready = true; return response; });
    child.stdout.write(jpeg.subarray(0, 3));
    await new Promise(resolve => setImmediate(resolve));
    expect(ready).toBe(false);
    child.stdout.write(jpeg.subarray(3));
    const response = await responsePromise;
    expect(response.headers.get('content-type')).toBe('multipart/x-mixed-replace; boundary=mahaffeys-frame');
    const reader = response.body!.getReader();
    const first = Buffer.from((await reader.read()).value!);
    expect(first.toString('latin1')).toContain('--mahaffeys-frame\r\nContent-Type: image/jpeg\r\nContent-Length: 7\r\n\r\n');
    expect(first.subarray(first.length - 9, first.length - 2)).toEqual(jpeg);
    await reader.cancel();
    expect(child.kill).toHaveBeenCalled();
    const args = spawn.mock.calls[0][1];
    expect(args).toContain('yuvj420p');
    expect(args).not.toContain('nobuffer');
    expect(args.slice(args.indexOf('-threads:v'), args.indexOf('-threads:v') + 2)).toEqual(['-threads:v', '1']);
  });

  it('reports authentication failure without exposing the RTSP source credentials', async () => {
    const child = processFixture();
    const response = startRtspMjpegRestream('rtsp://viewer:fake-secret@test-camera/live');
    const rejected = expect(response).rejects.toThrow('Camera rejected live-view credentials');
    child.stderr.write('rtsp://viewer:fake-secret@test-camera/live: Server returned 401 Unauthorized');
    child.stdout.end();
    await rejected;
    expect(child.kill).toHaveBeenCalled();
  });

  it('kills an encoder that never delivers a complete frame', async () => {
    vi.useFakeTimers();
    const child = processFixture();
    const response = startRtspMjpegRestream('rtsp://test-camera/live');
    const rejected = expect(response).rejects.toThrow('within 15 seconds');
    await vi.advanceTimersByTimeAsync(15_000);
    await rejected;
    expect(child.kill).toHaveBeenCalled();
  });

  it('cancels a pending startup when the browser disconnects', async () => {
    const child = processFixture();
    const controller = new AbortController();
    const response = startRtspMjpegRestream('rtsp://test-camera/live', { signal: controller.signal });
    const rejected = expect(response).rejects.toThrow('Camera view canceled');
    controller.abort();
    await rejected;
    expect(child.kill).toHaveBeenCalled();
  });
});

describe('JPEG frame parsing', () => {
  it('handles split markers and several frames in one pipe chunk', async () => {
    async function* chunks() {
      yield Buffer.from([0xff]);
      yield Buffer.concat([jpeg.subarray(1), jpeg, jpeg.subarray(0, 4)]);
      yield jpeg.subarray(4);
    }
    const frames: Buffer[] = [];
    for await (const frame of mjpegFrames(chunks())) frames.push(frame);
    expect(frames).toEqual([jpeg, jpeg, jpeg]);
  });
});
