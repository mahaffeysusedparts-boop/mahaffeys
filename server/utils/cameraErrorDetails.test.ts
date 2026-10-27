import { describe, expect, it } from 'vitest';
import { cameraErrorDetails } from './cameraErrorDetails';

describe('safe camera diagnostics', () => {
  it('removes source URLs and credential values while retaining the useful error', () => {
    const source = 'rtsp://camera-viewer:fake%40secret@192.168.1.152:554/live';
    const detail = cameraErrorDetails(`${source}: failed\npassword fake@secret user camera-viewer\nInvalid argument: unsupported encoder setting`, source);
    expect(detail).toContain('unsupported encoder setting');
    expect(detail).not.toContain('rtsp://');
    expect(detail).not.toContain('192.168.1.152');
    expect(detail).not.toContain('camera-viewer');
    expect(detail).not.toContain('fake@secret');
    expect(detail).not.toContain('fake%40secret');
  });
  it('bounds long diagnostic output', () => {
    expect(cameraErrorDetails('encoder error '.repeat(500), 'rtsp://camera/live').length).toBeLessThanOrEqual(500);
  });
});
