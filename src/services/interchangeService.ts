import { PullYardVehicle } from "@/types/scrap";

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

export const interchangeService = {
  getInterchangeMappings(): InterchangeMapping[] {
    return INITIAL_INTERCHANGE_DATABASE;
  },

  /**
   * Finds matching interchange groups for a given vehicle make, model, and year.
   */
  findInterchangeForVehicle(make: string, model: string, year: number): InterchangeMapping[] {
    const cleanMake = make.trim().toLowerCase();
    const cleanModel = model.trim().toLowerCase();

    return INITIAL_INTERCHANGE_DATABASE.filter((item) =>
      item.compatibleModels.some((c) => {
        const matchMake = c.make.toLowerCase().includes(cleanMake) || cleanMake.includes(c.make.toLowerCase());
        const matchModel = c.model.toLowerCase().includes(cleanModel) || cleanModel.includes(c.model.toLowerCase());
        const matchYear = year >= c.startYear && year <= c.endYear;
        return matchMake && matchModel && matchYear;
      })
    );
  },

  /**
   * Finds all donor vehicles in yard inventory that are interchangeable with a requested vehicle or part.
   */
  findMatchingDonorVehicles(
    make: string,
    model: string,
    year: number,
    yardVehicles: PullYardVehicle[]
  ): { vehicle: PullYardVehicle; interchangeItem: InterchangeMapping }[] {
    const mappings = this.findInterchangeForVehicle(make, model, year);
    const results: { vehicle: PullYardVehicle; interchangeItem: InterchangeMapping }[] = [];

    for (const mapping of mappings) {
      for (const donorVeh of yardVehicles) {
        if (donorVeh.status === "CRUSHED") continue;

        const isDonorCompatible = mapping.compatibleModels.some((c) => {
          const matchMake = donorVeh.make.toLowerCase().includes(c.make.toLowerCase());
          const matchModel = donorVeh.model.toLowerCase().includes(c.model.toLowerCase());
          const matchYear = donorVeh.year >= c.startYear && donorVeh.year <= c.endYear;
          return matchMake && matchModel && matchYear;
        });

        if (isDonorCompatible) {
          // Avoid duplicate entries
          if (!results.some((r) => r.vehicle.id === donorVeh.id && r.interchangeItem.id === mapping.id)) {
            results.push({ vehicle: donorVeh, interchangeItem: mapping });
          }
        }
      }
    }

    return results;
  },
};