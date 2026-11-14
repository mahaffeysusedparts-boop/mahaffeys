import { defineHandler } from 'nitro';
import { assertBodySize, createError, getRequestHeaders, getRequestURL, readBody } from 'nitro/h3';
import { requireAdmin } from '../../../../utils/auth';
import { auditFor, recordAudit } from '../../../../utils/audit';
import { callHostControl, limitHostControl } from '../../../../utils/hostControl';

export default defineHandler(async event => {
  const user = await requireAdmin(event);
  try {
    const origin = getRequestHeaders(event).origin;
    if (!origin || new URL(origin).host !== getRequestURL(event).host) throw new Error();
  } catch { throw createError({ statusCode: 403, statusMessage: 'Same-origin request required' }); }
  await assertBodySize(event, 4096);
  const body = await readBody<{ confirmation?: string }>(event);
  if (!body || body.confirmation !== 'RESTART APP' || Object.keys(body).some(key => key !== 'confirmation')) throw createError({ statusCode: 400, statusMessage: 'Confirm RESTART APP' });
  limitHostControl(user.id, true);
  await recordAudit(auditFor(user, { action: 'server.restart', entity: 'server', detail: { requested: true, scope: 'existing Docker app container only' } }));
  return callHostControl({ action: 'restart', confirmation: 'RESTART APP' });
});
