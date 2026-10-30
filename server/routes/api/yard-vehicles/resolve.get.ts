import { defineHandler } from 'nitro';
import { createError, getQuery } from 'nitro/h3';
import { yardVehicleUser, readYardVehicles } from '../../../utils/yardVehicles';

export default defineHandler(async event => {
  await yardVehicleUser(event);
  const raw = getQuery(event);
  const id = typeof raw.id === 'string' ? raw.id : '';
  const vin = typeof raw.vin === 'string' ? raw.vin.trim().toUpperCase() : '';
  if ((!id && !vin) || id.length > 120 || vin.length > 120) throw createError({ statusCode: 400, statusMessage: 'Enter a vehicle VIN or record ID' });
  const { vehicles } = await readYardVehicles();
  const vehicle = vehicles.find(row => id ? row.id === id : row.vin.toUpperCase() === vin);
  if (!vehicle) throw createError({ statusCode: 404, statusMessage: 'No vehicle record matches this tag' });
  return { id: vehicle.id };
});
