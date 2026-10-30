import { defineHandler } from 'nitro';
import { createError, getRouterParam } from 'nitro/h3';
import { requireUser } from '../../../../utils/auth';
import { query } from '../../../../utils/db';
import type { Ticket } from '../../../../../src/types/scrap';

export default defineHandler(async event => {
  await requireUser(event);
  const id = getRouterParam(event, 'id');
  if (!id || id.length > 120) throw createError({ statusCode: 400, statusMessage: 'Invalid customer ID' });
  const result = await query<{ document: Ticket }>(`
    WITH all_tickets AS (
      SELECT document, 1 AS priority FROM scrap_buying_tickets WHERE document->>'customerId' = $1
      UNION ALL
      SELECT item, 0 AS priority FROM app_state,
        jsonb_array_elements(CASE WHEN jsonb_typeof(value) = 'array' THEN value ELSE '[]'::jsonb END) item
      WHERE key = 'mahaffeys_tickets' AND item->>'customerId' = $1
    ), unique_tickets AS (
      SELECT DISTINCT ON (document->>'id') document FROM all_tickets
      ORDER BY document->>'id', priority DESC
    )
    SELECT document FROM unique_tickets WHERE document->>'status' != 'VOIDED'
    ORDER BY document->>'createdAt' DESC LIMIT 100
  `, [id]);
  const tickets = result.rows.map(row => row.document);
  const counts = new Map<string, { name: string; visits: number }>();
  for (const ticket of tickets) {
    for (const name of new Set((ticket.scrapLines ?? []).map(line => line.metalName))) {
      const entry = counts.get(name) ?? { name, visits: 0 };
      entry.visits++; counts.set(name, entry);
    }
  }
  const previous = tickets[0];
  const vehicle = tickets.find(ticket => ticket.carRecord)?.carRecord;
  return {
    previousTicket: previous ? { id: previous.id, createdAt: previous.createdAt, status: previous.status, vehicleLicensePlate: previous.vehicleLicensePlate } : null,
    lastVehicle: vehicle ? { year: vehicle.year, make: vehicle.make, model: vehicle.model, vin: vehicle.vin } : null,
    commonMaterials: [...counts.values()].sort((a, b) => b.visits - a.visits).slice(0, 5),
    historyCount: tickets.length,
  };
});
