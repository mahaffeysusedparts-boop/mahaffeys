import { apiRequest } from "./apiClient";
import type { IpCamera, IpCameraAssignment } from "@/types/scrap";

export type AdcConnectionStatus = "NEEDS_LOGIN" | "NEEDS_OTP" | "CONNECTED" | "ERROR";

export interface AdcStatus {
  status: AdcConnectionStatus;
  username?: string;
  lastVerifiedAt?: string;
  lastSyncAt?: string;
  cameraCount?: number;
  errorMessage?: string;
}

export interface AdcCameraConfig {
  deviceId: string;
  name: string;
  location?: string;
  assignment: IpCameraAssignment;
  isActive: boolean;
  notes?: string;
}

export interface AdcCamerasResponse {
  status: AdcConnectionStatus;
  cameras: IpCamera[];
  warning?: string;
}

export interface AdcClip {
  clipId: string;
  deviceId?: string;
  name?: string;
  startTime?: string;
  durationSeconds?: number;
  videoUrl: string;
}

export interface AdcSyncResponse {
  syncedAt: string;
  cameras: AdcCameraConfig[];
}

export const alarmComService = {
  fetchStatus: () => apiRequest<AdcStatus>("/api/adc/status"),

  login: (username: string, password: string) =>
    apiRequest<{ status: AdcConnectionStatus; username?: string }>("/api/adc/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  submitOtp: (otp: string) =>
    apiRequest<{ status: AdcConnectionStatus; username?: string }>("/api/adc/login", {
      method: "POST",
      body: JSON.stringify({ otp }),
    }),

  logout: () =>
    apiRequest<{ status: AdcConnectionStatus }>("/api/adc/logout", { method: "POST" }),

  sync: () => apiRequest<AdcSyncResponse>("/api/adc/sync", { method: "POST" }),

  fetchCameras: () => apiRequest<AdcCamerasResponse>("/api/adc/cameras"),

  updateCamera: (deviceId: string, patch: { assignment?: IpCameraAssignment; isActive?: boolean; notes?: string | null }) =>
    apiRequest<{ camera: AdcCameraConfig }>(`/api/adc/cameras/${encodeURIComponent(deviceId)}/config`, {
      method: "POST",
      body: JSON.stringify(patch),
    }),

  fetchClips: (deviceId?: string) => {
    const query = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : "";
    return apiRequest<{ clips: AdcClip[] }>(`/api/adc/clips${query}`);
  },
};
