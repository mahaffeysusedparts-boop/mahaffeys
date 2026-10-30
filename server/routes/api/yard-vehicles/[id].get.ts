import { defineHandler } from 'nitro';
import { createError, getRouterParam } from 'nitro/h3';
import { yardVehicleUser, readYardVehicles } from '../../../utils/yardVehicles';

export default defineHandler(async event => {
  await yardVehicleUser(event);
  const id = getRouterParam(event, 'id');
  const { vehicles, tickets, layout } = await readYardVehicles();
  const vehicle = vehicles.find(row => row.id === id);
  if (!vehicle) throw createError({ statusCode: 404, statusMessage: 'Vehicle not found or removed from inventory' });
  const source = tickets.find(ticket => ticket.id === vehicle.sourceTicketId || (ticket.ticketType === 'CAR_SALVAGE' && ticket.carRecord?.vin.toUpperCase() === vehicle.vin.toUpperCase()));
  return { vehicle, mapItems: layout.filter(item => item.linkedEntityType === 'VEHICLE' && item.linkedEntityId === id && !item.deletedAt),
    intake: source ? { id: source.id, at: source.createdAt, actor: source.operatorName, photos: [...new Set([source.carRecord?.photoUrl, source.complianceCaptures?.vehiclePhotoUrl].filter((url): url is string => !!url))] } : null };
});
