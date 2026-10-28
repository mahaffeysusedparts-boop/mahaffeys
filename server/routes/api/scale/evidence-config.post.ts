import { defineHandler } from 'nitro';
import { createError, readBody } from 'nitro/h3';
import { z } from 'zod';
import { requireUser } from '../../../utils/auth';
import { withTransaction } from '../../../utils/db';
import { lockFinancialState, putState, stateValue, stableFinancialJSON } from '../../../utils/financialState';
import { evidenceMappingSchema, validateEvidenceMappings } from '../../../utils/scaleEvidenceConfig';
import type { ScaleConfig, IpCamera } from '../../../../src/types/scrap';

const schema = z.object({scaleId:z.string().min(1).max(120),mappings:evidenceMappingSchema,expectedMappings:evidenceMappingSchema}).strict();
export default defineHandler(async event => {
  const user = await requireUser(event);
  if (!['admin','yard_manager'].includes(user.role)) throw createError({statusCode:403,statusMessage:'Camera mappings require a manager or administrator'});
  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success) throw createError({statusCode:400,statusMessage:'Invalid camera configuration'});
  return withTransaction(async client => {
    await lockFinancialState(client);
    const settings = await stateValue<{scales?:ScaleConfig[]}>(client,'mahaffeys_settings',{});
    const scale = settings.scales?.find(row => row.id === parsed.data.scaleId);
    if (!scale) throw createError({statusCode:404,statusMessage:'Scale no longer exists; reload configuration'});
    const mappings = validateEvidenceMappings(parsed.data.mappings,await stateValue<IpCamera[]>(client,'mahaffeys_ip_cameras',[]));
    if (stableFinancialJSON(scale.evidenceCameras ?? {}) !== stableFinancialJSON(mappings) && stableFinancialJSON(scale.evidenceCameras ?? {}) !== stableFinancialJSON(parsed.data.expectedMappings)) {
      throw createError({statusCode:409,statusMessage:'Camera mappings changed on another workstation; reload before saving'});
    }
    scale.evidenceCameras = mappings;
    await putState(client,'mahaffeys_settings',settings,user.id);
    return {scaleId:scale.id,mappings};
  });
});
