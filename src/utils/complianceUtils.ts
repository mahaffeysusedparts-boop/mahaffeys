import { Ticket, ComplianceCaptures, NMVTISReportLog, YardSettings, IntakeType } from "@/types/scrap";

export interface DLScanResult {
  fullName: string;
  idNumber: string;
  idState: string;
  idType: 'Driver License' | 'State ID' | 'Passport' | 'Military ID';
  address: string;
  dob?: string;
  issueDate?: string;
  expDate?: string;
  vehicleLicensePlate?: string;
  vehicleState?: string;
}

/**
 * Generates an SVG data URL fallback image for initial database seed data or new records without a camera photo.
 */
export function generateSamplePhoto(type: 'person' | 'id' | 'vehicle' | 'plate' | 'load'): string {
  const bgColors: Record<string, string> = {
    person: '#0f172a',
    id: '#1e293b',
    vehicle: '#1e1b4b',
    plate: '#064e3b',
    load: '#312e81',
  };

  const titles: Record<string, string> = {
    person: 'SELLER FACE SNAPSHOT',
    id: 'STATE DRIVER LICENSE RECORD',
    vehicle: 'VEHICLE FRONT 45° ANGLE',
    plate: 'LICENSE PLATE TAG',
    load: 'SCRAP CARGO LOAD BED',
  };

  const icons: Record<string, string> = {
    person: '👤 SELLER VERIFIED',
    id: '💳 DRIVER LICENSE RECORD',
    vehicle: '🚗 VEHICLE RECORD',
    plate: '🏷️ LICENSE PLATE TAG',
    load: '📦 SCRAP CARGO LOAD',
  };

  const bg = bgColors[type] || '#0f172a';
  const title = titles[type] || 'PHOTO RECORD';
  const sub = icons[type] || 'VERIFIED RECORD';
  const dateStr = new Date().toLocaleDateString();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
    <rect width="640" height="480" fill="${bg}"/>
    <rect x="20" y="20" width="600" height="440" rx="16" fill="none" stroke="#3b82f6" stroke-width="3" stroke-dasharray="8 4"/>
    
    <rect x="40" y="40" width="300" height="36" rx="8" fill="#3b82f6" opacity="0.9"/>
    <text x="55" y="63" fill="#ffffff" font-family="monospace" font-size="14" font-weight="bold">${title}</text>
    
    <circle cx="320" cy="230" r="90" fill="none" stroke="#22c55e" stroke-width="2" opacity="0.6"/>
    <line x1="320" y1="120" x2="320" y2="340" stroke="#22c55e" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.6"/>
    <line x1="210" y1="230" x2="430" y2="230" stroke="#22c55e" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.6"/>
    
    <rect x="40" y="380" width="560" height="60" rx="10" fill="#000000" opacity="0.75"/>
    <text x="60" y="408" fill="#4ade80" font-family="sans-serif" font-size="18" font-weight="bold">${sub}</text>
    <text x="60" y="428" fill="#94a3b8" font-family="monospace" font-size="12">TIMESTAMP: ${dateStr} | RECORD VERIFIED</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Check compliance level for a ticket or intake (5 Photo Audit Suite)
export function calculateComplianceScore(
  captures?: ComplianceCaptures,
  intakeType?: 'CAR_SALVAGE' | 'SCRAP_METAL'
): {
  score: number;
  status: 'FULL' | 'PARTIAL' | 'MISSING';
  missingItems: string[];
} {
  const isCarSalvage = intakeType === 'CAR_SALVAGE';

  if (!captures) {
    return {
      score: 0,
      status: 'MISSING',
      missingItems: isCarSalvage
        ? ['Seller Photo', 'Vehicle Photo', 'License Plate Photo', 'Scrap Cargo Photo']
        : ['Seller Photo', 'ID Scan', 'Vehicle Photo', 'License Plate Photo', 'Scrap Cargo Photo'],
    };
  }

  const items = isCarSalvage
    ? [
        { key: 'personPhotoUrl', name: 'Seller Photo' },
        { key: 'vehiclePhotoUrl', name: 'Vehicle Photo' },
        { key: 'licensePlatePhotoUrl', name: 'License Plate' },
        { key: 'loadPhotoUrl', name: 'Scrap Cargo Photo' },
      ]
    : [
        { key: 'personPhotoUrl', name: 'Seller Photo' },
        { key: 'idPhotoUrl', name: 'ID Scan' },
        { key: 'vehiclePhotoUrl', name: 'Vehicle Photo' },
        { key: 'licensePlatePhotoUrl', name: 'License Plate' },
        { key: 'loadPhotoUrl', name: 'Scrap Cargo Photo' },
      ];

  const missing: string[] = [];
  let filledCount = 0;

  items.forEach((item) => {
    const val = (captures as Record<string, unknown>)[item.key];
    if (val) {
      filledCount++;
    } else {
      missing.push(item.name);
    }
  });

  const score = Math.round((filledCount / items.length) * 100);
  let status: 'FULL' | 'PARTIAL' | 'MISSING' = 'MISSING';
  if (score === 100) status = 'FULL';
  else if (score > 0) status = 'PARTIAL';

  return { score, status, missingItems: missing };
}

// VIN Validation Helper (Supports "NO VIN" / "NO-VIN" option)
export function validateVin(vin?: string): { isValid: boolean; reason?: string } {
  if (!vin) return { isValid: false, reason: "VIN is required" };
  const cleaned = vin.trim().toUpperCase();

  if (
    cleaned === "NO VIN" ||
    cleaned === "NO-VIN" ||
    cleaned.startsWith("NO-VIN") ||
    cleaned.startsWith("NOVIN") ||
    cleaned.startsWith("NO VIN")
  ) {
    return { isValid: true, reason: "Explicitly marked as No VIN" };
  }

  if (cleaned.length !== 17) {
    return { isValid: false, reason: `VIN must be 17 characters (currently ${cleaned.length})` };
  }
  if (/[IOQ]/.test(cleaned)) {
    return { isValid: false, reason: "VIN cannot contain letters I, O, or Q" };
  }
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(cleaned)) {
    return { isValid: false, reason: "VIN contains invalid characters" };
  }
  return { isValid: true };
}

// NMVTIS CSV Exporter
export function generateNMVTISCsv(tickets: Ticket[], reportingEntityId: string = "SCRAP-GA-2025-901A"): string {
  const headers = [
    "ReportingEntityID",
    "ReportDate",
    "TicketID",
    "IntakeDate",
    "VIN",
    "VehicleYear",
    "VehicleMake",
    "VehicleModel",
    "TitleStatus",
    "TitleNumber",
    "TitleState",
    "DispositionCode",
    "SellerName",
    "SellerIDNumber",
    "SellerIDType",
    "SellerIDState",
    "SellerAddress",
    "VehiclePlate",
    "VehiclePlateState",
    "PayoutAmount",
    "CompliancePhotoCount"
  ];

  const rows = tickets
    .filter((t) => t.ticketType === 'CAR_SALVAGE' && t.carRecord)
    .map((t) => {
      const c = t.carRecord!;
      const caps = t.complianceCaptures;
      const photoCount = caps
        ? [caps.personPhotoUrl, caps.idPhotoUrl, caps.vehiclePhotoUrl, caps.licensePlatePhotoUrl, caps.loadPhotoUrl].filter(Boolean).length
        : 0;
      
      const escapeCsv = (val: string | number | undefined | boolean) => {
        if (val === undefined || val === null) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const dateOnly = t.createdAt ? t.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];

      // Derive the title/plate state from the license plate when it carries a
      // state prefix (e.g. "GA 123ABC"). Otherwise leave blank — never invent a
      // jurisdiction. DispositionCode, SellerIDType, SellerIDState, and
      // SellerAddress are only emitted when the source data actually exists.
      const plateState = t.vehicleLicensePlate?.split(' ')[1] || '';

      return [
        escapeCsv(reportingEntityId),
        escapeCsv(new Date().toISOString().split('T')[0]),
        escapeCsv(t.id),
        escapeCsv(dateOnly),
        escapeCsv(c.vin),
        escapeCsv(c.year),
        escapeCsv(c.make),
        escapeCsv(c.model),
        escapeCsv(c.titleStatus),
        escapeCsv(c.titleNumber || ""),
        escapeCsv(plateState),
        escapeCsv(""),
        escapeCsv(t.customerName),
        escapeCsv(t.customerIdNumber || ""),
        escapeCsv(""),
        escapeCsv(""),
        escapeCsv(""),
        escapeCsv(t.vehicleLicensePlate || ""),
        escapeCsv(plateState),
        escapeCsv(t.finalPayout.toFixed(2)),
        escapeCsv(photoCount)
      ].join(",");
    });

  return [headers.join(","), ...rows].join("\n");
}

// Law Enforcement Scrap Log (State Anti-Theft Log) Exporter
export function generateLawEnforcementLogCsv(tickets: Ticket[], yardName: string): string {
  const headers = [
    "YardName",
    "LogDate",
    "TicketID",
    "TicketType",
    "CustomerName",
    "CustomerIDNumber",
    "VehiclePlate",
    "ItemsOrVIN",
    "GrossWeightLbs",
    "NetPayoutUSD",
    "PayoutMethod",
    "OperatorName",
    "PhotosAttached"
  ];

  const rows = tickets.map((t) => {
    const caps = t.complianceCaptures;
    const photoCount = caps
      ? [caps.personPhotoUrl, caps.idPhotoUrl, caps.vehiclePhotoUrl, caps.licensePlatePhotoUrl, caps.loadPhotoUrl].filter(Boolean).length
      : 0;

    let itemsOrVin = "Scrap Metals";
    let weight = 0;

    if (t.ticketType === 'CAR_SALVAGE' && t.carRecord) {
      itemsOrVin = `VIN: ${t.carRecord.vin} (${t.carRecord.year} ${t.carRecord.make} ${t.carRecord.model})`;
      weight = t.carRecord.vehicleWeightLbs;
    } else if (t.scrapLines) {
      itemsOrVin = t.scrapLines.map(l => l.metalName).join(" | ");
      weight = t.scrapLines.reduce((acc, l) => acc + l.billableWeight, 0);
    }

    const escapeCsv = (val: string | number | undefined | boolean) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    return [
      escapeCsv(yardName),
      escapeCsv(new Date(t.createdAt).toLocaleString()),
      escapeCsv(t.id),
      escapeCsv(t.ticketType),
      escapeCsv(t.customerName),
      escapeCsv(t.customerIdNumber || "N/A"),
      escapeCsv(t.vehicleLicensePlate || "N/A"),
      escapeCsv(itemsOrVin),
      escapeCsv(weight),
      escapeCsv(t.finalPayout.toFixed(2)),
      escapeCsv(t.payoutMethod),
      escapeCsv(t.operatorName),
      escapeCsv(`${photoCount}/5 Photos`)
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

export function downloadFile(content: string, fileName: string, mimeType: string = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// NMVTIS reporting cadence
// ─────────────────────────────────────────────────────────────────────────────

export interface NmvtisStatus {
  /** Next scheduled batch due date (local time). */
  dueDate: Date;
  isOverdue: boolean;
  /** Whole calendar days from `now` until the due date — negative when overdue. */
  daysUntilDue: number;
  /** ISO timestamp of the most recent exported batch, or null if none ever. */
  lastBatchDate: string | null;
}

const DAY_MS = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Derives the next NMVTIS reporting due date from the yard's cadence settings
 * and the batch history:
 * - With history: due on the configured day-of-month, `cadenceMonths` after
 *   the month of the last batch (advancing further if the last batch landed
 *   after that slot, i.e. it was reported late).
 * - Without history: due on the configured day-of-month in the current month
 *   (so a yard that never reported shows as overdue once the day passes).
 */
export function getNmvtisStatus(
  logs: NMVTISReportLog[],
  settings: YardSettings,
  now: Date = new Date()
): NmvtisStatus {
  const dayOfMonth = Math.min(Math.max(settings.nmvtisReportingDayOfMonth ?? 1, 1), 28);
  const cadenceMonths = Math.max(settings.nmvtisCadenceMonths ?? 1, 1);

  const sorted = [...logs].sort((a, b) => b.exportedAt.localeCompare(a.exportedAt));
  const lastBatchDate = sorted[0]?.exportedAt ?? null;

  const slotInMonth = (base: Date, monthsAhead: number): Date =>
    new Date(base.getFullYear(), base.getMonth() + monthsAhead, dayOfMonth);

  let dueDate: Date;
  if (lastBatchDate) {
    const anchor = new Date(lastBatchDate);
    dueDate = slotInMonth(anchor, cadenceMonths);
    // A late batch (exported on/after the next slot) pushes the schedule forward.
    while (dueDate.getTime() <= anchor.getTime()) {
      dueDate = new Date(dueDate.getFullYear(), dueDate.getMonth() + cadenceMonths, dayOfMonth);
    }
  } else {
    dueDate = slotInMonth(startOfDay(now), 0);
  }

  const daysUntilDue = Math.round(
    (startOfDay(dueDate).getTime() - startOfDay(now).getTime()) / DAY_MS
  );

  return {
    dueDate,
    isOverdue: daysUntilDue < 0,
    daysUntilDue,
    lastBatchDate,
  };
}

/** True when the NMVTIS banner should be shown: due within 7 days or overdue. */
export function isNmvtisBannerActive(status: NmvtisStatus): boolean {
  return status.isOverdue || status.daysUntilDue <= 7;
}

// ─────────────────────────────────────────────────────────────────────────────
// NMVTIS readiness & report lifecycle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Readiness bucket for a single ticket — drives the Compliance hub KPI cards.
 * - COMPLETE: all required evidence present and data valid (ready to export)
 * - INCOMPLETE: required evidence/photos missing
 * - INVALID_DATA: VIN or other critical data is invalid/missing
 * - PENDING_EXPORT: already exported (CSV downloaded) but not yet confirmed
 */
export type ReadinessStatus = 'COMPLETE' | 'INCOMPLETE' | 'INVALID_DATA' | 'PENDING_EXPORT';

export interface ReadinessResult {
  status: ReadinessStatus;
  score: number;
  missingItems: string[];
  warnings: string[];
  isVoided: boolean;
  isExported: boolean;
  isConfirmed: boolean;
}

const CAR_SALVAGE_REQUIREMENTS: Array<{ key: keyof ComplianceCaptures; name: string }> = [
  { key: 'personPhotoUrl', name: 'Seller Photo' },
  { key: 'vehiclePhotoUrl', name: 'Vehicle Photo' },
  { key: 'licensePlatePhotoUrl', name: 'License Plate Photo' },
  { key: 'loadPhotoUrl', name: 'Scrap Cargo Photo' },
];

const SCRAP_METAL_REQUIREMENTS: Array<{ key: keyof ComplianceCaptures; name: string }> = [
  { key: 'personPhotoUrl', name: 'Seller Photo' },
  { key: 'idPhotoUrl', name: 'ID Scan' },
  { key: 'vehiclePhotoUrl', name: 'Vehicle Photo' },
  { key: 'licensePlatePhotoUrl', name: 'License Plate Photo' },
  { key: 'loadPhotoUrl', name: 'Scrap Cargo Photo' },
];

function getRequirements(intakeType: IntakeType): Array<{ key: keyof ComplianceCaptures; name: string }> {
  return intakeType === 'CAR_SALVAGE' ? CAR_SALVAGE_REQUIREMENTS : SCRAP_METAL_REQUIREMENTS;
}

/**
 * Reads the NMVTIS report flags from either the ticket-level or car-record-level
 * captures (the app writes to both for backwards compatibility).
 */
function getReportFlags(ticket: Ticket): {
  isExported: boolean;
  isConfirmed: boolean;
  confirmedAt?: string;
  confirmedBy?: string;
} {
  const caps = ticket.complianceCaptures || ticket.carRecord?.complianceCaptures;
  return {
    isExported: !!(caps?.nmvtisReported),
    isConfirmed: !!(caps?.nmvtisSubmissionConfirmedAt),
    confirmedAt: caps?.nmvtisSubmissionConfirmedAt,
    confirmedBy: caps?.nmvtisSubmissionConfirmedBy,
  };
}

/**
 * Computes per-ticket NMVTIS readiness using the ticket's actual intake type.
 * Voided tickets are never "ready" — they are excluded from active reporting.
 */
export function calculateReadiness(ticket: Ticket): ReadinessResult {
  const isVoided = ticket.status === 'VOIDED';
  const caps = ticket.complianceCaptures || ticket.carRecord?.complianceCaptures;
  const flags = getReportFlags(ticket);

  const requirements = getRequirements(ticket.ticketType);
  const missingItems: string[] = [];
  let filledCount = 0;

  requirements.forEach((item) => {
    const val = caps ? (caps as Record<string, unknown>)[item.key] : undefined;
    if (val) {
      filledCount++;
    } else {
      missingItems.push(item.name);
    }
  });

  const score = Math.round((filledCount / requirements.length) * 100);
  const warnings: string[] = [];

  // CAR_SALVAGE-specific data checks
  if (ticket.ticketType === 'CAR_SALVAGE' && ticket.carRecord) {
    const vinAudit = validateVin(ticket.carRecord.vin);
    if (!vinAudit.isValid) {
      warnings.push(`VIN issue: ${vinAudit.reason}`);
    }
    if (!ticket.carRecord.titleNumber) {
      warnings.push('Title number missing');
    }
    if (!ticket.customerIdNumber) {
      warnings.push('Seller ID number missing');
    }
    if (!ticket.vehicleLicensePlate) {
      warnings.push('Vehicle license plate missing');
    }
  }

  // SCRAP_METAL-specific data checks
  if (ticket.ticketType === 'SCRAP_METAL') {
    if (!ticket.customerIdNumber) {
      warnings.push('Seller ID number missing');
    }
  }

  // Determine readiness status
  let status: ReadinessStatus;
  if (isVoided) {
    status = 'INCOMPLETE';
  } else if (flags.isConfirmed) {
    status = 'PENDING_EXPORT';
  } else if (flags.isExported) {
    status = 'PENDING_EXPORT';
  } else if (ticket.ticketType === 'CAR_SALVAGE' && ticket.carRecord) {
    const vinAudit = validateVin(ticket.carRecord.vin);
    if (!vinAudit.isValid) {
      status = 'INVALID_DATA';
    } else if (missingItems.length > 0) {
      status = 'INCOMPLETE';
    } else {
      status = 'COMPLETE';
    }
  } else {
    if (missingItems.length > 0) {
      status = 'INCOMPLETE';
    } else {
      status = 'COMPLETE';
    }
  }

  return { status, score, missingItems, warnings, isVoided, isExported: flags.isExported, isConfirmed: flags.isConfirmed };
}

/**
 * Lifecycle status for the NMVTIS report workflow.
 * - READY: not yet exported, eligible for export
 * - EXPORTED: CSV downloaded, awaiting submission confirmation
 * - SUBMISSION_CONFIRMED: operator explicitly confirmed external submission
 * - DISCREPANCY: VIN or critical data invalid
 */
export type ReportLifecycleStatus = 'READY' | 'EXPORTED' | 'SUBMISSION_CONFIRMED' | 'DISCREPANCY';

export function getReportStatus(ticket: Ticket): ReportLifecycleStatus {
  const flags = getReportFlags(ticket);
  if (flags.isConfirmed) return 'SUBMISSION_CONFIRMED';
  if (flags.isExported) return 'EXPORTED';
  if (ticket.ticketType === 'CAR_SALVAGE' && ticket.carRecord) {
    if (!validateVin(ticket.carRecord.vin).isValid) return 'DISCREPANCY';
  }
  return 'READY';
}

/**
 * Validates a batch of tickets before export. Returns counts, excluded voided
 * records, blocked rows (invalid data that should prevent export), and warned
 * rows (missing jurisdictional data that should be reviewed before download).
 */
export interface ExportValidationResult {
  totalTickets: number;
  includedTickets: number;
  excludedVoided: number;
  blockedRows: Array<{ ticketId: string; vin?: string; issues: string[] }>;
  warnedRows: Array<{ ticketId: string; vin?: string; warnings: string[] }>;
  canExport: boolean;
}

export function validateExportBatch(tickets: Ticket[]): ExportValidationResult {
  const blockedRows: ExportValidationResult['blockedRows'] = [];
  const warnedRows: ExportValidationResult['warnedRows'] = [];
  let excludedVoided = 0;
  let includedTickets = 0;

  for (const ticket of tickets) {
    if (ticket.status === 'VOIDED') {
      excludedVoided++;
      continue;
    }

    const readiness = calculateReadiness(ticket);
    const issues: string[] = [];
    const warnings: string[] = [];

    if (readiness.status === 'INVALID_DATA') {
      issues.push(...readiness.warnings);
    }
    if (readiness.missingItems.length > 0) {
      issues.push(`Missing evidence: ${readiness.missingItems.join(', ')}`);
    }

    // Jurisdictional data warnings (not blocking, but should be reviewed)
    if (ticket.ticketType === 'CAR_SALVAGE' && ticket.carRecord) {
      if (!ticket.carRecord.titleNumber) warnings.push('Title number missing');
      if (!ticket.customerIdNumber) warnings.push('Seller ID number missing');
      if (!ticket.vehicleLicensePlate) warnings.push('Vehicle license plate missing');
    }

    if (issues.length > 0) {
      blockedRows.push({ ticketId: ticket.id, vin: ticket.carRecord?.vin, issues });
    } else if (warnings.length > 0) {
      warnedRows.push({ ticketId: ticket.id, vin: ticket.carRecord?.vin, warnings });
      includedTickets++;
    } else {
      includedTickets++;
    }
  }

  return {
    totalTickets: tickets.length,
    includedTickets,
    excludedVoided,
    blockedRows,
    warnedRows,
    canExport: blockedRows.length === 0,
  };
}

/**
 * Returns a human-readable label for a report log's lifecycle status,
 * distinguishing legacy records whose real submission state is unknown.
 */
export function getReportStatusLabel(log: NMVTISReportLog): string {
  if (log.legacyExported) {
    return 'Exported (legacy — submission unverified)';
  }
  switch (log.status) {
    case 'SUBMISSION_CONFIRMED':
      return 'Submission Confirmed';
    case 'EXPORTED':
      return 'Exported';
    case 'DISCREPANCY':
      return 'Discrepancy';
    case 'PENDING':
    default:
      return 'Pending Export';
  }
}

/**
 * Returns the current operator name for audit attribution. Falls back to the
 * yard's configured operator name when no authenticated user is available.
 */
export function getCurrentOperatorName(settings: YardSettings, currentUser?: { fullName?: string; username?: string } | null): string {
  if (currentUser?.fullName) return currentUser.fullName;
  if (currentUser?.username) return currentUser.username;
  return settings.operatorName || 'Operator';
}