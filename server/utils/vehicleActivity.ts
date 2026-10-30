import { randomUUID } from 'node:crypto';
import { createError } from 'nitro/h3';
import { z } from 'zod';
import type { PullYardVehicle } from '../../src/types/scrap';
import type { VehicleHistoryEvent } from '../../src/types/vehicleActivity';
import { VEHICLE_SECTIONS } from '../../src/types/vehicleActivity';
import { isCrushLocked, type HoldOptions } from '../../src/utils/holdUtils';

const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().filter(key => (value as Record<string, unknown>)[key] !== undefined).map(key => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
};
const schema = z.object({ id: z.string().min(1).max(120), section: z.enum(VEHICLE_SECTIONS),
  rowNumber: z.number().int().min(1).max(9999).optional(), year: z.number().int().min(1886).max(2100),
  make: z.string().max(200), model: z.string().max(200), vin: z.string().min(1).max(120),
  color: z.string().max(100), dateSetInYard: z.string().refine(value => Number.isFinite(Date.parse(value))), status: z.enum(['PENDING','AVAILABLE','CRUSHED']),
  photoUrl: z.string().refine(value => !value || /^\/api\/uploads\/[a-f0-9-]+$/i.test(value) || /^data:image\/(jpeg|png|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(value) || /^data:image\/svg\+xml;/i.test(value) || /^https?:\/\//i.test(value), 'Invalid vehicle photo URL').optional(),
  holdUntil: z.string().datetime().optional(), holdOverride: z.object({ by: z.string(), at: z.string(), reason: z.string().trim().min(1).max(2000) }).optional(),
  partsRemaining: z.array(z.string().trim().min(1).max(200)).max(500), dismantlingLog: z.object({
    catalyticConvertersRemoved: z.number().finite().nonnegative(), wheelsRemoved: z.number().finite().nonnegative(),
    gasDrained: z.boolean(), oilDrained: z.boolean(), notes: z.string().optional(), updatedAt: z.string().optional(),
  }).passthrough(), vehicleRevision: z.number().int().nonnegative().optional(),
}).passthrough();

export function recordVehicleChanges(previous: PullYardVehicle | undefined, next: PullYardVehicle, actor: string, at = new Date().toISOString()): PullYardVehicle {
  const events: VehicleHistoryEvent[] = [];
  const add = (kind: VehicleHistoryEvent['kind'], description: string, photoUrl?: string) => events.push({ id: randomUUID(), kind, description, at, actor, ...(photoUrl ? { photoUrl } : {}) });
  if (!previous) add('INTAKE', `Vehicle registered in ${next.section}${next.rowNumber ? ` · Row ${next.rowNumber}` : ''}. Status: ${next.status}.`);
  if (previous && (previous.section !== next.section || previous.rowNumber !== next.rowNumber)) {
    add('LOCATION', `${previous.section}${previous.rowNumber ? ` · Row ${previous.rowNumber}` : ''} → ${next.section}${next.rowNumber ? ` · Row ${next.rowNumber}` : ''}`);
  }
  if (previous && previous.status !== next.status) add('STATUS', `${previous.status} → ${next.status}${next.holdOverride?.reason ? ` · Hold override: ${next.holdOverride.reason}` : ''}`);
  if (previous?.photoUrl && previous.photoUrl !== next.photoUrl && !previous.history?.some(event => event.photoUrl === previous.photoUrl)) add('PHOTO', 'Previous vehicle photo retained; original capture date not recorded.', previous.photoUrl);
  if (next.photoUrl && previous?.photoUrl !== next.photoUrl) add('PHOTO', previous?.photoUrl ? 'Vehicle photo updated.' : 'Vehicle photo added.', next.photoUrl);
  if (previous?.photoUrl && !next.photoUrl) add('PHOTO', 'Primary vehicle photo cleared; earlier photo retained in history.');
  if (previous) {
    const nextNames = new Set(next.partsRemaining.map(name => name.toLowerCase()));
    for (const part of previous.partsRemaining.filter(name => !nextNames.has(name.toLowerCase()))) add('PART', `${part} removed from the listed components; availability changed to Removed.`);
    for (const field of ['catalyticConvertersRemoved','wheelsRemoved'] as const) {
      const difference = next.dismantlingLog[field] - previous.dismantlingLog[field];
      if (difference > 0) add('PART', `${difference} ${field === 'wheelsRemoved' ? 'wheel(s)' : 'catalytic converter(s)'} removed in the dismantling log.`);
    }
    if (stable(previous.dismantlingLog) !== stable(next.dismantlingLog)) add('PROCESSING', `Dismantling log updated. Gas: ${next.dismantlingLog.gasDrained ? 'drained' : 'not drained'}; oil: ${next.dismantlingLog.oilDrained ? 'drained' : 'not drained'}.${next.dismantlingLog.notes ? ` ${next.dismantlingLog.notes}` : ''}`);
    if (['year','make','model','vin','color','notes','originSource','purchasePrice'].some(field => previous[field as keyof PullYardVehicle] !== next[field as keyof PullYardVehicle])) add('DETAILS', 'Vehicle details updated.');
  }
  const checks = [...(previous?.partChecks ?? [])];
  if (previous) {
    const oldNames = new Map(previous.partsRemaining.map(name => [name.toLowerCase(), name]));
    const newNames = new Set(next.partsRemaining.map(name => name.toLowerCase()));
    for (const [key, name] of oldNames) {
      if (!newNames.has(key)) {
        const index = checks.findIndex(part => part.name.toLowerCase() === key);
        const removed = { name, status: 'REMOVED' as const, checkedBy: actor, checkedAt: at };
        if (index === -1) checks.push(removed); else checks[index] = removed;
      }
    }
    for (const name of next.partsRemaining) {
      const index = checks.findIndex(part => part.name.toLowerCase() === name.toLowerCase());
      if (!oldNames.has(name.toLowerCase()) && index !== -1 && checks[index].status === 'REMOVED') checks[index] = { name, status: 'NOT_CHECKED', checkedBy: actor, checkedAt: at };
    }
  }
  return { ...next, partChecks: checks, history: [...(previous?.history ?? []), ...events], vehicleRevision: (previous?.vehicleRevision ?? 0) + 1 };
}

export function protectVehicleChanges(previous: PullYardVehicle[], incoming: unknown, actor: string, role: string, holdOptions: HoldOptions) {
  const parsed = z.array(schema).safeParse(incoming);
  if (!parsed.success || new Set(parsed.data.map(row => row.id)).size !== parsed.data.length) throw createError({ statusCode: 400, statusMessage: 'Vehicle inventory requires valid uniquely identified records' });
  const rows = (parsed.data as PullYardVehicle[]).map(next => {
    const old = previous.find(row => row.id === next.id);
    if (old) next.dateSetInYard = old.dateSetInYard;
    if (old?.holdUntil) next.holdUntil = old.holdUntil;
    if (next.holdOverride && stable(next.holdOverride) !== stable(old?.holdOverride)) {
      if (role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Only an administrator can authorize a title-hold override' });
      next.holdOverride = { by: actor, at: new Date().toISOString(), reason: next.holdOverride.reason };
    } else next.holdOverride = old?.holdOverride;
    if (next.status === 'CRUSHED' && old?.status !== 'CRUSHED' && isCrushLocked({ holdUntil: next.holdUntil, startDateFallback: next.dateSetInYard }, new Date(), holdOptions, next.holdOverride)) throw createError({ statusCode: 409, statusMessage: `Vehicle ${next.vin} is under a title hold. An administrator override is required.` });
    const visible = (vehicle: PullYardVehicle) => {
      const { history, partChecks, vehicleRevision, ...fields } = vehicle;
      return stable(fields);
    };
    if (old && visible(old) === visible(next)) return old;
    if (old && (next.vehicleRevision ?? 0) !== (old.vehicleRevision ?? 0)) throw createError({ statusCode: 409, statusMessage: `Vehicle ${old.vin} changed on another workstation. Refresh before saving.` });
    return recordVehicleChanges(old, next, actor);
  });
  return [...rows, ...previous.filter(old => !rows.some(next => next.id === old.id))];
}
