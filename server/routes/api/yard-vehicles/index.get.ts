import { defineHandler } from 'nitro';
import { yardVehicleUser, readYardVehicles } from '../../../utils/yardVehicles';

export default defineHandler(async event => {
  await yardVehicleUser(event);
  return { vehicles: (await readYardVehicles()).vehicles };
});
