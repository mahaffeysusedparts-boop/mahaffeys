import { describe, expect, it } from 'vitest';
import { readJpegFrames } from './readJpegFrames';

describe('browser live frame reader', () => {
  it('reads split JPEG markers and reports an ended feed instead of waiting forever', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([0xff]));
        controller.enqueue(jpeg.slice(1, 6));
        controller.enqueue(jpeg.slice(6));
        controller.close();
      },
    });
    const frames = readJpegFrames(stream);
    expect(await frames.next()).toEqual({ value: jpeg, done: false });
    expect((await frames.next()).done).toBe(true);
  });
  it('cancels the stream when the viewer stops reading', async () => {
    let canceled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array([0xff, 0xd8, 1, 0xff, 0xd9])); },
      cancel() { canceled = true; },
    });
    const frames = readJpegFrames(stream);
    await frames.next();
    await frames.return(undefined);
    expect(canceled).toBe(true);
  });
});
