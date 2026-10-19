import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { WheelCatalogSnapshot, WheelFitmentRecord } from '../../src/types/wheelFitment';

const text = z.string().max(2000);
const dimension = z.union([text, z.number().finite()]);
const rowSchema = z.object({
  make: text.min(1), model: text.min(1), year: dimension,
  chassis_code: text, bolt_pattern: text, lug_count: dimension,
  center_bore_mm: dimension, center_bore_rear_mm: dimension,
  oe_wheel: text,
  source_url: z.string().regex(/^https:\/\/ankusiwheels\.com\/(?:[a-z]{2}\/)?fitment-guide\/[^?#\s]+$/),
});

export function normalizeWheelCatalog(input: unknown, fetchedAt: string): WheelCatalogSnapshot {
  const dataset = z.object({
    name: z.literal('ANKUSI Wheel Fitment Dataset'),
    version: z.string().min(1).max(100), license: z.literal('CC BY 4.0'),
    records: z.number().int().positive().max(50000),
    data: z.array(z.unknown()).min(1).max(50000),
  }).parse(input);
  if (dataset.records !== dataset.data.length) throw new Error('Wheel catalog record count does not match its data');
  const records = new Map<string, WheelFitmentRecord>();
  let rejectedRecords = 0;
  for (const inputRow of dataset.data) {
    const parsed = rowSchema.safeParse(inputRow);
    if (!parsed.success) { rejectedRecords++; continue; }
    const row = parsed.data;
    const years = String(row.year).trim().match(/^(\d{4})(?:\s*[-–—]\s*(\d{4}))?$/);
    const pattern = row.bolt_pattern.trim().match(/^(\d{1,2})\s*[x×]\s*(\d{2,3}(?:\.\d+)?)$/i);
    const startYear = years ? Number(years[1]) : 0;
    const endYear = years ? Number(years[2] || years[1]) : 0;
    const lugCount = Number(row.lug_count);
    const centerBore = String(row.center_bore_mm).trim() ? Number(row.center_bore_mm) : null;
    const rearCenterBore = String(row.center_bore_rear_mm).trim() ? Number(row.center_bore_rear_mm) : centerBore;
    if (!years || startYear < 1886 || endYear > 2100 || startYear > endYear || !pattern || !Number.isInteger(lugCount) || lugCount < 3 || lugCount > 10 || Number(pattern[1]) !== lugCount || Number(pattern[2]) < 50 || Number(pattern[2]) > 300 || [centerBore, rearCenterBore].some((bore) => bore !== null && (!Number.isFinite(bore) || bore < 20 || bore > 250))) {
      rejectedRecords++; continue;
    }
    const make = row.make.trim();
    const fullModel = row.model.trim();
    const model = fullModel.toLowerCase().startsWith(`${make.toLowerCase()} `) ? fullModel.slice(make.length + 1).trim() : fullModel;
    if (!model) { rejectedRecords++; continue; }
    const record = { make, model, startYear, endYear, chassis: row.chassis_code.trim(), boltPattern: `${lugCount}x${Number(pattern[2])}`, lugCount, centerBore, rearCenterBore, factoryWheel: row.oe_wheel.trim(), sourceUrl: row.source_url };
    const id = createHash('sha256').update(JSON.stringify(record)).digest('hex');
    records.set(id, { id, ...record });
  }
  if (!records.size) throw new Error('Wheel catalog has no valid records');
  return { version: dataset.version, fetchedAt, sourceRecords: dataset.records, rejectedRecords, records: [...records.values()] };
}

// Shared hub dimensions are only candidate evidence, never a wheel-fit guarantee.
export function sameWheelHub(a: WheelFitmentRecord, b: WheelFitmentRecord) {
  return a.centerBore !== null && a.rearCenterBore !== null && b.centerBore !== null && b.rearCenterBore !== null
    && a.boltPattern === b.boltPattern && a.lugCount === b.lugCount
    && a.centerBore === b.centerBore && a.rearCenterBore === b.rearCenterBore;
}
