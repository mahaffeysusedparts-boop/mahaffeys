import type { PullYardVehicle, Ticket } from "../../src/types/scrap";

export interface InventoryQuery {
  page: number;
  limit: number;
  search?: string;
  section?: string;
  part?: string;
  status?: PullYardVehicle["status"];
  excludeCrushed?: boolean;
  yearMin?: number;
  yearMax?: number;
  priceMin?: number;
  priceMax?: number;
  sort: string;
}

export interface InventoryResult {
  items: PullYardVehicle[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts: {
    available: number;
    pending: number;
    crushed: number;
  };
}

const sectionForMake = (make: string): PullYardVehicle["section"] => {
  const normalized = make.toLowerCase();
  if (["ford", "lincoln", "mercury"].some((brand) => normalized.includes(brand))) return "Ford & Lincoln";
  if (["chevrolet", "chevy", "gmc", "buick", "cadillac"].some((brand) => normalized.includes(brand))) return "GM & Chevrolet";
  if (["chrysler", "dodge", "jeep", "ram"].some((brand) => normalized.includes(brand))) return "Chrysler & Dodge";
  if (["toyota", "nissan", "honda", "subaru", "mazda", "mitsubishi", "hyundai", "kia", "lexus", "acura", "infiniti"].some((brand) => normalized.includes(brand))) return "Asian Imports";
  if (["bmw", "mercedes", "audi", "volkswagen", "volvo", "porsche", "mini", "jaguar", "land rover"].some((brand) => normalized.includes(brand))) return "European";
  return "Domestic Trucks & SUVs";
};

const normalizeVehicle = (vehicle: PullYardVehicle): PullYardVehicle => ({
  ...vehicle,
  status: vehicle.status === "PENDING" ? "PENDING" : vehicle.status === "CRUSHED" ? "CRUSHED" : "AVAILABLE",
  partsRemaining: Array.isArray(vehicle.partsRemaining) ? vehicle.partsRemaining : [],
  dismantlingLog: vehicle.dismantlingLog || {
    catalyticConvertersRemoved: 0,
    wheelsRemoved: 0,
    gasDrained: false,
    oilDrained: false,
  },
});

const vehicleFromTicket = (ticket: Ticket): PullYardVehicle | null => {
  const car = ticket.carRecord;
  if (ticket.ticketType !== "CAR_SALVAGE" || ticket.status === "VOIDED" || !car) return null;
  return {
    id: `veh-ticket-${ticket.id}`,
    sourceTicketId: ticket.id,
    section: sectionForMake(car.make),
    year: car.year,
    make: car.make,
    model: car.model,
    trim: car.trim,
    color: car.color,
    vin: car.vin,
    engineSizeLiters: car.engineSizeLiters,
    engineCylinders: car.engineCylinders,
    engineModel: car.engineModel,
    fuelType: car.fuelType,
    dateSetInYard: ticket.createdAt,
    status: car.yardStatus || "PENDING",
    partsRemaining: ["Engine Assembly", "Transmission", "Doors", "Wheels", "Headlights", "Fenders"],
    photoUrl: car.photoUrl || ticket.complianceCaptures?.vehiclePhotoUrl,
    purchasePrice: car.purchasePrice ?? ticket.finalPayout,
    originSource: car.originSource || "Tow Intake",
    notes: car.notes || ticket.notes,
    dismantlingLog: {
      catalyticConvertersRemoved: 0,
      wheelsRemoved: 0,
      gasDrained: Boolean(car.fluidsDrained),
      oilDrained: Boolean(car.fluidsDrained),
    },
  };
};

export function mergeInventory(vehicles: PullYardVehicle[], tickets: Ticket[], removedIds: string[]) {
  const normalized = vehicles.map(normalizeVehicle);
  const removed = new Set(removedIds);
  const linkedTicketIds = new Set(normalized.map((vehicle) => vehicle.sourceTicketId).filter(Boolean));
  const knownVins = new Set(normalized.map((vehicle) => vehicle.vin.toUpperCase()));
  const recovered = tickets
    .map(vehicleFromTicket)
    .filter((vehicle): vehicle is PullYardVehicle => Boolean(
      vehicle
      && !removed.has(vehicle.id)
      && !linkedTicketIds.has(vehicle.sourceTicketId)
      && !knownVins.has(vehicle.vin.toUpperCase()),
    ));
  return [...recovered, ...normalized].filter((vehicle) => !removed.has(vehicle.id));
}

export function queryInventory(vehicles: PullYardVehicle[], query: InventoryQuery): InventoryResult {
  const search = query.search?.trim().toLowerCase() || "";
  const part = query.part?.trim().toLowerCase() || "";
  const matches = vehicles.filter((vehicle) => {
    const haystack = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ""} ${vehicle.vin} ${vehicle.section}`.toLowerCase();
    return (!search || haystack.includes(search))
      && (!query.section || vehicle.section === query.section)
      && (!part || vehicle.partsRemaining.some((item) => item.toLowerCase().includes(part)))
      && (!query.status || vehicle.status === query.status)
      && (!query.excludeCrushed || vehicle.status !== "CRUSHED")
      && (query.yearMin === undefined || vehicle.year >= query.yearMin)
      && (query.yearMax === undefined || vehicle.year <= query.yearMax)
      && (query.priceMin === undefined || (vehicle.purchasePrice ?? 0) >= query.priceMin)
      && (query.priceMax === undefined || (vehicle.purchasePrice ?? 0) <= query.priceMax);
  });

  const counts = matches.reduce((result, vehicle) => {
    if (vehicle.status === "AVAILABLE") result.available += 1;
    else if (vehicle.status === "PENDING") result.pending += 1;
    else result.crushed += 1;
    return result;
  }, { available: 0, pending: 0, crushed: 0 });

  const [field, direction = "asc"] = query.sort.split("_");
  const multiplier = direction === "desc" ? -1 : 1;
  matches.sort((left, right) => {
    let comparison = 0;
    if (field === "dateSetInYard") comparison = new Date(left.dateSetInYard).getTime() - new Date(right.dateSetInYard).getTime();
    else if (field === "year") comparison = left.year - right.year;
    else if (field === "price") comparison = (left.purchasePrice ?? 0) - (right.purchasePrice ?? 0);
    else if (field === "model") comparison = left.model.toLowerCase() < right.model.toLowerCase() ? -1 : left.model.toLowerCase() > right.model.toLowerCase() ? 1 : 0;
    else comparison = left.make.toLowerCase() < right.make.toLowerCase() ? -1 : left.make.toLowerCase() > right.make.toLowerCase() ? 1 : 0;
    if (comparison !== 0) return comparison * multiplier;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });

  const total = matches.length;
  const totalPages = Math.max(1, Math.ceil(total / query.limit));
  const page = Math.min(query.page, totalPages);
  const offset = (page - 1) * query.limit;
  return {
    items: matches.slice(offset, offset + query.limit),
    total,
    page,
    limit: query.limit,
    totalPages,
    counts,
  };
}
