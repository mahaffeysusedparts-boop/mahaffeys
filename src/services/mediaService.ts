interface UploadResponse {
  id: string;
  url: string;
  fileName: string;
  contentType: string;
  byteSize: number;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export async function uploadMedia(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/uploads`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { statusMessage?: string; message?: string } | null;
    throw new Error(payload?.statusMessage || payload?.message || `Image upload failed (${response.status})`);
  }

  const result = await response.json() as UploadResponse;
  return result.url;
}

export async function uploadDataUrl(dataUrl: string, fileName = "capture.jpg"): Promise<string> {
  if (!dataUrl.startsWith("data:")) return dataUrl;
  const blob = await fetch(dataUrl).then((response) => response.blob());
  const extension = blob.type === "image/png" ? "png" : "jpg";
  const baseName = fileName.replace(/\.[^.]+$/, "");
  return uploadMedia(new File([blob], `${baseName}.${extension}`, { type: blob.type }));
}
