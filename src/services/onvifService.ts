import { apiRequest } from "./apiClient";

export interface OnvifDiscoverResponse {
  ok: boolean;
  rtspUrl: string;
  profileToken: string;
  profileName: string;
  mediaServiceUrl: string;
}

export const onvifService = {
  /**
   * Asks the app server to perform ONVIF discovery against a camera and
   * return the resolved RTSP stream URL.
   */
  discover: (options: {
    host: string;
    port?: number;
    username?: string;
    password?: string;
    path?: string;
  }) =>
    apiRequest<OnvifDiscoverResponse>("/api/onvif/discover", {
      method: "POST",
      body: JSON.stringify({
        host: options.host,
        port: options.port,
        username: options.username,
        password: options.password,
        path: options.path,
      }),
    }),
};
