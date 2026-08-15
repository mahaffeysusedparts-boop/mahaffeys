export interface PlateFrameMetrics {
  contrast: number;
  edgeDensity: number;
  brightness: number;
}

export function measurePlateFrame(data: Uint8ClampedArray, width: number, height: number): PlateFrameMetrics {
  if (!width || !height || data.length < width * height * 4) {
    return { contrast: 0, edgeDensity: 0, brightness: 0 };
  }

  let sum = 0;
  let sumSquares = 0;
  let edges = 0;
  let comparisons = 0;
  const luminance = new Uint8Array(width * height);

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 4;
    const value = Math.round(data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114);
    luminance[pixel] = value;
    sum += value;
    sumSquares += value * value;
  }

  for (let y = 1; y < height; y += 1) {
    for (let x = 1; x < width; x += 1) {
      const index = y * width + x;
      const horizontal = Math.abs(luminance[index] - luminance[index - 1]);
      const vertical = Math.abs(luminance[index] - luminance[index - width]);
      if (horizontal + vertical > 72) edges += 1;
      comparisons += 1;
    }
  }

  const count = width * height;
  const brightness = sum / count;
  const variance = Math.max(0, sumSquares / count - brightness * brightness);
  return { contrast: Math.sqrt(variance), edgeDensity: comparisons ? edges / comparisons : 0, brightness };
}

export function looksLikePlate(metrics: PlateFrameMetrics) {
  return metrics.brightness > 35
    && metrics.brightness < 235
    && metrics.contrast > 30
    && metrics.edgeDensity > 0.055
    && metrics.edgeDensity < 0.5;
}
