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
    const scale = Math.min(1, 800 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo preparation is unavailable');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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
  return copy.outerHTML;
}

export async function printBrowserDocument(root: HTMLElement): Promise<void> {
  const html = await preparePrintDocument(root);
  const prepared = new DOMParser().parseFromString(html, 'text/html');
  const sources = Array.from(prepared.querySelectorAll('img'));
  const images = Array.from(root.querySelectorAll('img'));
  const attributes = images.map(image => ({
    src: image.getAttribute('src'), srcset: image.getAttribute('srcset'), sizes: image.getAttribute('sizes'),
  }));
  try {
    await Promise.all(images.map(async (image, index) => {
      image.removeAttribute('srcset');
      image.removeAttribute('sizes');
      image.src = sources[index].src;
      await image.decode();
    }));
    window.print();
  } finally {
    images.forEach((image, index) => {
      for (const [name, value] of Object.entries(attributes[index])) {
        if (value === null) image.removeAttribute(name);
        else image.setAttribute(name, value);
      }
    });
  }
}
