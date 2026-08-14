interface UploadResponse {
  id: string;
  url: string;
  fileName: string;
  contentType: string;
  byteSize: number;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

// Camera photos from modern phones are routinely 8-30 MB and get rejected with
// HTTP 413 by the upload endpoint. Anything above this threshold is downscaled
// and re-encoded as JPEG in the browser before it ever reaches the network.
const OPTIMIZE_ABOVE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

const readFileAsDataUrl = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read the selected image"));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

const loadImage = (source: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error("Unable to process the selected image"));
    image.onload = () => resolve(image);
    image.src = source;
  });

/**
 * Downscales large raster images to MAX_IMAGE_DIMENSION and re-encodes them as
 * JPEG. Small images, non-images, and SVGs are returned untouched so signature
 * pads and existing small captures keep their original fidelity.
 */
export async function optimizeImageDataUrl(source: File | string): Promise<string> {
  const originalDataUrl = typeof source === "string" ? source : await readFileAsDataUrl(source);
  if (!originalDataUrl.startsWith("data:image/")) return originalDataUrl;
  if (originalDataUrl.startsWith("data:image/svg+xml")) return originalDataUrl;

  const image = await loadImage(originalDataUrl);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image compression is unavailable in this browser");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

async function postImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/uploads`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { statusMessage?: string; message?: string }
      | null;
    throw new Error(
      payload?.statusMessage ||
        payload?.message ||
        (response.status === 413
          ? "Image is still too large after compression. Try a smaller photo."
          : `Image upload failed (${response.status})`),
    );
  }

  const result = (await response.json()) as UploadResponse;
  return result.url;
}

const dataUrlBlob = (dataUrl: string) => fetch(dataUrl).then((response) => response.blob());
const baseNameOf = (fileName: string) => fileName.replace(/\.[^.]+$/, "") || "capture";

export async function uploadMedia(file: File): Promise<string> {
  if (file.size <= OPTIMIZE_ABOVE_BYTES || !file.type.startsWith("image/")) {
    return postImage(file);
  }
  const optimizedDataUrl = await optimizeImageDataUrl(file);
  const blob = await dataUrlBlob(optimizedDataUrl);
  return postImage(new File([blob], `${baseNameOf(file.name)}.jpg`, { type: "image/jpeg" }));
}

export async function uploadDataUrl(dataUrl: string, fileName = "capture.jpg"): Promise<string> {
  if (!dataUrl.startsWith("data:")) return dataUrl;

  const blob = await dataUrlBlob(dataUrl);
  if (blob.size <= OPTIMIZE_ABOVE_BYTES) {
    return postImage(new File([blob], fileName, { type: blob.type }));
  }

  const optimizedDataUrl = await optimizeImageDataUrl(dataUrl);
  const optimizedBlob = await dataUrlBlob(optimizedDataUrl);
  return postImage(
    new File([optimizedBlob], `${baseNameOf(fileName)}.jpg`, { type: "image/jpeg" }),
  );
}
