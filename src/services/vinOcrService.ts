import { createWorker, PSM } from "tesseract.js";
import { buildCandidates, VIN_CHARS, type VinCandidate } from "./vinCheck";

export { checkVinFormat, computeCheckDigit } from "./vinCheck";
export type { VinFormatCheck, VinCandidate } from "./vinCheck";

/**
 * Advanced door-jamb VIN extraction engine.
 *
 * Pipeline: photo → enhancement variants (grayscale stretch, adaptive
 * binarization, inverted) → multi-pass Tesseract OCR restricted to the VIN
 * alphabet → candidate harvesting → ISO 3779 check-digit validation with
 * OCR-confusion repair → ranked candidates for operator review.
 */

export interface VinScanResult {
  candidates: VinCandidate[];
  best: VinCandidate | null;
  rawText: string;
  passesRun: string[];
  durationMs: number;
}

export interface VinScanProgress {
  phase: "enhance" | "pass" | "validate";
  label: string;
  index: number;
  total: number;
}

/* ------------------------------------------------------------------ */
/* Image enhancement                                                   */
/* ------------------------------------------------------------------ */

const loadImageElement = (source: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error("Unable to read the captured photo"));
    image.onload = () => resolve(image);
    image.src = source;
  });

/** Normalizes resolution for OCR: stickers need ~1600px+ on the long edge. */
function drawScaled(image: HTMLImageElement): HTMLCanvasElement {
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(2.5, Math.max(1, 1800 / longest));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable in this browser");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Grayscale + 2nd–98th percentile contrast stretch (recovers shadowed jambs). */
function grayscaleStretch(canvas: HTMLCanvasElement): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  const { width: w, height: h } = canvas;
  const data = context.getImageData(0, 0, w, h);
  const pixels = data.data;
  const histogram = new Uint32Array(256);
  for (let i = 0; i < pixels.length; i += 4) {
    const gray = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
    pixels[i] = pixels[i + 1] = pixels[i + 2] = gray;
    histogram[gray]++;
  }
  const total = w * h;
  let low = 0;
  let high = 255;
  let cumulative = 0;
  for (let level = 0; level < 256; level++) {
    cumulative += histogram[level];
    if (cumulative >= total * 0.02) { low = level; break; }
  }
  cumulative = 0;
  for (let level = 255; level >= 0; level--) {
    cumulative += histogram[level];
    if (cumulative >= total * 0.02) { high = level; break; }
  }
  if (high <= low) { context.putImageData(data, 0, 0); return; }
  const range = high - low;
  for (let i = 0; i < pixels.length; i += 4) {
    const stretched = Math.max(0, Math.min(255, Math.round(((pixels[i] - low) / range) * 255)));
    pixels[i] = pixels[i + 1] = pixels[i + 2] = stretched;
  }
  context.putImageData(data, 0, 0);
}

/** Bradley adaptive binarization via integral image (beats global thresholds under glare). */
function adaptiveThreshold(canvas: HTMLCanvasElement, invert: boolean): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  const { width: w, height: h } = canvas;
  const data = context.getImageData(0, 0, w, h);
  const pixels = data.data;
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      const gray = pixels[(y * w + x) * 4];
      rowSum += gray;
      integral[(y + 1) * (w + 1) + (x + 1)] = integral[y * (w + 1) + (x + 1)] + rowSum;
    }
  }
  const windowSize = Math.max(16, (Math.floor(Math.min(w, h) / 8)) | 1);
  const half = windowSize >> 1;
  const thresholdBias = 1 - 0.15;
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(h - 1, y + half);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(w - 1, x + half);
      const count = (y1 - y0 + 1) * (x1 - x0 + 1);
      const sum =
        integral[(y1 + 1) * (w + 1) + (x1 + 1)] -
        integral[y0 * (w + 1) + (x1 + 1)] -
        integral[(y1 + 1) * (w + 1) + x0] +
        integral[y0 * (w + 1) + x0];
      const gray = pixels[(y * w + x) * 4];
      const bright = gray > (sum / count) * thresholdBias;
      const value = invert !== bright ? 255 : 0; // XOR handles the inverted variant
      const index = (y * w + x) * 4;
      pixels[index] = pixels[index + 1] = pixels[index + 2] = value;
    }
  }
  context.putImageData(data, 0, 0);
}

interface EnhancedVariants {
  contrast: HTMLCanvasElement;
  threshold: HTMLCanvasElement;
  inverted: HTMLCanvasElement;
}

/* ------------------------------------------------------------------ */
/* OCR worker                                                          */
/* ------------------------------------------------------------------ */

let workerPromise: Promise<Awaited<ReturnType<typeof createWorker>>> | null = null;

async function getOcrWorker() {
  if (!workerPromise) {
    workerPromise = createWorker("eng").then(async (worker) => {
      await worker.setParameters({ tessedit_char_whitelist: VIN_CHARS });
      return worker;
    });
    // A failed download (offline first run) must not poison future attempts.
    workerPromise.catch(() => { workerPromise = null; });
  }
  return workerPromise;
}

interface OcrPass { variant: keyof EnhancedVariants; label: string; psm: PSM }

const OCR_PASSES: OcrPass[] = [
  { variant: "contrast", label: "Enhanced photo read", psm: PSM.SINGLE_BLOCK },
  { variant: "contrast", label: "Single-line read", psm: PSM.SINGLE_LINE },
  { variant: "threshold", label: "Glare-boosted read", psm: PSM.SINGLE_BLOCK },
  { variant: "contrast", label: "Wide text sweep", psm: PSM.SPARSE_TEXT },
];

const INVERTED_PASS: OcrPass = { variant: "inverted", label: "Engraved plate read", psm: PSM.SINGLE_BLOCK };

/* ------------------------------------------------------------------ */
/* Public entry point                                                  */
/* ------------------------------------------------------------------ */

export async function scanVinPhoto(
  source: string,
  onProgress?: (progress: VinScanProgress) => void,
): Promise<VinScanResult> {
  const startedAt = performance.now();
  onProgress?.({ phase: "enhance", label: "Enhancing image for OCR", index: 0, total: OCR_PASSES.length });

  const image = await loadImageElement(source);
  const variants: EnhancedVariants = {
    contrast: drawScaled(image),
    threshold: drawScaled(image),
    inverted: drawScaled(image),
  };
  grayscaleStretch(variants.contrast);
  grayscaleStretch(variants.threshold);
  adaptiveThreshold(variants.threshold, false);
  grayscaleStretch(variants.inverted);
  adaptiveThreshold(variants.inverted, true);

  const worker = await getOcrWorker();
  const byVin = new Map<string, VinCandidate>();
  const passesRun: string[] = [];
  const rawTexts: string[] = [];

  const runPass = async (pass: OcrPass, index: number, total: number) => {
    onProgress?.({ phase: "pass", label: pass.label, index, total });
    passesRun.push(pass.label);
    await worker.setParameters({ tessedit_pageseg_mode: pass.psm });
    const result = await worker.recognize(variants[pass.variant]);
    const text = result.data.text || "";
    const confidence = Math.round(result.data.confidence || 0);
    rawTexts.push(text);
    for (const candidate of buildCandidates(text, confidence, pass.label)) {
      const existing = byVin.get(candidate.vin);
      if (!existing || existing.score < candidate.score) byVin.set(candidate.vin, candidate);
    }
  };

  let passIndex = 0;
  for (const pass of OCR_PASSES) {
    await runPass(pass, ++passIndex, OCR_PASSES.length);
    const bestSoFar = [...byVin.values()].sort((a, b) => b.score - a.score)[0];
    // Early exit: a check-digit-valid, confident read is definitive.
    if (bestSoFar?.checkDigitValid && bestSoFar.ocrConfidence >= 75) break;
  }

  // Rescue pass for engraved/dark plates only when nothing validated so far.
  const anyValid = [...byVin.values()].some((candidate) => candidate.checkDigitValid);
  if (!anyValid) {
    await runPass(INVERTED_PASS, passIndex + 1, passIndex + 1);
  }

  onProgress?.({ phase: "validate", label: "Validating VIN check digit", index: passIndex + 1, total: passIndex + 1 });

  const candidates = [...byVin.values()].sort((a, b) => b.score - a.score).slice(0, 5);
  return {
    candidates,
    best: candidates[0] ?? null,
    rawText: rawTexts.join("\n").trim(),
    passesRun,
    durationMs: Math.round(performance.now() - startedAt),
  };
}

/** Downscales a captured frame into a JPEG data URL suitable for compliance storage. */
export function toCompliancePhoto(source: string, maxDimension = 1280, quality = 0.8): Promise<string> {
  return loadImageElement(source).then((image) => {
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable in this browser");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  });
}
