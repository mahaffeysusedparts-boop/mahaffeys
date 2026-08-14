import { createError } from "nitro/h3";
import { query } from "./db";

export interface VinDecode { vin: string; year: number | null; make: string | null; model: string | null; bodyClass: string | null; fuelType: string | null; manufacturer: string | null; decoderMessage: string | null; source: "NHTSA vPIC" }
const text = (value?: string) => value?.trim() || null;

export async function decodeVinWithNhtsa(vin: string): Promise<VinDecode> {
  const cached = await query<{ decode: VinDecode }>("SELECT decode FROM vin_decode_cache WHERE vin = $1 AND expires_at > NOW()", [vin]);
  if (cached.rows[0]) return cached.rows[0].decode;
  let response: Response;
  try {
    response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vin)}?format=json`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
  } catch {
    throw createError({ statusCode: 503, statusMessage: "NHTSA decode unavailable; the local VIN has been retained." });
  }
  if (!response.ok) throw createError({ statusCode: 502, statusMessage: "NHTSA decode returned an error" });
  const payload = await response.json() as { Results?: Array<Record<string, string>> };
  const row = payload.Results?.[0];
  if (!row) throw createError({ statusCode: 502, statusMessage: "NHTSA returned no VIN record" });
  const decoded: VinDecode = { vin, year: Number(row.ModelYear) || null, make: text(row.Make), model: text(row.Model), bodyClass: text(row.BodyClass), fuelType: text(row.FuelTypePrimary), manufacturer: text(row.Manufacturer), decoderMessage: text(row.ErrorText), source: "NHTSA vPIC" };
  await query("INSERT INTO vin_decode_cache (vin, decode, expires_at) VALUES ($1, $2, NOW() + INTERVAL '30 days') ON CONFLICT (vin) DO UPDATE SET decode = EXCLUDED.decode, fetched_at = NOW(), expires_at = EXCLUDED.expires_at", [vin, JSON.stringify(decoded)]);
  return decoded;
}
