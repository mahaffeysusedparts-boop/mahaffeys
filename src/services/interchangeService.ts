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

export const INITIAL_INTERCHANGE_DATABASE: InterchangeMapping[] = [
  {
    id: "ic-101",
    partCategory: "Engine & Driveline",
    partName: "Ford 5.4L V8 Triton Engine (3V)",
    interchangeCode: "ENG-FORD-54L-3V",
    description: "5.4L 3-Valve V8 Triton Engine Assembly",
    compatibleModels: [
      { make: "Ford", model: "F-150", startYear: 2004, endYear: 2010, notes: "3V SOHC Triton V8" },
      { make: "Ford", model: "Expedition", startYear: 2005, endYear: 2014, notes: "Fits 5.4L Expedition" },
      { make: "Lincoln", model: "Mark LT", startYear: 2006, endYear: 2008, notes: "Direct fitment" },
      { make: "Lincoln", model: "Navigator", startYear: 2005, endYear: 2014, notes: "3V Triton V8" },
    ],
  },
  {
    id: "ic-102",
    partCategory: "Engine & Driveline",
    partName: "GM 5.3L V8 Vortec Engine (Vortec 5300)",
    interchangeCode: "ENG-GM-5300-V8",
    description: "Vortec 5.3L V8 (LM7 / L33 / LC9 / LMG)",
    compatibleModels: [
      { make: "Chevrolet", model: "Silverado 1500", startYear: 1999, endYear: 2013, notes: "Gen III / Gen IV Vortec 5300" },
      { make: "GMC", model: "Sierra 1500", startYear: 1999, endYear: 2013, notes: "Gen III / Gen IV" },
      { make: "Chevrolet", model: "Tahoe", startYear: 2000, endYear: 2014, notes: "Direct swap with matching wiring" },
      { make: "Chevrolet", model: "Suburban 1500", startYear: 2000, endYear: 2014, notes: "Direct swap" },
      { make: "GMC", model: "Yukon", startYear: 2000, endYear: 2014, notes: "Fits Yukon & Yukon XL" },
      { make: "Cadillac", model: "Escalade", startYear: 2002, endYear: 2006, notes: "5.3L 2WD/4WD models" },
    ],
  },
  {
    id: "ic-103",
    partCategory: "Engine & Driveline",
    partName: "Toyota 2.5L 4-Cylinder (2AR-FE)",
    interchangeCode: "ENG-TOYOTA-2AR-25L",
    description: "2.5L DOHC 16-Valve Dual VVT-i 4-Cylinder",
    compatibleModels: [
      { make: "Toyota", model: "Camry", startYear: 2010, endYear: 2017, notes: "Non-hybrid 2.5L 2AR-FE" },
      { make: "Toyota", model: "RAV4", startYear: 2009, endYear: 2018, notes: "Fits RAV4 2.5L" },
      { make: "Scion", model: "tC", startYear: 2011, endYear: 2016, notes: "Direct fit" },
    ],
  },
  {
    id: "ic-104",
    partCategory: "Engine & Driveline",
    partName: "GM 4L60E 4-Speed Automatic Transmission",
    interchangeCode: "TRN-GM-4L60E",
    description: "4-Speed Heavy Duty Automatic Transmission (4L60-E)",
    compatibleModels: [
      { make: "Chevrolet", model: "Silverado 1500", startYear: 1996, endYear: 2007, notes: "Removable bellhousing 4L60E" },
      { make: "GMC", model: "Sierra 1500", startYear: 1996, endYear: 2007, notes: "Match 2WD vs 4WD output shaft" },
      { make: "Chevrolet", model: "Tahoe", startYear: 1996, endYear: 2007 },
      { make: "Chevrolet", model: "Impala SS / Caprice", startYear: 1996, endYear: 2006 },
    ],
  },
  {
    id: "ic-105",
    partCategory: "Electrical & Lights",
    partName: "Ford 130A 3G/6G Alternator Assembly",
    interchangeCode: "ALT-FORD-130A",
    description: "130-Amp Heavy Duty OEM Alternator",
    compatibleModels: [
      { make: "Ford", model: "F-150", startYear: 2004, endYear: 2010 },
      { make: "Ford", model: "E-Series Van", startYear: 2004, endYear: 2014 },
      { make: "Ford", model: "Crown Victoria", startYear: 2003, endYear: 2011 },
    ],
  },
  {
    id: "ic-106",
    partCategory: "Engine & Driveline",
    partName: "Honda 2.4L DOHC i-VTEC (K24A2 / K24Z3 / K24Z2)",
    interchangeCode: "ENG-HONDA-K24",
    description: "2.4L 4-Cylinder i-VTEC Engine Assembly",
    compatibleModels: [
      { make: "Honda", model: "Accord", startYear: 2003, endYear: 2012, notes: "K24A4 / K24Z2" },
      { make: "Honda", model: "CR-V", startYear: 2002, endYear: 2014, notes: "K24A1 / K24Z6" },
      { make: "Honda", model: "Element", startYear: 2003, endYear: 2011, notes: "K24A4 / K24A8" },
      { make: "Acura", model: "TSX", startYear: 2004, endYear: 2014, notes: "High compression K24A2" },
    ],
  },
];

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