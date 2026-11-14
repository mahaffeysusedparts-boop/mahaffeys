import { defineHandler } from 'nitro';
import { assertBodySize, createError, getRequestHeaders, getRequestURL, readBody, setResponseHeader } from 'nitro/h3';
import { requireAdmin } from '../../../../utils/auth';
import { auditFor, recordAudit } from '../../../../utils/audit';
import { callHostControl, limitHostControl } from '../../../../utils/hostControl';
import { validateControlRequest, isControlWrite } from '../../../../tools/hostControlProtocol.mjs';

export default defineHandler(async event => {
  const user = await requireAdmin(event);
  const headers = getRequestHeaders(event);
  try {
    if (!headers.origin || new URL(headers.origin).host !== getRequestURL(event).host) throw new Error();
  } catch { throw createError({ statusCode: 403, statusMessage: 'Same-origin request required' }); }
  await assertBodySize(event, 4096);
  const body = await readBody<Record<string, unknown>>(event);
  try {
    if (Buffer.byteLength(JSON.stringify(body)) > 4096) throw new Error();
    validateControlRequest(body);
  } catch { throw createError({ statusCode: 400, statusMessage: 'Invalid host-control action or confirmation' }); }
  setResponseHeader(event, 'Cache-Control', 'no-store, private');
  limitHostControl(user.id, isControlWrite(body));
  if (body.action !== 'status' && body.action !== 'capabilities') {
    await recordAudit(auditFor(user, { action: `server.control.${body.action}`, entity: 'server', detail: { report: body.report, revision: body.revision, jobId: body.jobId, requested: true } }));
  }
  return callHostControl(body);
});
