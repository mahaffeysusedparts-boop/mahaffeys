import type { PullYardVehicle } from '@/types/scrap';

export type InterchangeYardVehicle = Pick<PullYardVehicle, 'id' | 'make' | 'model' | 'year' | 'status' | 'section' | 'rowNumber' | 'color'>;

export interface InterchangeMapping {
  id: string;
  partCategory: string;
  partName: string;
  interchangeCode: string;
  description: string;
  compatibleModels: {
    make: string;
    model: string;
    startYear: number;
    endYear: number;
    notes?: string;
  }[];
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

  findInterchangeForVehicle(make: string, model: string, year: number, mappings = INITIAL_INTERCHANGE_DATABASE): InterchangeMapping[] {
    return mappings.filter((item) => item.compatibleModels.some((compatible) => matchesInterchangeModel(make, model, year, compatible)));
  },

  findMatchingDonorVehicles(make: string, model: string, year: number, yardVehicles: PullYardVehicle[], catalogue = INITIAL_INTERCHANGE_DATABASE) {
    const mappings = this.findInterchangeForVehicle(make, model, year, catalogue);
    return mappings.flatMap((interchangeItem) => yardVehicles
      .filter((vehicle) => vehicle.status !== 'CRUSHED' && interchangeItem.compatibleModels.some((compatible) => matchesInterchangeModel(vehicle.make, vehicle.model, vehicle.year, compatible)))
      .map((vehicle) => ({ vehicle, interchangeItem })));
  },
};
