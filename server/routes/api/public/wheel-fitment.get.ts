import { defineHandler } from 'nitro';
import { createError, getQuery, setResponseHeader } from 'nitro/h3';
import { z } from 'zod';
import { loadWheelCatalog } from '../../../utils/wheelCatalog';
import { sameWheelHub } from '../../../utils/wheelFitment';

export default defineHandler(async (event) => {
  const parsed = z.object({
    make: z.string().trim().min(1).max(100),
    year: z.coerce.number().int().min(1886).max(2100),
    recordId: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  }).safeParse(getQuery(event));
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Select a valid make, year and catalog record' });
  let catalog;
  try { catalog = await loadWheelCatalog(); }
  catch { throw createError({ statusCode: 503, statusMessage: 'The free wheel catalog could not load. Please retry shortly.' }); }
  const { snapshot, stale } = catalog;
  const { make, year, recordId } = parsed.data;
  const options = snapshot.records.filter((row) => row.make.toLowerCase() === make.toLowerCase() && year >= row.startYear && year <= row.endYear)
    .sort((a, b) => a.model.localeCompare(b.model) || a.startYear - b.startYear);
  const selected = options.find((row) => row.id === recordId) ?? null;
  if (recordId && !selected) throw createError({ statusCode: 400, statusMessage: 'This catalog record is no longer available for the selected make and year. Choose the variant again.' });
  const candidates = selected ? snapshot.records.filter((row) => row.id !== selected.id && sameWheelHub(selected, row))
    .sort((a, b) => a.make.localeCompare(b.make) || a.model.localeCompare(b.model) || a.startYear - b.startYear) : [];
  setResponseHeader(event, 'Cache-Control', 'no-store');
  return { version: snapshot.version, fetchedAt: snapshot.fetchedAt, recordCount: snapshot.records.length, rejectedRecords: snapshot.rejectedRecords, stale, options, selected, candidates };
});
