import { load } from 'cheerio';
import type { InterchangeMapping } from '../../src/services/interchangeService';
import { listedEngineCodes } from '../../src/utils/engineIdentifiers';
import type { ComponentSource } from './componentSources';
import { parseElectricalListing } from './alternatorParser';
import { parseBodyComponentListing } from './bodyComponentParser';

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

export function parseComponentListing(html: string, source: ComponentSource, fetchedAt: string): InterchangeMapping {
  if (source.provider === '1aauto') return parseBodyComponentListing(html, source, fetchedAt);
  if (source.provider === 'electrical' && 'partNumber' in source) {
    return parseElectricalListing(html, source.partNumber, source.url, fetchedAt, 'Starter');
  }
  const $ = load(html);
  const heading = clean($('h1').first().text());
  const expected = source.partName === 'Engine' ? /\bengine\b/i : /\btrans(?:mission)?\b/i;
  if (!expected.test(heading)) throw new Error('Product type changed');
  const specifications: Record<string, string> = {};
  const applications = new Map<string, InterchangeMapping['compatibleModels'][number]>();
  $('table').each((_, table) => {
    const rows = $(table).find('tr').toArray();
    const headersAt = rows.findIndex((row) => {
      const cells = $(row).children('td,th').toArray().map((cell) => clean($(cell).text()).toUpperCase());
      return ['YEAR', 'MAKE', 'MODEL', 'ENGINE', 'NOTE'].every((header) => cells.includes(header));
    });
    if (headersAt < 0) {
      for (const row of rows) {
        const cells = $(row).children('td,th').toArray();
        if (cells.length !== 2) continue;
        const key = clean($(cells[0]).text());
        const value = clean($(cells[1]).text());
        if (/cast|engine type|engine size|fuel type|number of cylinders|number of valves|head type|^VIN$|included|transmission family|connector type|case type|bell housing|tail housing|note|shift type|pan bolts/i.test(key) && !/california proposition/i.test(key)) {
          specifications[key] = specifications[key] && specifications[key] !== value ? `${specifications[key]} / ${value}` : value;
        }
      }
      return;
    }
    const headers = $(rows[headersAt]).children('td,th').toArray().map((cell) => clean($(cell).text()).toUpperCase());
    for (const row of rows.slice(headersAt + 1)) {
      const cells = $(row).children('td').toArray().map((cell) => clean($(cell).text()));
      if (!cells.length) continue;
      if (cells.length !== headers.length) throw new Error('Fitment columns changed');
      const get = (name: string) => cells[headers.indexOf(name)];
      const years = get('YEAR').match(/^(\d{4})(?:\s*[-–]\s*(\d{4}))?$/);
      if (!years || !get('MAKE') || !get('MODEL')) throw new Error('Unsupported vehicle fitment row');
      const startYear = Number(years[1]);
      const endYear = Number(years[2] ?? years[1]);
      if (startYear < 1950 || endYear < startYear || endYear > new Date().getFullYear() + 2) throw new Error('Unsupported year range');
      const engine = get('ENGINE');
      const liters = engine.match(/\b(\d+(?:\.\d+)?)\s*L\b/i);
      const cylinders = engine.match(/\b[VLIH](\d{1,2})\b/i);
      const application: InterchangeMapping['compatibleModels'][number] = {
        make: get('MAKE'), model: get('MODEL'), startYear, endYear, engine,
        notes: [get('NOTE'), headers.includes('POSITION') ? get('POSITION') : ''].filter(Boolean).join(' · ') || undefined,
        ...(liters ? { engineLiters: Number(liters[1]) } : {}),
        ...(cylinders ? { engineCylinders: Number(cylinders[1]) } : {}),
      };
      applications.set(JSON.stringify(application), application);
    }
  });
  if (!applications.size) throw new Error('No readable vehicle fitment table');
  return {
    id: source.id, partCategory: 'Engine & Driveline', partName: source.partName,
    interchangeCode: clean($('.sku').first().text()) || source.id,
    description: heading, specifications, compatibleModels: [...applications.values()].map((row) => ({
      ...row,
      ...(/^diesel$/i.test(specifications['Fuel Type']) ? { fuelType: 'diesel' as const } : /^gas(?:oline)?$/i.test(specifications['Fuel Type']) ? { fuelType: 'gas' as const } : {}),
    })),
    fitmentScope: source.partName === 'Engine' ? 'long-block' : 'replacement-candidate',
    engineCodes: source.partName === 'Engine' ? listedEngineCodes(`${heading} ${specifications['Engine Type'] ?? ''}`) : undefined,
    source: { name: 'Powertrain Products public application table', url: source.url, fetchedAt, stale: false, verification: 'unverified' },
  };
}
