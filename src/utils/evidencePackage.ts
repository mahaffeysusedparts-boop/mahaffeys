import JSZip from 'jszip';
import { Ticket, ComplianceCaptures, YardSettings } from '@/types/scrap';
import { generateNMVTISCsv, generateLawEnforcementLogCsv } from './complianceUtils';

/**
 * Evidence package builder — bundles compliance photos + NMVTIS / LE CSVs +
 * a checksum manifest into one ZIP for auditors or law enforcement.
 */

export const EVIDENCE_MAX_TICKETS = 200;

/** Ordered photo slots and their canonical evidence filenames. */
export const EVIDENCE_PHOTOS: Array<{ key: keyof Pick<ComplianceCaptures, 'personPhotoUrl' | 'idPhotoUrl' | 'vehiclePhotoUrl' | 'licensePlatePhotoUrl' | 'loadPhotoUrl'>; name: string; label: string }> = [
  { key: 'personPhotoUrl', name: '01_seller', label: 'Seller photo' },
  { key: 'idPhotoUrl', name: '02_id', label: 'ID scan' },
  { key: 'vehiclePhotoUrl', name: '03_vehicle', label: 'Vehicle photo' },
  { key: 'licensePlatePhotoUrl', name: '04_plate', label: 'License plate' },
  { key: 'loadPhotoUrl', name: '05_load', label: 'Load photo' },
];

export interface EvidenceManifest {
  yard: string;
  generatedAt: string;
  operator: string;
  ticketCount: number;
  tickets: Array<{
    ticketId: string;
    vin?: string;
    customerName: string;
    intakeDate: string;
    files: Array<{ file: string; label: string; bytes: number; checksum: string }>;
  }>;
  textFiles: Array<{ file: string; bytes: number; checksum: string }>;
}

export interface EvidenceFetchResult {
  base64: string;
  ext: string;
  bytes: number;
  checksum: string;
}

/**
 * FNV-1a 32-bit checksum over base64 content — a deterministic, dependency-free
 * integrity digest (not cryptographic; it verifies transfer completeness).
 */
export function fnv1aHex(content: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    // 32-bit FNV prime multiplication via shifts to stay in integer range.
    hash = (hash + ((hash << 1) >>> 0) + ((hash << 4) >>> 0) + ((hash << 7) >>> 0) + ((hash << 8) >>> 0) + ((hash << 24) >>> 0)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function extFromDataUrl(mime: string): string {
  const map: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' };
  return map[mime] || 'jpg';
}

/**
 * Turns a photo reference (data-URL or `/api/uploads/<id>`) into base64 bytes.
 * Data URLs decode without network; server media is fetched with credentials.
 */
export async function fetchEvidenceImage(url: string): Promise<EvidenceFetchResult | null> {
  try {
    if (url.startsWith('data:')) {
      const match = url.match(/^data:([^;,]+)(;base64)?,(.+)$/);
      if (!match) return null;
      const [, mime, isB64, payload] = match;
      if (!isB64) return null; // SVG-utf8 payloads vary; skip rather than corrupt
      return { base64: payload, ext: extFromDataUrl(mime), bytes: Math.floor((payload.length * 3) / 4), checksum: fnv1aHex(payload) };
    }
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) return null;
    const blob = await response.blob();
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onerror = () => reject(new Error('read failed'));
      reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
      reader.readAsDataURL(blob);
    });
    if (!base64) return null;
    return {
      base64,
      ext: blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg',
      bytes: blob.size,
      checksum: fnv1aHex(base64),
    };
  } catch {
    return null;
  }
}

export interface EvidencePackageResult {
  blob: Blob;
  fileName: string;
  fileCount: number;
  skippedPhotos: number;
}

export interface EvidencePackageOptions {
  settings: YardSettings;
  operatorName?: string;
  onProgress?: (done: number, total: number) => void;
}

/**
 * Builds `EVIDENCE_<scope>_<date>.zip` for the given tickets. Photos are
 * STOREd (already-compressed JPEGs), text files are DEFLATEd.
 */
export async function buildEvidencePackage(tickets: Ticket[], options: EvidencePackageOptions): Promise<EvidencePackageResult> {
  if (tickets.length === 0) throw new Error('No tickets selected for the evidence package');
  if (tickets.length > EVIDENCE_MAX_TICKETS) {
    throw new Error(
      `${tickets.length} tickets exceeds the ${EVIDENCE_MAX_TICKETS}-ticket package cap — split the selection by month to keep the ZIP manageable`
    );
  }

  const { settings, onProgress } = options;
  const zip = new JSZip();
  const dateStr = new Date().toISOString().slice(0, 10);
  const single = tickets.length === 1;

  // Photo work list — every (ticket, slot) pair that has a URL.
  const photoJobs: Array<{ ticket: Ticket; name: string; label: string; url: string }> = [];
  tickets.forEach((t) => {
    const caps = t.complianceCaptures || t.carRecord?.complianceCaptures;
    if (!caps) return;
    EVIDENCE_PHOTOS.forEach(({ key, name, label }) => {
      const url = caps[key] as string | undefined;
      if (url) photoJobs.push({ ticket: t, name, label, url });
    });
  });

  let done = 0;
  const total = photoJobs.length;
  const manifest: EvidenceManifest = {
    yard: settings.yardName,
    generatedAt: new Date().toISOString(),
    operator: options.operatorName || settings.operatorName,
    ticketCount: tickets.length,
    tickets: [],
    textFiles: [],
  };
  let skippedPhotos = 0;
  let fileCount = 0;

  const filesByTicket = new Map<string, EvidenceManifest['tickets'][number]['files']>();
  tickets.forEach((t) => filesByTicket.set(t.id, []));

  for (const job of photoJobs) {
    const result = await fetchEvidenceImage(job.url);
    if (!result) {
      skippedPhotos += 1;
    } else {
      const folder = single ? '' : `${job.ticket.id}/`;
      const fileName = `${folder}${job.name}.${result.ext}`;
      zip.file(fileName, result.base64, { base64: true, compression: 'STORE' });
      filesByTicket.get(job.ticket.id)!.push({ file: fileName, label: job.label, bytes: result.bytes, checksum: result.checksum });
      fileCount += 1;
    }
    done += 1;
    onProgress?.(done, total);
  }

  tickets.forEach((t) => {
    manifest.tickets.push({
      ticketId: t.id,
      vin: t.carRecord?.vin,
      customerName: t.customerName,
      intakeDate: t.createdAt,
      files: filesByTicket.get(t.id) || [],
    });
  });

  // NMVTIS + law-enforcement CSV rows for the included tickets.
  const nmvtisCsv = generateNMVTISCsv(tickets, settings.nmvtisReportingId || settings.licenseNumber);
  const leCsv = generateLawEnforcementLogCsv(tickets, settings.yardName);
  zip.file('nmvtis.csv', nmvtisCsv, { compression: 'DEFLATE' });
  zip.file('le_log.csv', leCsv, { compression: 'DEFLATE' });
  manifest.textFiles = [
    { file: 'nmvtis.csv', bytes: nmvtisCsv.length, checksum: fnv1aHex(nmvtisCsv) },
    { file: 'le_log.csv', bytes: leCsv.length, checksum: fnv1aHex(leCsv) },
  ];
  fileCount += 2;

  const manifestJson = JSON.stringify(manifest, null, 2);
  zip.file('MANIFEST.json', manifestJson, { compression: 'DEFLATE' });
  fileCount += 1;

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const scope = single ? tickets[0].id : `${tickets.length}-tickets`;
  return { blob, fileName: `EVIDENCE_${scope}_${dateStr}.zip`, fileCount, skippedPhotos };
}

export function downloadEvidencePackage(result: EvidencePackageResult) {
  const url = URL.createObjectURL(result.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
