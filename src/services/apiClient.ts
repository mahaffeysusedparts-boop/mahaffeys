const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { statusMessage?: string; message?: string } | null;
    throw new Error(payload?.statusMessage || payload?.message || `Server request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}
