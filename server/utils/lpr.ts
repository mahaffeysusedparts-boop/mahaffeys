export interface LprCustomer {
  id: string;
  fullName: string;
  phone: string;
  idNumber: string;
  address: string;
  vehicleLicensePlate?: string;
  vehicleState?: string;
  idPhotoUrl?: string;
  capturedPlates?: string[];
}

export function normalizePlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function findCustomerByPlate(customers: LprCustomer[], plate: string) {
  const normalized = normalizePlate(plate);
  if (!normalized) return null;

  return customers.find((customer) => {
    const knownPlates = [customer.vehicleLicensePlate, ...(customer.capturedPlates || [])];
    return knownPlates.some((knownPlate) => knownPlate && normalizePlate(knownPlate) === normalized);
  }) || null;
}
