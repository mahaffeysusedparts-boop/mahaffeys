import type { H3Event } from 'nitro/h3';
import { createError, setResponseHeader } from 'nitro/h3';
import type { PoolClient } from 'pg';
import { requireUser } from './auth';
import { query } from './db';
import { mergeInventory } from './inventory';
import { hasPageAccess } from '../../src/utils/pageAccess';
import type { PullYardVehicle, Ticket, YardMapItem } from '../../src/types/scrap';

export async function yardVehicleUser(event: H3Event) {
  const user = await requireUser(event);
  const settings = (await query("SELECT value FROM app_state WHERE key='mahaffeys_settings'")).rows[0]?.value;
  if (!hasPageAccess(user.role, 'pull-a-part', settings?.rolePageAccess)) throw createError({ statusCode: 403, statusMessage: 'Vehicle workstation access required' });
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  return user;
}
export async function readYardVehicles(client?: PoolClient) {
  const result = client ? await client.query("SELECT key,value FROM app_state WHERE key=ANY($1::text[])", [['mahaffeys_pull_yard_vehicles','mahaffeys_tickets','mahaffeys_removed_inventory_vehicles','mahaffeys_yard_layout','mahaffeys_settings']])
    : await query("SELECT key,value FROM app_state WHERE key=ANY($1::text[])", [['mahaffeys_pull_yard_vehicles','mahaffeys_tickets','mahaffeys_removed_inventory_vehicles','mahaffeys_yard_layout','mahaffeys_settings']]);
  const state = new Map(result.rows.map(row => [row.key, row.value]));
  const stored = (state.get('mahaffeys_pull_yard_vehicles') ?? []) as PullYardVehicle[];
  const tickets = (state.get('mahaffeys_tickets') ?? []) as Ticket[];
  return { stored, tickets, vehicles: mergeInventory(stored, tickets, (state.get('mahaffeys_removed_inventory_vehicles') ?? []) as string[]),
    layout: (state.get('mahaffeys_yard_layout') ?? []) as YardMapItem[], settings: state.get('mahaffeys_settings') ?? {} };
}
