import { defineHandler } from 'nitro';
import { createError, getQuery, setResponseHeader } from 'nitro/h3';
import { z } from 'zod';

interface VehicleOption { id: number; name: string }
const cache = new Map<string, { expires: number; result: Promise<VehicleOption[]> }>();

async function options(path: string, kind: 'make' | 'model') {
  const cached = cache.get(path);
  if (cached && cached.expires > Date.now()) return cached.result;
  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  const result = (async () => {
    try {
      const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/${path}?format=json`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Vehicle service returned an error');
      const data = await response.json() as { Results?: Array<Record<string, unknown>> };
      if (!Array.isArray(data.Results) || data.Results.length > 30000) throw new Error('Invalid vehicle response');
      const unique = new Map<number, VehicleOption>();
      for (const row of data.Results) {
        const id = Number(row[kind === 'make' ? 'Make_ID' : 'Model_ID']);
        const name = row[kind === 'make' ? 'Make_Name' : 'Model_Name'];
        if (Number.isSafeInteger(id) && id > 0 && typeof name === 'string' && name.trim() && name.length <= 200) unique.set(id, { id, name: name.trim() });
      }
      return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      cache.delete(path);
      throw createError({ statusCode: 503, statusMessage: 'Online vehicle options are unavailable. Retry, or choose a vehicle already listed on the yard.' });
    }
  })();
  cache.set(path, { expires: Date.now() + 86400000, result });
  return result;
}

export default defineHandler(async (event) => {
  const parsed = z.object({ makeId: z.coerce.number().int().min(1).max(1000000).optional(), year: z.coerce.number().int().min(1900).max(new Date().getFullYear() + 2).optional() }).safeParse(getQuery(event));
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Choose a valid make and model year' });
  const { makeId, year } = parsed.data;
  const yearSpecific = !!makeId && !!year && year > 1995;
  const path = makeId ? yearSpecific ? `GetModelsForMakeIdYear/makeId/${makeId}/modelyear/${year}` : `GetModelsForMakeId/${makeId}` : 'GetAllMakes';
  const result = await options(path, makeId ? 'model' : 'make');
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600');
  return { options: result, source: 'NHTSA vPIC', yearSpecific, fitmentData: false };
});
