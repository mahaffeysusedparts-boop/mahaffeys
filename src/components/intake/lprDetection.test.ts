import { describe, expect, it } from "vitest";
import { looksLikePlate, measurePlateFrame } from "./lprDetection";

function frame(width: number, height: number, pixel: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const value = pixel(x, y);
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return data;
}

describe("automatic plate frame detection", () => {
  it("rejects a flat, detail-free frame", () => {
    const metrics = measurePlateFrame(frame(40, 16, () => 120), 40, 16);
    expect(looksLikePlate(metrics)).toBe(false);
  });

  it("accepts a bright plate-like frame with dark character edges", () => {
    const data = frame(80, 24, (x, y) => ((x % 10 < 3 && y > 3 && y < 21) ? 30 : 205));
    const metrics = measurePlateFrame(data, 80, 24);
    expect(metrics.contrast).toBeGreaterThan(30);
    expect(looksLikePlate(metrics)).toBe(true);
  });
});
