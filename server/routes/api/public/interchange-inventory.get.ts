import { defineHandler } from 'nitro';
import { setResponseHeader } from 'nitro/h3';
import type { PullYardVehicle, Ticket } from '../../../../src/types/scrap';
import { query } from '../../../utils/db';
import { mergeInventory } from '../../../utils/inventory';

export default defineHandler(async (event) => {
  const result = await query<{ key: string; value: unknown }>('SELECT key, value FROM app_state WHERE key = ANY($1::text[])', [['mahaffeys_pull_yard_vehicles', 'mahaffeys_tickets', 'mahaffeys_removed_inventory_vehicles']]);
  const state = new Map(result.rows.map((row) => [row.key, row.value]));
  const vehicles = Array.isArray(state.get('mahaffeys_pull_yard_vehicles')) ? state.get('mahaffeys_pull_yard_vehicles') as PullYardVehicle[] : [];
  const tickets = Array.isArray(state.get('mahaffeys_tickets')) ? state.get('mahaffeys_tickets') as Ticket[] : [];
  const removed = Array.isArray(state.get('mahaffeys_removed_inventory_vehicles')) ? state.get('mahaffeys_removed_inventory_vehicles') as string[] : [];
  setResponseHeader(event, 'Cache-Control', 'no-store');
  return mergeInventory(vehicles, tickets, removed).filter((vehicle) => vehicle.status !== 'CRUSHED').map(({ id, make, model, year, status, section, rowNumber, color }) => ({ id, make, model, year, status, section, rowNumber, color }));
});
