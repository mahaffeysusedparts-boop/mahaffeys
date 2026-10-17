import type { PartsPriceRow } from '../types/priceSheets';

const money = '\\$?([0-9]+(?:\\.[0-9]{1,2})?)';
export function normalizePartsPrice(kind: PartsPriceRow['priceKind'], price: string): string {
  const value = price.trim();
  if (kind === 'description') {
    if (!value || value.length > 200) throw new Error('Descriptive price must contain 1–200 characters');
    return value;
  }
  const match = value.match(new RegExp(kind === 'fixed' ? `^${money}$` : `^${money}\\s*(?:-|–|—|to)\\s*${money}$`,'i'));
  if (!match) throw new Error(kind === 'fixed' ? 'Enter a fixed price such as 12.50' : 'Enter a price range such as 10.00–20.00');
  const low = Number(match[1]);
  const high = kind === 'range' ? Number(match[2]) : low;
  if (low > high || high > 1000000) throw new Error('Invalid price range or price above $1,000,000');
  return kind === 'fixed' ? low.toFixed(2) : `${low.toFixed(2)}–${high.toFixed(2)}`;
}
export function displayPartsPrice(row: Pick<PartsPriceRow,'priceKind'|'price'>) {
  if (row.priceKind === 'description') return row.price;
  return row.priceKind === 'fixed' ? `$${row.price}` : row.price.split('–').map((value) => `$${value}`).join(' – ');
}
