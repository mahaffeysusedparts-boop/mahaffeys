import type { DLScanResult } from './complianceUtils';

export interface LicenseReadResult extends DLScanResult {
  confidence: number;
  extractedRawText: string;
  fieldsExtractedCount: number;
  status: 'READ' | 'PARTIAL' | 'UNREADABLE';
  missingFields: string[];
}

const STATES: Record<string, string> = {
  ALABAMA:'AL', ALASKA:'AK', ARIZONA:'AZ', ARKANSAS:'AR', CALIFORNIA:'CA', COLORADO:'CO', CONNECTICUT:'CT', DELAWARE:'DE', FLORIDA:'FL', GEORGIA:'GA', HAWAII:'HI', IDAHO:'ID', ILLINOIS:'IL', INDIANA:'IN', IOWA:'IA', KANSAS:'KS', KENTUCKY:'KY', LOUISIANA:'LA', MAINE:'ME', MARYLAND:'MD', MASSACHUSETTS:'MA', MICHIGAN:'MI', MINNESOTA:'MN', MISSISSIPPI:'MS', MISSOURI:'MO', MONTANA:'MT', NEBRASKA:'NE', NEVADA:'NV', 'NEW HAMPSHIRE':'NH', 'NEW JERSEY':'NJ', 'NEW MEXICO':'NM', 'NEW YORK':'NY', 'NORTH CAROLINA':'NC', 'NORTH DAKOTA':'ND', OHIO:'OH', OKLAHOMA:'OK', OREGON:'OR', PENNSYLVANIA:'PA', 'RHODE ISLAND':'RI', 'SOUTH CAROLINA':'SC', 'SOUTH DAKOTA':'SD', TENNESSEE:'TN', TEXAS:'TX', UTAH:'UT', VERMONT:'VT', VIRGINIA:'VA', WASHINGTON:'WA', 'WEST VIRGINIA':'WV', WISCONSIN:'WI', WYOMING:'WY', 'DISTRICT OF COLUMBIA':'DC',
};

export function parseDriverLicenseText(rawText: string, confidence: number): LicenseReadResult {
  const result: LicenseReadResult = {
    fullName: '', idNumber: '', idState: '', idType: 'Driver License', address: '',
    confidence, extractedRawText: rawText, fieldsExtractedCount: 0, status: 'UNREADABLE', missingFields: [],
  };
  const lines = rawText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (confidence >= 50) {
    const jurisdiction = rawText.match(/(?:STATE|JURISDICTION)[ \t]*[:#]?[ \t]+([A-Z]{2})\b/i)?.[1]?.toUpperCase();
    if (jurisdiction && Object.values(STATES).includes(jurisdiction)) result.idState = jurisdiction;
    if (!result.idState) {
      for (const [name, code] of Object.entries(STATES).sort((a, b) => b[0].length - a[0].length)) {
        if (lines.some(line => new RegExp(`^(?:STATE OF )?${name}(?:$|[ \\t]+(?:DRIVER|DL|IDENTIFICATION))`, 'i').test(line))) {
          result.idState = code; break;
        }
      }
    }
    if (!result.idState) result.idState = lines.find(line => Object.values(STATES).includes(line.toUpperCase()))?.toUpperCase() || '';

    const cleanName = (value: string) => value.replace(/[^A-Za-z'\- ,]/g, '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    const last = rawText.match(/(?:^|\n)[ \t]*(?:LN|LAST NAME|FAMILY NAME|1)[ \t]*[:#.-]?[ \t]+([^\r\n]+)/i)?.[1];
    const first = rawText.match(/(?:^|\n)[ \t]*(?:FN|FIRST NAME|GIVEN NAME|2)[ \t]*[:#.-]?[ \t]+([^\r\n]+)/i)?.[1];
    const name = rawText.match(/(?:^|\n)[ \t]*(?:NAME|NAM)[ \t]*[:#.-]?[ \t]+([^\r\n]+)/i)?.[1];
    if (first && last) result.fullName = cleanName(`${first} ${last}`);
    else if (name) result.fullName = cleanName(name);
    else {
      const streetIndex = lines.findIndex(line => /^(?:ADDRESS[: ]+)?\d{1,6}[ \t]+[A-Z]/i.test(line));
      const candidate = lines[streetIndex - 1] || '';
      if (/^[A-Z'\-]+(?:[ \t]+[A-Z'\-]+){1,3}$/i.test(candidate)
        && !/DRIVER|LICENSE|IDENTIFICATION|DEPARTMENT|STATE|BIRTH|EXPIRES|CLASS|DONOR/i.test(candidate)
        && !Object.keys(STATES).includes(candidate.toUpperCase())) result.fullName = cleanName(candidate);
    }

    const number = rawText.match(/(?:^|\n)[ \t]*(?:DLN?|LIC(?:ENSE)?|ID|4d)(?:[ \t]+(?:NO\.?|NUMBER))?[ \t]*[:#.-]?[ \t]+([A-Z0-9-]{5,20})\b/i)?.[1];
    if (number && /\d/.test(number)) result.idNumber = number.toUpperCase();

    const streetIndex = lines.findIndex(line => /^(?:ADDRESS[: ]+)?\d{1,6}[ \t]+[A-Z]/i.test(line) && /\b(?:ST|STREET|AVE|AVENUE|RD|ROAD|BLVD|DR|DRIVE|LN|LANE|WAY|CT|COURT|HWY|PKWY|CIR)\b/i.test(line));
    if (streetIndex >= 0) {
      result.address = lines[streetIndex].replace(/^ADDRESS[: ]+/i, '');
      const city = lines[streetIndex + 1];
      if (city && /\b[A-Z]{2}[ \t]+\d{5}(?:-\d{4})?\b/i.test(city)) result.address += `, ${city}`;
    }
    result.dob = rawText.match(/(?:DOB|DATE OF BIRTH|BIRTH)[ \t]*[:#.-]?[ \t]+(\d{2}[\/.-]\d{2}[\/.-]\d{4})\b/i)?.[1];
    result.expDate = rawText.match(/(?:EXP|EXPIRES|EXPIRATION)[ \t]*[:#.-]?[ \t]+(\d{2}[\/.-]\d{2}[\/.-]\d{4})\b/i)?.[1];
  }
  const required = [['fullName', 'Full name'], ['idNumber', 'ID number'], ['idState', 'Issuing state'], ['address', 'Address']] as const;
  result.missingFields = required.filter(([key]) => !result[key]).map(([, label]) => label);
  result.fieldsExtractedCount = [result.fullName, result.idNumber, result.idState, result.address, result.dob, result.expDate].filter(Boolean).length;
  result.status = result.missingFields.length === 0 ? 'READ' : result.fieldsExtractedCount > 0 ? 'PARTIAL' : 'UNREADABLE';
  return result;
}
