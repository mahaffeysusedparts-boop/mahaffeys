import { IpCamera } from "@/types/scrap";
import { sharedStorage } from "@/services/sharedStorage";
import { INITIAL_IP_CAMERAS } from "@/services/data/initialData";

const KEY = 'mahaffeys_ip_cameras';

export const cameraStorage = {
  getIpCameras(): IpCamera[] {
    const data = sharedStorage.getItem(KEY);
    if (!data) {
      sharedStorage.setItem(KEY, JSON.stringify(INITIAL_IP_CAMERAS));
      return INITIAL_IP_CAMERAS;
    }
    return JSON.parse(data);
  },

  saveIpCamera(camera: IpCamera): IpCamera {
    const cameras = this.getIpCameras();
    const idx = cameras.findIndex((c) => c.id === camera.id);
    if (idx >= 0) {
      cameras[idx] = camera;
    } else {
      cameras.unshift(camera);
    }
    sharedStorage.setItem(KEY, JSON.stringify(cameras));
    return camera;
  },

  deleteIpCamera(cameraId: string): void {
    const cameras = this.getIpCameras().filter((c) => c.id !== cameraId);
    sharedStorage.setItem(KEY, JSON.stringify(cameras));
  },
};