import type { Page } from '@playwright/test';

// Stub the browser OCR worker protocol, not the parser or form code. Synthetic
// license text avoids external model downloads and real personal information.
export async function mockLicenseOcr(page: Page, text = '', confidence = 0) {
  await page.addInitScript(({ text, confidence }) => {
    const NativeWorker = window.Worker;
    class OcrWorker {
      onmessage: ((event: { data: unknown }) => void) | null = null;
      onerror: unknown;
      postMessage(message: { workerId: string; jobId: string; action: string }) {
        queueMicrotask(() => this.onmessage?.({ data: { ...message, status: 'resolve', data: message.action === 'recognize' ? { text, confidence } : {} } }));
      }
      terminate() {}
    }
    window.Worker = class {
      constructor(url: string | URL, options?: WorkerOptions) {
        if (String(url).startsWith('blob:') || String(url).includes('tesseract')) return new OcrWorker();
        return new NativeWorker(url, options);
      }
    } as unknown as typeof Worker;
  }, { text, confidence });
}

export const syntheticLicenseText = 'GEORGIA\nDRIVER LICENSE\nDL D12345678\nNAME JOHN DOE\n123 MAIN ST\nATLANTA GA 30301';
export const syntheticIdImage = { name: 'synthetic-id.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="white"/></svg>') };
