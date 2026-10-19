import type { PullYardVehicle } from '@/types/scrap';
import { apiRequest } from './apiClient';

export type InterchangeYardVehicle = Pick<PullYardVehicle, 'id' | 'make' | 'model' | 'year' | 'status' | 'section' | 'rowNumber' | 'color' | 'engineSizeLiters' | 'engineCylinders' | 'fuelType'>;

export interface InterchangeMapping {
  id: string;
  partCategory: string;
  partName: string;
  interchangeCode: string;
  description: string;
  source?: { name: string; url: string; fetchedAt: string; stale: boolean; verification: 'unverified' };
  specifications?: Record<string, string>;
  references?: string[];
  compatibleModels: {
    make: string;
    model: string;
    startYear: number;
    endYear: number;
    engine?: string;
    engineLiters?: number;
    engineCylinders?: number;
    fuelType?: 'diesel' | 'gas';
    notes?: string;
  }[];
}

export interface PartsCatalog {
  mappings: InterchangeMapping[];
  sources: { name: string; url: string; state: 'loaded' | 'stale' | 'unavailable'; applications: number; fetchedAt?: string }[];
}

export function matchesDonorApplication(vehicle: InterchangeYardVehicle, application: InterchangeMapping['compatibleModels'][number]) {
  if (vehicle.status === 'CRUSHED' || !matchesInterchangeModel(vehicle.make, vehicle.model, vehicle.year, application)) return false;
  if (vehicle.engineSizeLiters != null && application.engineLiters != null && Math.abs(vehicle.engineSizeLiters - application.engineLiters) > 0.05) return false;
  if (vehicle.engineCylinders != null && application.engineCylinders != null && vehicle.engineCylinders !== application.engineCylinders) return false;
  const fuel = vehicle.fuelType?.toLowerCase();
  if (application.fuelType === 'diesel' && fuel && /gas|petrol/.test(fuel)) return false;
  if (application.fuelType === 'gas' && fuel?.includes('diesel')) return false;
  return true;
}

export const INITIAL_INTERCHANGE_DATABASE: InterchangeMapping[] = [];
const normalized = (value: string) => value.trim().toLowerCase().replace(/[\s-]+/g, '');

export function matchesInterchangeModel(make: string, model: string, year: number, compatible: InterchangeMapping['compatibleModels'][number]) {
  return !!make.trim() && !!model.trim() && Number.isInteger(year)
    && normalized(make) === normalized(compatible.make)
    && normalized(model) === normalized(compatible.model)
    && year >= compatible.startYear && year <= compatible.endYear;
}

export const interchangeService = {
  getInterchangeMappings(): InterchangeMapping[] {
    return INITIAL_INTERCHANGE_DATABASE;
  },

  publicCatalog: (signal?: AbortSignal) => apiRequest<PartsCatalog>('/api/public/parts-catalog', { signal }),

  findInterchangeForVehicle(make: string, model: string, year: number, mappings = INITIAL_INTERCHANGE_DATABASE, engineLiters?: number): InterchangeMapping[] {
    return mappings.filter((item) => item.compatibleModels.some((compatible) => matchesInterchangeModel(make, model, year, compatible)
      && (engineLiters == null || compatible.engineLiters == null || Math.abs(compatible.engineLiters - engineLiters) < 0.05)));
  },

  findMatchingDonorVehicles(make: string, model: string, year: number, yardVehicles: PullYardVehicle[], catalogue = INITIAL_INTERCHANGE_DATABASE) {
    const mappings = this.findInterchangeForVehicle(make, model, year, catalogue);
    return mappings.flatMap((interchangeItem) => yardVehicles
      .filter((vehicle) => interchangeItem.compatibleModels.some((compatible) => matchesDonorApplication(vehicle, compatible)))
      .map((vehicle) => ({ vehicle, interchangeItem })));
  },
};
