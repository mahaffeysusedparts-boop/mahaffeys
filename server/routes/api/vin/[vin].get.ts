import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { requireUser } from "../../../utils/auth";

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

interface NhtsaVinResult {
  VIN?: string;
  Make?: string;
  Model?: string;
  ModelYear?: string;
  Trim?: string;
  Series?: string;
  BodyClass?: string;
  VehicleType?: string;
  DriveType?: string;
  Doors?: string;
  EngineCylinders?: string;
  DisplacementL?: string;
  EngineModel?: string;
  EngineHP?: string;
  FuelTypePrimary?: string;
  FuelTypeSecondary?: string;
  ElectrificationLevel?: string;
  TransmissionStyle?: string;
  TransmissionSpeeds?: string;
  Manufacturer?: string;
  PlantCountry?: string;
  PlantCity?: string;
  PlantState?: string;
  ErrorCode?: string;
  ErrorText?: string;
}

const text = (value?: string) => value?.trim() || null;
const number = (value?: string) => {
  const parsed = Number(value);
  return value?.trim() && Number.isFinite(parsed) ? parsed : null;
};

export default defineHandler(async (event) => {
  await requireUser(event);
  const vin = (getRouterParam(event, "vin") || "").trim().toUpperCase();
  if (!VIN_PATTERN.test(vin)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Enter a complete 17-character VIN without I, O, or Q",
    });
  }

  let response: Response;
  try {
    response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vin)}?format=json`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch {
    throw createError({ statusCode: 503, statusMessage: "The NHTSA VIN service is unavailable" });
  }

  if (!response.ok) {
    throw createError({ statusCode: 502, statusMessage: "The NHTSA VIN service returned an error" });
  }

  const payload = await response.json() as { Results?: NhtsaVinResult[] };
  const result = payload.Results?.[0];
  if (!result || !text(result.Make) || !text(result.Model)) {
    throw createError({
      statusCode: 422,
      statusMessage: text(result?.ErrorText) || "NHTSA could not identify this VIN",
    });
  }

  return {
    vin,
    year: number(result.ModelYear),
    make: text(result.Make),
    model: text(result.Model),
    trim: text(result.Trim),
    series: text(result.Series),
    bodyClass: text(result.BodyClass),
    vehicleType: text(result.VehicleType),
    driveType: text(result.DriveType),
    doors: number(result.Doors),
    engineCylinders: number(result.EngineCylinders),
    engineSizeLiters: number(result.DisplacementL),
    engineModel: text(result.EngineModel),
    engineHorsepower: number(result.EngineHP),
    fuelType: text(result.FuelTypePrimary),
    secondaryFuelType: text(result.FuelTypeSecondary),
    electrificationLevel: text(result.ElectrificationLevel),
    transmissionStyle: text(result.TransmissionStyle),
    transmissionSpeeds: number(result.TransmissionSpeeds),
    manufacturer: text(result.Manufacturer),
    plantCountry: text(result.PlantCountry),
    plantCity: text(result.PlantCity),
    plantState: text(result.PlantState),
    decoderMessage: text(result.ErrorText),
    source: "NHTSA vPIC",
  };
});
