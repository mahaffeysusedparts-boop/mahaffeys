import { defineHandler } from 'nitro';
import { assertBodySize, readBody, createError } from 'nitro/h3';
import { z } from 'zod';
import { requireAdmin } from '../../../../utils/auth';
import { restoreServerBackup } from '../../../../utils/restoreBackup';
import { auditFor, recordAudit } from '../../../../utils/audit';

export default defineHandler(async (event) => {
  const user = await requireAdmin(event);
  assertBodySize(event, 4096);
  const body = z.object({fileName:z.string().regex(/^app-state-\d{8}-\d{4}\.json$/),confirm:z.literal('RESTORE')}).safeParse(await readBody(event));
  if (!body.success) throw createError({statusCode:400,statusMessage:'Select a server snapshot and explicitly confirm RESTORE'});
  const result = await restoreServerBackup(body.data.fileName,user.id);
  await recordAudit(auditFor(user,{action:'backup.restore',entity:'backups',detail:{fileName:body.data.fileName,...result}}));
  return result;
});
