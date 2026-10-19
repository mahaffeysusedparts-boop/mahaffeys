import { load } from 'cheerio';
import type { InterchangeMapping } from '../../src/services/interchangeService';

export function parseAlternatorListing(html: string, partNumber: string, url: string, fetchedAt: string): InterchangeMapping {
  return parseElectricalListing(html, partNumber, url, fetchedAt, 'Alternator');
}

export function parseElectricalListing(html: string, partNumber: string, url: string, fetchedAt: string, partName: 'Alternator' | 'Starter'): InterchangeMapping {
  const $ = load(html);
  const specifications: Record<string, string> = {};
  const references = new Set<string>();
  const applications = new Map<string, InterchangeMapping['compatibleModels'][number]>();
  const text = (value: string) => value.replace(/\s+/g, ' ').trim();
  let foundApplicationTable = false;
  $('table').each((_, table) => {
    const rows = $(table).find('tr').toArray();
    const headerIndex = rows.findIndex((row) => {
      const cells = $(row).children('th,td').toArray().map((cell) => text($(cell).text()).toUpperCase());
      return ['MAKE', 'MODEL', 'YEAR', 'ENGINE'].every((name) => cells.includes(name));
    });
    if (headerIndex >= 0) {
      foundApplicationTable = true;
      const headers = $(rows[headerIndex]).children('th,td').toArray().map((cell) => text($(cell).text()).toUpperCase());
      for (const row of rows.slice(headerIndex + 1)) {
        const cells = $(row).children('td').toArray().map((cell) => text($(cell).text()));
        if (cells.length !== headers.length) throw new Error('Application columns changed');
        const make = cells[headers.indexOf('MAKE')];
        const model = cells[headers.indexOf('MODEL')];
        const yearText = cells[headers.indexOf('YEAR')];
        const engine = cells[headers.indexOf('ENGINE')];
        if (!make || !model || !/^\d{4}$/.test(yearText)) throw new Error('Unsupported application year or vehicle');
        const year = Number(yearText);
        if (year < 1900 || year > new Date().getFullYear() + 2) throw new Error('Invalid application year');
        const liters = engine.match(/\b(\d+(?:\.\d+)?)\s*L\b/i);
        const cylinders = engine.match(/\b[VLIH](\d{1,2})\b/i);
        const application: InterchangeMapping['compatibleModels'][number] = {
          make, model, startYear: year, endYear: year, engine: engine || 'Engine not specified by source',
          ...(liters ? { engineLiters: Number(liters[1]) } : {}),
          ...(cylinders ? { engineCylinders: Number(cylinders[1]) } : {}),
          ...(/diesel/i.test(engine) ? { fuelType: 'diesel' as const } : /\bgas\b/i.test(engine) ? { fuelType: 'gas' as const } : {}),
        };
        applications.set(JSON.stringify(application), application);
      }
    } else {
      for (const row of rows) {
        const cells = $(row).children('td').toArray();
        if (cells.length !== 2) continue;
        const key = text($(cells[0]).text());
        const value = text($(cells[1]).text());
        if (['Unit Type', 'Voltage', 'Amperage', 'Rotation', 'Clock', 'Pulley Class', 'Regulator', 'Fan Type', 'Fits', 'Teeth', 'KW', 'Starter Type'].includes(key)) specifications[key] = value;
        // Only take reference tables identified by a known catalog/manufacturer label.
        if (/^(FORD|CHRYSLER|DELCO|AC DELCO|BOSCH|LESTER|MOTORCRAFT|WAI|WILSON|REMY LIGHT DUTY|ARROWHEAD|J&N Electrical Products|HONDA|ACURA|MITSUBA|DENSO|TOYOTA|MITSUBISHI)$/i.test(key)) {
          value.split(',').map(text).filter(Boolean).forEach((number) => references.add(`${key}: ${number}`));
        }
      }
    }
  });
  if (specifications['Unit Type']?.toLowerCase() !== partName.toLowerCase() || !foundApplicationTable || !applications.size) throw new Error(`No readable ${partName.toLowerCase()} application table`);
  const heading = text($('h1').first().text());
  return {
    id: `dbe-${partNumber}`, partCategory: 'Electrical', partName, interchangeCode: partNumber,
    description: heading || `DB Electrical ${partNumber}`,
    specifications, references: [...references], compatibleModels: [...applications.values()],
    source: { name: 'DB Electrical public listing', url, fetchedAt, stale: false, verification: 'unverified' },
  };
}
