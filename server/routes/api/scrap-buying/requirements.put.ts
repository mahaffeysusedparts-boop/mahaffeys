import { defineHandler } from 'nitro';
import { assertBodySize, readBody, createError } from 'nitro/h3';
import { z } from 'zod';
import { requireAdmin } from '../../../utils/auth';
import { withTransaction } from '../../../utils/db';
import { lockFinancialState, putState, stateValue } from '../../../utils/financialState';
import { DEFAULT_INTAKE_REQUIREMENTS, normalizeIntakeRequirements, type IntakeRequirements } from '../../../../src/types/intakeRequirements';

export default defineHandler(async (event) => {
  const user = await requireAdmin(event);
  assertBodySize(event, 4096);
  const parsed = z.object({
    requirePhotos: z.boolean(), requirePhone: z.boolean(), requireAddress: z.boolean(),
    requireSellerId: z.boolean(), requireVehiclePlate: z.boolean(), requireExplicitReview: z.boolean(),
    revision: z.number().int().nonnegative(), reason: z.string().trim().min(1).max(500),
  }).strict().safeParse(await readBody(event));
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Choose the requirements and enter a reason for the change' });
  return withTransaction(async (client) => {
    await lockFinancialState(client);
    const current = normalizeIntakeRequirements(await stateValue<IntakeRequirements>(client, 'mahaffeys_intake_requirements', DEFAULT_INTAKE_REQUIREMENTS));
    if (parsed.data.revision !== current.revision) throw createError({ statusCode: 409, statusMessage: 'Requirements changed on another workstation. Reload before saving.' });
    const next: IntakeRequirements = { ...parsed.data, revision: current.revision + 1, updatedAt: new Date().toISOString(), updatedBy: user.fullName };
    await putState(client, `mahaffeys_intake_requirements_revision_${next.revision}`, next, user.id);
    await putState(client, 'mahaffeys_intake_requirements', next, user.id);
    return next;
  });
});
