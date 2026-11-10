const RECEIPT_CARD_SELECTOR = '.printable-receipt-card';
const RECEIPT_PRINT_HEIGHT_PX = 10 * 96;
const MIN_RECEIPT_PRINT_SCALE = 0.62;
const PRINT_IMAGE_MAX_DIMENSION = 560;
const PRINT_IMAGE_QUALITY = 0.76;

async function embedImage(source: string): Promise<string> {
  const url = new URL(source, window.location.href);
  const response = await fetch(url.href, {
    credentials: url.origin === window.location.origin ? 'include' : 'omit',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error('Photo download failed');
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const scale = Math.min(1, PRINT_IMAGE_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo preparation is unavailable');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', PRINT_IMAGE_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function waitForImages(root: HTMLElement) {
  await Promise.all(Array.from(root.querySelectorAll('img')).map(async image => {
    if (image.complete && image.naturalWidth > 0) return;
    await image.decode().catch(() => undefined);
  }));
}

async function measureReceiptScales(root: HTMLElement): Promise<number[]> {
  if (!root.querySelector(RECEIPT_CARD_SELECTOR)) return [];
  const sandbox = document.createElement('div');
  sandbox.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    'width:7.5in',
    'visibility:hidden',
    'pointer-events:none',
    'background:#fff',
    'z-index:-1',
  ].join(';');
  const measured = root.cloneNode(true) as HTMLElement;
  sandbox.appendChild(measured);
  document.body.appendChild(sandbox);
  try {
    await waitForImages(measured);
    return Array.from(measured.querySelectorAll<HTMLElement>(RECEIPT_CARD_SELECTOR)).map(card => {
      card.style.width = '7.5in';
      card.style.maxWidth = '7.5in';
      card.style.padding = '0.18in 0.22in';
      card.style.lineHeight = '1.08';
      const height = Math.max(card.scrollHeight, card.getBoundingClientRect().height, 1);
      return Math.max(MIN_RECEIPT_PRINT_SCALE, Math.min(1, RECEIPT_PRINT_HEIGHT_PX / height));
    });
  } finally {
    sandbox.remove();
  }
}

function applyReceiptScales(root: HTMLElement, scales: number[]) {
  if (!scales.length) return;
  Array.from(root.querySelectorAll<HTMLElement>(RECEIPT_CARD_SELECTOR)).forEach((card, index) => {
    const scale = scales[index] ?? 1;
    card.style.setProperty('--receipt-print-scale', scale.toFixed(3));
  });
}

export async function preparePrintDocument(root: HTMLElement): Promise<string> {
  const copy = root.cloneNode(true) as HTMLElement;
  const embedded = new Map<string, Promise<string>>();
  const originals = Array.from(root.querySelectorAll('img'));
  const images = Array.from(copy.querySelectorAll('img'));
  await Promise.all(images.map(async (image, index) => {
    const original = originals[index];
    const source = original.currentSrc || original.src;
    try {
      if (!embedded.has(source)) embedded.set(source, embedImage(source));
      image.src = await embedded.get(source)!;
      image.removeAttribute('srcset');
      image.removeAttribute('sizes');
      image.loading = 'eager';
    } catch {
      throw new Error(`Could not prepare photo "${original.alt || 'attached image'}". The print job was not sent. Check that the photo is available and try again.`);
    }
  }));
  applyReceiptScales(copy, await measureReceiptScales(copy));
  return copy.outerHTML;
}

export async function printBrowserDocument(root: HTMLElement): Promise<void> {
  const html = await preparePrintDocument(root);
  const prepared = new DOMParser().parseFromString(html, 'text/html');
  const sources = Array.from(prepared.querySelectorAll('img'));
  const preparedCards = Array.from(prepared.querySelectorAll<HTMLElement>(RECEIPT_CARD_SELECTOR));
  const images = Array.from(root.querySelectorAll('img'));
  const cards = Array.from(root.querySelectorAll<HTMLElement>(RECEIPT_CARD_SELECTOR));
  const attributes = images.map(image => ({
    src: image.getAttribute('src'), srcset: image.getAttribute('srcset'), sizes: image.getAttribute('sizes'),
  }));
  const cardStyles = cards.map(card => card.getAttribute('style'));
  try {
    await Promise.all(images.map(async (image, index) => {
      image.removeAttribute('srcset');
      image.removeAttribute('sizes');
      image.src = sources[index].src;
      await image.decode();
    }));
    cards.forEach((card, index) => {
      const scale = preparedCards[index]?.style.getPropertyValue('--receipt-print-scale');
      if (scale) card.style.setProperty('--receipt-print-scale', scale);
    });
    window.print();
  } finally {
    images.forEach((image, index) => {
      for (const [name, value] of Object.entries(attributes[index])) {
        if (value === null) image.removeAttribute(name);
        else image.setAttribute(name, value);
      }
    });
    cards.forEach((card, index) => {
      const style = cardStyles[index];
      if (style === null) card.removeAttribute('style');
      else card.setAttribute('style', style);
    });
  }
}
