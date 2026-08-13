export interface VinDecodeResult {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  series: string | null;
  bodyClass: string | null;
  vehicleType: string | null;
  driveType: string | null;
  doors: number | null;
  engineCylinders: number | null;
  engineSizeLiters: number | null;
  engineModel: string | null;
  engineHorsepower: number | null;
  fuelType: string | null;
  secondaryFuelType: string | null;
  electrificationLevel: string | null;
  transmissionStyle: string | null;
  transmissionSpeeds: number | null;
  manufacturer: string | null;
  plantCountry: string | null;
  plantCity: string | null;
  plantState: string | null;
  decoderMessage: string | null;
  source: "NHTSA vPIC";
}

interface ApiError {
  statusMessage?: string;
  message?: string;
}

export async function decodeVin(vin: string): Promise<VinDecodeResult> {
  const normalizedVin = vin.trim().toUpperCase();
  const response = await fetch(`/api/vin/${encodeURIComponent(normalizedVin)}`, {
    credentials: "include",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as ApiError | null;
    throw new Error(body?.statusMessage || body?.message || "VIN lookup failed");
  }
  return response.json() as Promise<VinDecodeResult>;
}
