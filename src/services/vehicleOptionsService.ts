import { apiRequest } from './apiClient';
import type { InterchangeYardVehicle } from './interchangeService';

export interface VehicleOption { id: number; name: string }
export interface VehicleOptions { options: VehicleOption[]; source: string; yearSpecific: boolean; fitmentData: false }

export const vehicleOptionsService = {
  makes: () => apiRequest<VehicleOptions>('/api/public/vehicle-options'),
  models: (makeId: number, year: number) => apiRequest<VehicleOptions>(`/api/public/vehicle-options?makeId=${makeId}&year=${year}`),
  yardVehicles: () => apiRequest<InterchangeYardVehicle[]>('/api/public/interchange-inventory'),
};
