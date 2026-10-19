import { describe, expect, it } from 'vitest';
import { parseComponentListing } from './componentParser';
import type { ComponentSource } from './componentSources';

const source: ComponentSource = { id: 'test-engine', provider: 'powertrain', partName: 'Engine', url: 'https://www.powertrainproducts.net/product/test/' };
const html = `<h1>Test LM7 engine</h1><span class="sku">TEST-UNIT</span>
<table><tr><th>Title</th><th>Value</th></tr><tr><td>Block Cast #</td><td>TEST-CAST</td></tr><tr><td>VIN</td><td>T</td></tr><tr><td>Fuel Type</td><td>Gas</td></tr><tr><td>Intake Manifold Included</td><td>No</td></tr></table>
<table><thead><tr><th>Year</th><th>Make</th><th>Model</th><th>Engine</th><th>Position</th><th>Note</th></tr></thead><tbody>
<tr><td>2004 - 2008</td><td>TEST MAKE</td><td>TEST MODEL</td><td>V8 5.3L</td><td></td><td>Test restriction: specific crank and cover</td></tr>
<tr><td>2006 - 2008</td><td>OTHER TEST MAKE</td><td>OTHER MODEL</td><td>V8 5.3L</td><td>RWD</td><td>Test build date restriction</td></tr>
</tbody></table>`;
const parse = (text = html, item = source) => parseComponentListing(text, item, '2026-10-19T00:00:00.000Z');

describe('public component application tables', () => {
  it('imports only explicit applications, retaining ranges, identifiers, casts and restrictions', () => {
    const item = parse();
    expect(item.compatibleModels).toHaveLength(2);
    expect(item.compatibleModels[0]).toMatchObject({ startYear: 2004, endYear: 2008, engineLiters: 5.3, engineCylinders: 8, fuelType: 'gas', notes: 'Test restriction: specific crank and cover' });
    expect(item.compatibleModels[1].notes).toBe('Test build date restriction · RWD');
    expect(item.specifications).toMatchObject({ VIN: 'T', 'Block Cast #': 'TEST-CAST', 'Intake Manifold Included': 'No' });
    expect(item).toMatchObject({ interchangeCode: 'TEST-UNIT', fitmentScope: 'long-block', engineCodes: ['LM7'] });
    expect(item.source).toMatchObject({ verification: 'unverified', stale: false });
  });
  it('rejects marketing-only fitment and changed table or product types', () => {
    expect(() => parse('<h1>Test engine for 2000-2020 Test Make</h1>')).toThrow();
    expect(() => parse(html.replace('<th>Note</th>', '<th>Unknown</th>'))).toThrow();
    expect(() => parse(html.replace('Test LM7 engine', 'Test transmission'))).toThrow();
    expect(() => parse(html.replace('2004 - 2008', '2008 - 2004'))).toThrow();
    expect(() => parse(html.replace('2004 - 2008', '04-08'))).toThrow();
  });
  it('labels transmission records separately without treating an engine size as transmission identity', () => {
    const item = parse(html.replace('Test LM7 engine', 'Test transmission'), { ...source, partName: 'Transmission' });
    expect(item.fitmentScope).toBe('replacement-candidate');
    expect(item.engineCodes).toBeUndefined();
    expect(item.partName).toBe('Transmission');
  });
  it('imports starter tables only when source unit type is Starter, retaining tooth and manual-trans restrictions', () => {
    const starter: ComponentSource = { id: 'test-starter', partNumber: 'TEST', provider: 'electrical', partName: 'Starter', url: 'https://www.dbelectrical.com/products/test.html' };
    const fixture = '<h1>Test starter manual trans only</h1><table><tr><td>Unit Type</td><td>Starter</td></tr><tr><td>Teeth</td><td>9</td></tr></table><table><tr><th>MAKE</th><th>MODEL</th><th>YEAR</th><th>ENGINE</th></tr><tr><td>TEST MAKE</td><td>TEST MODEL</td><td>2004</td><td>3.0L V6</td></tr></table>';
    const item = parse(fixture, starter);
    expect(item.partName).toBe('Starter');
    expect(item.description).toContain('manual trans only');
    expect(item.specifications?.Teeth).toBe('9');
    expect(() => parse(fixture.replace('<td>Starter</td>', '<td>Alternator</td>'), starter)).toThrow();
  });
});
