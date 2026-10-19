import { load } from 'cheerio';
import type { InterchangeMapping } from '../../src/services/interchangeService';
import type { BodyComponentSource } from './bodyComponentSources';

const clean = (text: string) => text.replace(/\s+/g, ' ').trim();

export function parseBodyComponentListing(html: string, source: BodyComponentSource, fetchedAt: string): InterchangeMapping {
  const $ = load(html);
  const heading = clean($('h1').first().text());
  if (!heading.toUpperCase().includes(source.partNumber.toUpperCase())) throw new Error('Listing identity changed');
  const categories = { Body: /bumper|fender|tailgate/i, Lights: /headlight/i, Brakes: /brake/i, Cooling: /radiator/i, Interior: /interior.*door.*handle/i };
  if (!categories[source.partCategory].test(heading)) throw new Error('Listing category changed');
  const applications = new Map<string, InterchangeMapping['compatibleModels'][number]>();
  const references = new Set<string>();
  $('table').each((_, table) => {
    const rows = $(table).find('tr').toArray();
    const headersAt = rows.findIndex((row) => {
      const headers = $(row).children('th,td').toArray().map((cell) => clean($(cell).text()).toUpperCase());
      return ['YEAR', 'MAKE', 'MODEL', 'DESCRIPTION'].every((header) => headers.includes(header));
    });
    if (headersAt < 0) {
      const referenceHeader = rows.findIndex((row) => {
        const cells = $(row).children('th,td').toArray().map((cell) => clean($(cell).text()).toUpperCase());
        return cells.length === 2 && cells[0] === 'BRAND LABEL' && cells[1] === 'PART NUMBER';
      });
      if (referenceHeader >= 0) for (const row of rows.slice(referenceHeader + 1)) {
        const cells = $(row).children('td').toArray().map((cell) => clean($(cell).text()));
        if (cells.length === 2 && cells.every(Boolean)) references.add(`${cells[0]}: ${cells[1]}`);
      }
      return;
    }
    const headers = $(rows[headersAt]).children('th,td').toArray().map((cell) => clean($(cell).text()).toUpperCase());
    for (const row of rows.slice(headersAt + 1)) {
      const cells = $(row).children('td').toArray().map((cell) => clean($(cell).text()));
      if (!cells.length) continue;
      if (cells.length !== headers.length) throw new Error('Application columns changed');
      const get = (header: string) => cells[headers.indexOf(header)];
      const years = get('YEAR').match(/^(\d{4})(?:\s*[-–]\s*(\d{4}))?$/);
      if (!years || !get('MAKE') || !get('MODEL') || !get('DESCRIPTION')) throw new Error('Unsupported application row');
      const startYear = Number(years[1]);
      const endYear = Number(years[2] ?? years[1]);
      if (startYear < 1950 || endYear < startYear || endYear > new Date().getFullYear() + 2) throw new Error('Unsupported application year');
      const description = get('DESCRIPTION');
      const liters = description.match(/\b(\d+(?:\.\d+)?)\s*L\b/i);
      const cylinders = description.match(/\b[VLIH](\d{1,2})\b/i);
      const application: InterchangeMapping['compatibleModels'][number] = {
        make: get('MAKE'), model: get('MODEL'), startYear, endYear, notes: description,
        ...(liters ? { engine: liters[0], engineLiters: Number(liters[1]) } : {}),
        ...(cylinders ? { engineCylinders: Number(cylinders[1]) } : {}),
      };
      applications.set(JSON.stringify(application), application);
    }
  });
  if (!applications.size) throw new Error('No readable vehicle application table');
  return {
    id: source.id, partName: source.partName, partCategory: source.partCategory,
    interchangeCode: source.partNumber, description: heading, fitmentScope: 'replacement-candidate',
    compatibleModels: [...applications.values()], references: [...references],
    specifications: {
      'Assembly scope': heading,
      ...(source.qualifications ? { 'Reviewed source qualifications': source.qualifications } : {}),
      'Verification required': 'Compare the full source Part Details and every application restriction with both vehicles. A shared kit or cross-reference does not establish OE-to-OE interchange or interchange of each individual kit component.',
    },
    source: { name: '1A Auto public application table', url: source.url, fetchedAt, stale: false, verification: 'unverified' },
  };
}
