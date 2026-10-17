import { randomUUID } from 'node:crypto';
import type { ReviewedPriceRow } from '../../src/types/priceSheets';
import { normalizePartsPrice } from '../../src/utils/partsPriceCalculations';

export function parsePriceSheetLines(lines: Array<{page:number;text:string}>) {
  const rows: ReviewedPriceRow[] = [];
  const warnings = ['Every row is unreviewed. Verify names, categories, prices, cores, warranties, units and conditions against the original PDF. Columns and repeated headers may need manual correction.'];
  const seen = new Set<string>();
  for (const line of lines) {
    const text = line.text.trim();
    if (!text || seen.has(`${line.page}:${text}`)) continue;
    seen.add(`${line.page}:${text}`);
    const candidate: ReviewedPriceRow = {id:randomUUID(),category:'Uncategorized',name:text.slice(0,200),priceKind:'description',price:'',unit:'',core:'',warranty:'',conditions:'',sourceText:text.slice(0,1000),page:line.page,reviewed:false};
    const range = text.match(/^(.+?)\s+(\$[0-9]+(?:\.[0-9]{1,2})?\s*(?:-|–|—|to)\s*\$?[0-9]+(?:\.[0-9]{1,2})?)$/i);
    const fixed = text.match(/^(.+?)\s+(\$[0-9]+(?:\.[0-9]{1,2})?)$/);
    const match = range ?? fixed;
    if (match && !match[1].includes('$')) {
      candidate.name = match[1].trim().slice(0,200);
      candidate.priceKind = range ? 'range' : 'fixed';
      try { candidate.price = normalizePartsPrice(candidate.priceKind,match[2]); }
      catch { candidate.priceKind = 'description'; candidate.price = ''; }
    }
    rows.push(candidate);
    if (rows.length > 500) throw new Error('More than 500 candidate rows. Split the PDF into smaller price sheets.');
  }
  if (!rows.length) warnings.push('No usable text was found. OCR is not enabled in this runtime. Manually transcribe prices from the private original preview or upload a text-based PDF.');
  else if (rows.some((row) => !row.price)) warnings.push('Unclear/unpriced rows are blank, not invented. Correct or remove them before publishing.');
  return {rows,warnings};
}
