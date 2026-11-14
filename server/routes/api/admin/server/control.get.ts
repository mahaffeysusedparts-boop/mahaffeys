import { defineHandler } from 'nitro';
import { setResponseHeader } from 'nitro/h3';
import { requireAdmin } from '../../../../utils/auth';
import { callHostControl, hostControlEnabled, limitHostControl } from '../../../../utils/hostControl';

export default defineHandler(async event => {
  const user = await requireAdmin(event);
  setResponseHeader(event, 'Cache-Control', 'no-store, private');
  limitHostControl(user.id, false);
  if (!hostControlEnabled()) return { available: false, reason: 'Install the guarded host connector and enable it for production. Local previews never control your live Ubuntu server.' };
  try { return await callHostControl({ action: 'capabilities' }); }
  catch { return { available: false, reason: 'The enabled host connector is unavailable. Review its Unix socket, service and installed policy.' }; }
});
