import { defineHandler } from 'nitro';
import { requireAdmin } from '../../../utils/auth';
import { query } from '../../../utils/db';
import { notificationRules } from '../../../utils/phoneNotifications';
export default defineHandler(async event => {
  await requireAdmin(event);
  const users = (await query<{ id: string; full_name: string; role: string }>("SELECT id,full_name,role FROM users WHERE status='approved' ORDER BY full_name")).rows.map(row => ({ id: row.id, fullName: row.full_name, role: row.role }));
  return { rules: await notificationRules(), users };
});
