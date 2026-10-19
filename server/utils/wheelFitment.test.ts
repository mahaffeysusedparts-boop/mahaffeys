import { describe, expect, it } from 'vitest';
import { normalizeWheelCatalog, sameWheelHub } from './wheelFitment';

// Synthetic test fixtures, not production fitment evidence.
const row = {
  make: 'Test Make', model: 'Test Make Model Sport [US]', year: '2005–2008',
  chassis_code: 'TEST', bolt_pattern: '5x114.3', lug_count: '5',
  center_bore_mm: '64.1', center_bore_rear_mm: '', oe_wheel: '18x8J ET45',
  source_url: 'https://ankusiwheels.com/fitment-guide/test-only/',
};
const dataset = (data: unknown[]) => ({ name: 'ANKUSI Wheel Fitment Dataset', version: 'test-only', license: 'CC BY 4.0', records: data.length, data });

describe('free wheel catalog normalization', () => {
  it('preserves exact trim, market, chassis, year range and source, removing only redundant make prefix', () => {
    const result = normalizeWheelCatalog(dataset([row]), '2026-01-01T00:00:00Z');
    expect(result.records[0]).toMatchObject({ make: 'Test Make', model: 'Model Sport [US]', chassis: 'TEST', startYear: 2005, endYear: 2008, boltPattern: '5x114.3', centerBore: 64.1, rearCenterBore: 64.1, factoryWheel: row.oe_wheel, sourceUrl: row.source_url });
  });

  it('accepts numeric source dimensions, deduplicates exact rows and keeps separate year records', () => {
    const result = normalizeWheelCatalog(dataset([row, row, { ...row, year: 2010, lug_count: 5, center_bore_mm: 64.1 }]), '2026-01-01T00:00:00Z');
    expect(result.records).toHaveLength(2);
    expect(result.records.map((record) => [record.startYear, record.endYear])).toEqual([[2005, 2008], [2010, 2010]]);
    expect(result.rejectedRecords).toBe(0);
  });

  it('excludes unsupported years, unsafe source links, invalid bores and inconsistent lug counts', () => {
    const result = normalizeWheelCatalog(dataset([row, { ...row, year: '2005, 2007' }, { ...row, year: '2008-2005' }, { ...row, source_url: 'javascript:alert(1)' }, { ...row, center_bore_mm: 'unknown' }, { ...row, lug_count: '6' }]), '2026-01-01T00:00:00Z');
    expect(result.records).toHaveLength(1);
    expect(result.rejectedRecords).toBe(5);
  });

  it('refuses changed licensing or incomplete dataset counts', () => {
    expect(() => normalizeWheelCatalog({ ...dataset([row]), license: 'All rights reserved' }, '')).toThrow();
    expect(() => normalizeWheelCatalog({ ...dataset([row]), records: 2 }, '')).toThrow(/count/);
  });

  it('compares hubs only when all required dimensions agree and does not require yard stock', () => {
    const base = normalizeWheelCatalog(dataset([row]), '').records[0];
    expect(sameWheelHub(base, { ...base, id: 'other', make: 'Other Make', model: 'Different Model', factoryWheel: 'Different offset' })).toBe(true);
    expect(sameWheelHub(base, { ...base, centerBore: null, rearCenterBore: null })).toBe(false);
    expect(sameWheelHub(base, { ...base, centerBore: 66.1 })).toBe(false);
    expect(sameWheelHub(base, { ...base, rearCenterBore: 66.1 })).toBe(false);
    expect(sameWheelHub(base, { ...base, boltPattern: '5x112' })).toBe(false);
    expect(sameWheelHub(base, { ...base, lugCount: 6 })).toBe(false);
  });
});
