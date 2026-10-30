import { defineHandler } from 'nitro';
import { createError, readBody } from 'nitro/h3';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { withTransaction } from '../../../utils/db';
import { lockFinancialState, putState } from '../../../utils/financialState';
import { yardVehicleUser, readYardVehicles } from '../../../utils/yardVehicles';
import { recordVehicleChanges } from '../../../utils/vehicleActivity';
import { VEHICLE_SECTIONS } from '../../../../src/types/vehicleActivity';
import { isCrushLocked } from '../../../../src/utils/holdUtils';
import type { PullYardVehicle } from '../../../../src/types/scrap';
import { vehiclePreviewSnapshot } from '../../../../src/utils/vehicleRecords';

const target = z.object({ id: z.string().min(1).max(120), revision: z.number().int().nonnegative(), snapshot: z.string().min(1).max(2000) }).strict();
const patch = z.object({ section: z.enum(VEHICLE_SECTIONS).optional(), rowNumber: z.number().int().min(1).max(9999).nullable().optional(), status: z.enum(['PENDING','AVAILABLE','CRUSHED']).optional() }).strict().refine(value => Object.keys(value).length > 0, 'Choose at least one change');
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('BULK'), targets: z.array(target).min(1).max(500), patch }).strict(),
  z.object({ action: z.literal('PART'), target, name: z.string().trim().min(1).max(200), status: z.enum(['NOT_CHECKED','AVAILABLE','REMOVED']), notes: z.string().trim().max(1000).optional() }).strict(),
  z.object({ action: z.literal('PHOTO'), target, photoUrl: z.string().regex(/^\/api\/uploads\/[a-f0-9-]+$/i) }).strict(),
]);
export default defineHandler(async event => {
  const user = await yardVehicleUser(event);
  const parsed = schema.safeParse(await readBody(event, { limit: 256 * 1024 }));
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Invalid vehicle change' });
  const command = parsed.data;
  return withTransaction(async client => {
    await lockFinancialState(client);
    const state = await readYardVehicles(client);
    const targets = command.action === 'BULK' ? command.targets : [command.target];
    if (new Set(targets.map(row => row.id)).size !== targets.length) throw createError({ statusCode: 400, statusMessage: 'Duplicate selected vehicles' });
    const at = new Date().toISOString();
    const changes = new Map<string, PullYardVehicle>();
    for (const target of targets) {
      const previous = state.vehicles.find(vehicle => vehicle.id === target.id);
      if (!previous) throw createError({ statusCode: 409, statusMessage: 'A selected vehicle was removed. Refresh the preview.' });
      if ((previous.vehicleRevision ?? 0) !== target.revision || vehiclePreviewSnapshot(previous) !== target.snapshot) throw createError({ statusCode: 409, statusMessage: `${previous.vin} changed since the preview. Refresh and review all changes again.` });
      let next: PullYardVehicle;
      if (command.action === 'BULK') {
        const { rowNumber, ...fields } = command.patch;
        next = { ...previous, ...fields, ...(rowNumber !== undefined ? { rowNumber: rowNumber ?? undefined } : {}) };
        if (next.status === 'CRUSHED' && previous.status !== 'CRUSHED' && isCrushLocked({ holdUntil: previous.holdUntil, startDateFallback: previous.dateSetInYard }, new Date(), { enabled: state.settings.crushHoldEnabled !== false, crushHoldDays: state.settings.crushHoldDays ?? 30 }, previous.holdOverride)) {
          throw createError({ statusCode: 409, statusMessage: `${previous.vin} is under a title hold. No bulk changes were applied. Use the individual administrator hold-override workflow first.` });
        }
        next = recordVehicleChanges(previous, next, user.fullName, at);
      } else if (command.action === 'PART') {
        if (previous.status === 'CRUSHED' && command.status === 'AVAILABLE') throw createError({ statusCode: 409, statusMessage: 'A crushed vehicle cannot have confirmed available parts' });
        const oldCheck = previous.partChecks?.find(part => part.name.toLowerCase() === command.name.toLowerCase());
        const name = oldCheck?.name ?? previous.partsRemaining.find(part => part.toLowerCase() === command.name.toLowerCase()) ?? command.name;
        const check = { name, status: command.status, checkedBy: user.fullName, checkedAt: at, ...(command.notes ? { notes: command.notes } : {}) };
        const remaining = previous.partsRemaining.filter(part => part.toLowerCase() !== name.toLowerCase());
        if (command.status !== 'REMOVED') remaining.push(name);
        next = { ...previous, partsRemaining: remaining, partChecks: [...(previous.partChecks ?? []).filter(part => part.name.toLowerCase() !== name.toLowerCase()), check],
          vehicleRevision: (previous.vehicleRevision ?? 0) + 1,
          history: [...(previous.history ?? []), { id: randomUUID(), kind: 'PART', at, actor: user.fullName, description: `${name}: ${command.status === 'AVAILABLE' ? 'confirmed available' : command.status === 'REMOVED' ? 'removed' : 'marked not checked'}.${command.notes ? ` ${command.notes}` : ''}` }] };
      } else next = recordVehicleChanges(previous, { ...previous, photoUrl: command.photoUrl }, user.fullName, at);
      changes.set(previous.id, next);
    }
    const vehicles = state.vehicles.map(vehicle => changes.get(vehicle.id) ?? vehicle);
    await putState(client, 'mahaffeys_pull_yard_vehicles', vehicles, user.id);
    return { vehicles, changedIds: [...changes.keys()] };
  });
});
