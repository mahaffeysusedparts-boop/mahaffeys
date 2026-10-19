import { describe, expect, it } from 'vitest';
import { parseBodyComponentListing } from './bodyComponentParser';
import { BODY_COMPONENT_SOURCES, type BodyComponentSource } from './bodyComponentSources';
import { matchesComponentQuery, matchesPartIdentifier, interchangeService, type InterchangeYardVehicle } from '../../src/services/interchangeService';

// Synthetic application rows test parsing only; never runtime fitment evidence.
const fixture = (source: BodyComponentSource) => `<h1>${source.partCategory === 'Body' ? 'Test bumper' : source.partCategory === 'Lights' ? 'Test headlight' : source.partCategory === 'Brakes' ? 'Test brake kit' : source.partCategory === 'Cooling' ? 'Test radiator' : 'Test interior door handle'} ${source.partNumber}</h1>
<table><tr><th>Year</th><th>Make</th><th>Model</th><th>Description</th></tr>
<tr><td>2004-2007</td><td>TEST MAKE</td><td>TEST MODEL</td><td>Passenger side; manual parking brake; 6 lug; without switch hole; V8 5.3L; transmission oil cooler</td></tr>
<tr><td>2009</td><td>OTHER TEST MAKE</td><td>OTHER MODEL Classic</td><td>Extended cab only; halogen; source qualification</td></tr></table>
<table><tr><th>Brand Label</th><th>Part Number</th></tr><tr><td>Test OE</td><td>TEST-123</td></tr></table>`;
const source = BODY_COMPONENT_SOURCES[0];
const parse = (html = fixture(source)) => parseBodyComponentListing(html, source, '2026-10-19T00:00:00.000Z');

describe('body, lighting, brake, cooling and interior applications', () => {
  it.each(['Body', 'Lights', 'Brakes', 'Cooling', 'Interior'])('supports explicit %s records with source provenance', (category) => {
    const entry = BODY_COMPONENT_SOURCES.find((item) => item.partCategory === category)!;
    const result = parseBodyComponentListing(fixture(entry), entry, '2026-10-19T00:00:00.000Z');
    expect(result).toMatchObject({ partCategory: category, interchangeCode: entry.partNumber, fitmentScope: 'replacement-candidate' });
    expect(result.source).toMatchObject({ name: '1A Auto public application table', verification: 'unverified', stale: false, url: entry.url });
    expect(result.compatibleModels).toHaveLength(2);
    expect(result.compatibleModels[0]).toMatchObject({ startYear: 2004, endYear: 2007, engineLiters: 5.3, engineCylinders: 8 });
    expect(result.compatibleModels[0].notes).toContain('without switch hole');
    expect(result.compatibleModels[1].model).toBe('OTHER MODEL Classic');
    expect(result.references).toEqual(['Test OE: TEST-123']);
    expect(result.specifications?.['Verification required']).toContain('each individual kit component');
    expect(matchesComponentQuery(result, category)).toBe(true);
    expect(matchesPartIdentifier(result, 'manual parking brake')).toBe(true);
    expect(interchangeService.findInterchangeForVehicle('TEST MAKE', 'TEST MODEL', 2005, [result])).toHaveLength(1);
    expect(interchangeService.findInterchangeForVehicle('TEST MAKE', 'TEST MODEL', 2008, [result])).toHaveLength(0);
  });
  it('retains global reviewed qualifications instead of treating equipment differences as interchangeable', () => {
    const radiator = BODY_COMPONENT_SOURCES.find((entry) => entry.partNumber === 'RDA82615')!;
    expect(parseBodyComponentListing(fixture(radiator), radiator, '2026-10-19T00:00:00.000Z').specifications?.['Reviewed source qualifications']).toContain('engine-oil');
  });
  it('never derives applications from titles or accepts a changed listing identity', () => {
    expect(() => parse(`<h1>Test bumper ${source.partNumber} 1950-2026</h1>`)).toThrow();
    expect(() => parse(fixture(source).replace(source.partNumber, 'UNRELATED-PART'))).toThrow();
    expect(() => parse(fixture(source).replace('Test bumper', 'Test radiator'))).toThrow();
    expect(() => parse(fixture(source).replace('<th>Description</th>', '<th>Unknown</th>'))).toThrow();
    expect(() => parse(fixture(source).replace('2004-2007', '2007-2004'))).toThrow();
  });
  it('deduplicates exact rows but does not merge different qualifications', () => {
    const row = '<tr><td>2004</td><td>TEST MAKE</td><td>TEST MODEL</td><td>Left side</td></tr>';
    const html = `<h1>Test bumper ${source.partNumber}</h1><table><tr><th>Year</th><th>Make</th><th>Model</th><th>Description</th></tr>${row}${row}${row.replace('Left side', 'Right side')}</table>`;
    expect(parse(html).compatibleModels).toHaveLength(2);
  });
  it('supports category terms without broadening model matching or confirming configuration', () => {
    const result = parse();
    expect(matchesComponentQuery(result, 'body parts')).toBe(true);
    expect(matchesComponentQuery(result, 'lighting')).toBe(false);
    const donor = { id: 'test', make: 'TEST MAKE', model: 'TEST MODEL', year: 2005, status: 'AVAILABLE', section: 'GM & Chevrolet' } as InterchangeYardVehicle;
    expect(interchangeService.findMatchingDonorVehicles('TEST MAKE', 'TEST MODEL', 2005, [donor], [result])).toHaveLength(1);
    expect(interchangeService.findInterchangeForVehicle('OTHER TEST MAKE', 'OTHER MODEL', 2009, [result])).toEqual([]);
    expect(BODY_COMPONENT_SOURCES).toHaveLength(20);
  });
});
