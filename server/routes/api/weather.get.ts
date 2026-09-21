import { defineHandler } from "nitro";
import { createError, getQuery } from "nitro/h3";
import { useRuntimeConfig } from "nitro/runtime-config";

interface WeatherPayload {
  location: string;
  temperatureF: number;
  condition: string;
  windMph: number;
  humidity: number;
  iconCode: number;
}

export default defineHandler(async (event): Promise<WeatherPayload> => {
  const query = getQuery(event);
  const latitude = Number(query.lat ?? 39.8283);
  const longitude = Number(query.lon ?? -98.5795);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw createError({ statusCode: 400, statusMessage: "Valid latitude and longitude are required" });
  }

  const config = useRuntimeConfig();
  const apiKey = String(config.weatherApiKey || "");

  try {
    if (apiKey) {
      const response = await fetch(`https://api.weatherapi.com/v1/current.json?key=${encodeURIComponent(apiKey)}&q=${latitude},${longitude}&aqi=no`);
      if (!response.ok) throw new Error("Weather provider request failed");
      const data = await response.json() as {
        location: { name: string; region: string };
        current: { temp_f: number; condition: { text: string; code: number }; wind_mph: number; humidity: number };
      };
      return {
        location: `${data.location.name}, ${data.location.region}`,
        temperatureF: Math.round(data.current.temp_f),
        condition: data.current.condition.text,
        windMph: Math.round(data.current.wind_mph),
        humidity: data.current.humidity,
        iconCode: data.current.condition.code,
      };
    }

    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph`);
    if (!response.ok) throw new Error("Weather provider request failed");
    const data = await response.json() as {
      current: { temperature_2m: number; relative_humidity_2m: number; weather_code: number; wind_speed_10m: number };
    };
    const descriptions: Record<number, string> = { 0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Foggy", 48: "Icy fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow", 80: "Rain showers", 81: "Rain showers", 82: "Heavy showers", 95: "Thunderstorms" };
    return {
      location: "Local yard",
      temperatureF: Math.round(data.current.temperature_2m),
      condition: descriptions[data.current.weather_code] ?? "Current conditions",
      windMph: Math.round(data.current.wind_speed_10m),
      humidity: data.current.relative_humidity_2m,
      iconCode: data.current.weather_code,
    };
  } catch {
    throw createError({ statusCode: 502, statusMessage: "Weather data is temporarily unavailable" });
  }
});
