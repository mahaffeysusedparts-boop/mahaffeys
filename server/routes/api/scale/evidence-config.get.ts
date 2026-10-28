import { defineHandler } from 'nitro';
import { requireUser } from '../../../utils/auth';
import { query } from '../../../utils/db';
import type { ScaleConfig, IpCamera } from '../../../../src/types/scrap';

export default defineHandler(async event => {
  await requireUser(event);
  const result = await query<{ key: string; value: unknown }>("SELECT key,value FROM app_state WHERE key=ANY($1::text[])", [['mahaffeys_settings','mahaffeys_ip_cameras']]);
  const settings = result.rows.find(row => row.key === 'mahaffeys_settings')?.value as { scales?: ScaleConfig[] } | undefined;
  const stored = result.rows.find(row => row.key === 'mahaffeys_ip_cameras')?.value;
  const cameras = Array.isArray(stored) ? stored as IpCamera[] : [];
  return {
    scales: (settings?.scales ?? []).map(scale => ({ id: scale.id, name: scale.name, evidenceCameras: scale.evidenceCameras ?? {} })),
    cameras: cameras.filter(camera => camera.isActive === true && camera.provider !== 'ALARM_COM').map(camera => ({ id: camera.id, name: camera.name })),
  };
});
