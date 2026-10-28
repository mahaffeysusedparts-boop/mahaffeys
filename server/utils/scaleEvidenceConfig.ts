import { z } from 'zod';
import { createError } from 'nitro/h3';
import type { PoolClient } from 'pg';
import type { ScaleConfig } from '../../src/types/scrap';
import type { ScaleEvidenceCameraMappings } from '../../src/types/scaleEvidence';

export const evidenceMappingSchema = z.object({
  load: z.string().trim().min(1).max(120).optional(),
  vehicle: z.string().trim().min(1).max(120).optional(),
  plate: z.string().trim().min(1).max(120).optional(),
}).strict();

export function validateEvidenceMappings(value: unknown, cameras: Array<{ id: string; isActive?: boolean; provider?: string }>): ScaleEvidenceCameraMappings {
  const parsed = evidenceMappingSchema.safeParse(value);
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid scale evidence camera mappings' });
  if (Object.values(parsed.data).some(id => !cameras.some(camera => camera.id === id && camera.isActive === true && camera.provider !== 'ALARM_COM'))) {
    throw createError({ statusCode: 400, statusMessage: 'Select an existing active IP camera; manage camera connections on the Cameras page' });
  }
  return parsed.data;
}

// Generic settings sync cannot overwrite a newer dedicated camera-mapping edit.
export async function preserveEvidenceMappings(client: PoolClient, incoming: unknown) {
  if (!incoming || typeof incoming !== 'object') return incoming;
  const settings = incoming as { scales?: ScaleConfig[] };
  if (!Array.isArray(settings.scales)) return incoming;
  const stored = (await client.query("SELECT value FROM app_state WHERE key='mahaffeys_settings'")).rows[0]?.value as { scales?: ScaleConfig[] } | undefined;
  return { ...settings, scales: settings.scales.map(scale => {
    const rest = { ...scale };
    delete rest.evidenceCameras;
    const previous = stored?.scales?.find(row => row.id === scale.id);
    return previous?.evidenceCameras ? { ...rest, evidenceCameras: previous.evidenceCameras } : rest;
  }) };
}
