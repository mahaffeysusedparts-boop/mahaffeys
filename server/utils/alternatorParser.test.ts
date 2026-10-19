import { describe, expect, it } from 'vitest';
import { parseAlternatorListing } from './alternatorParser';

const fixture = `<h1>Test alternator</h1>
<table><tr><td>Unit Type</td><td>Alternator</td></tr><tr><td>Amperage</td><td>110</td></tr><tr><td>Fits</td><td>Check production date</td></tr></table>
<table><tr><td>MAKE</td><td>TYPE</td><td>MODEL</td><td>YEAR</td><td>ENGINE</td></tr>
<tr><td>Ford</td><td>Truck</td><td>F-150</td><td>2005</td><td>4600cc 4.6L V8 GAS</td></tr>
<tr><td>Ford</td><td>Truck</td><td>F-150</td><td>2007</td><td>5400cc 5.4L V8</td></tr>
<tr><td>Lincoln</td><td>Truck</td><td>Mark LT</td><td>2007</td><td>5400cc 5.4L V8</td></tr>
<tr><td>Ford</td><td>Truck</td><td>F-150</td><td>2005</td><td>4600cc 4.6L V8 GAS</td></tr>
<tr><td>Ford</td><td>Truck</td><td>Other</td><td>2005</td><td></td></tr></table>
<table><tr><td>FORD</td><td>TEST-123, TEST-456</td></tr></table>`;
const parse = (html = fixture) => parseAlternatorListing(html, 'TEST', 'https://www.dbelectrical.com/products/test.html', '2026-10-19T00:00:00.000Z');

describe('public alternator listing parser', () => {
  it('preserves explicit application years, engine, specifications and provenance', () => {
    const mapping = parse();
    expect(mapping.compatibleModels).toHaveLength(4);
    expect(mapping.compatibleModels[0]).toMatchObject({ startYear: 2005, endYear: 2005, engineLiters: 4.6, engineCylinders: 8, fuelType: 'gas' });
    expect(mapping.compatibleModels.some((row) => row.startYear === 2006)).toBe(false);
    expect(mapping.compatibleModels[3].engineLiters).toBeUndefined();
    expect(mapping.source).toMatchObject({ verification: 'unverified', stale: false });
    expect(mapping.specifications?.Fits).toBe('Check production date');
    expect(mapping.references).toEqual(['FORD: TEST-123', 'FORD: TEST-456']);
  });
  it('never substitutes titles or starter tables for alternator application data', () => {
    expect(() => parse('<h1>Alternator Ford 2000-2020</h1>')).toThrow();
    expect(() => parse(fixture.replace('<td>Alternator</td>', '<td>Starter</td>'))).toThrow();
    expect(() => parse(fixture.replace('<td>2005</td>', '<td>2005-2007</td>'))).toThrow();
    expect(() => parse(fixture.replace('<td>ENGINE</td>', '<td>UNKNOWN</td>'))).toThrow();
  });
});
