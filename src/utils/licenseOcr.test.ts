import { describe, expect, it } from 'vitest';
import { parseDriverLicenseText } from './licenseOcr';

const card = 'GEORGIA\nDRIVER LICENSE\nDL D12345678\nLN DOE\nFN JOHN MICHAEL\n123 MAIN ST\nATLANTA GA 30301\nDOB 01/02/1980\nEXP 01/02/2030';
describe('license photo text extraction', () => {
  it('reads only evidenced name, number, issuing state, address and dates', () => {
    expect(parseDriverLicenseText(card, 95)).toMatchObject({ fullName: 'JOHN MICHAEL DOE', idNumber: 'D12345678', idState: 'GA', address: '123 MAIN ST, ATLANTA GA 30301', dob: '01/02/1980', expDate: '01/02/2030', status: 'READ', missingFields: [] });
  });
  it('does not infer Idaho from the ID label or fabricate a default state', () => {
    expect(parseDriverLicenseText('ID 123456789\nNAME JANE DOE', 90)).toMatchObject({ idNumber: '123456789', idState: '', address: '', status: 'PARTIAL', missingFields: ['Issuing state', 'Address'] });
  });
  it('flags unreadable and low-confidence scans without replacing fields with guesses', () => {
    for (const [text, confidence] of [['', 0], [card, 20], ['DRIVER LICENSE\nDOB 01/02/1980', 80]] as const) {
      const result = parseDriverLicenseText(text, confidence);
      expect(result.idNumber).toBe('');
      expect(result.fullName).toBe('');
      if (confidence < 50) expect(result).toMatchObject({ idState: '', fieldsExtractedCount: 0, status: 'UNREADABLE' });
    }
  });
  it('recognizes the issuing header instead of a name substring or an address ZIP as an ID', () => {
    const result = parseDriverLicenseText('WEST VIRGINIA DRIVER LICENSE\nNAME VIRGINIA DOE\n42 OAK ROAD\nCHARLESTON WV 25301', 85);
    expect(result.idState).toBe('WV');
    expect(result.idNumber).toBe('');
    expect(result.status).toBe('PARTIAL');
  });
});
