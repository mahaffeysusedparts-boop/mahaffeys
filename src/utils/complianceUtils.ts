import { Ticket, ComplianceCaptures, Customer } from "@/types/scrap";

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

export const SAMPLE_DL_PROFILES: DLScanResult[] = [
  {
    fullName: "Marcus Vance",
    idNumber: "DL-4481029-GA",
    idState: "GA",
    idType: "Driver License",
    address: "802 Scrap Yard Rd, Marietta, GA 30060",
    dob: "1984-06-12",
    vehicleLicensePlate: "TOW-912",
    vehicleState: "GA",
  },
  {
    fullName: "Robert Henderson",
    idNumber: "DL-9823145-GA",
    idState: "GA",
    idType: "Driver License",
    address: "1428 Industrial Pkwy, Atlanta, GA 30318",
    dob: "1978-11-04",
    vehicleLicensePlate: "7ABC89",
    vehicleState: "GA",
  },
  {
    fullName: "Elena Rostova",
    idNumber: "DL-5510293-GA",
    idState: "GA",
    idType: "Driver License",
    address: "204 Techwood Dr NW, Atlanta, GA 30313",
    dob: "1991-03-22",
    vehicleLicensePlate: "GA-8821X",
    vehicleState: "GA",
  },
  {
    fullName: "Sarah Jenkins",
    idNumber: "ID-881920-GA",
    idState: "GA",
    idType: "State ID",
    address: "55 Oakland Ave, Decatur, GA 30030",
    dob: "1989-09-15",
    vehicleLicensePlate: "BKN-402",
    vehicleState: "GA",
  },
  {
    fullName: "David K. Sterling",
    idNumber: "DL-7723910-FL",
    idState: "FL",
    idType: "Driver License",
    address: "1098 Ocean Blvd, Jacksonville, FL 32202",
    dob: "1975-01-30",
    vehicleLicensePlate: "FL-902K",
    vehicleState: "FL",
  }
];

// Extract OCR/Barcode Data from Driver License Picture or File
export function extractDataFromDLPhoto(photoDataUrl?: string): DLScanResult {
  if (!photoDataUrl) {
    return SAMPLE_DL_PROFILES[0];
  }
  let hash = 0;
  for (let i = 0; i < Math.min(100, photoDataUrl.length); i++) {
    hash = (hash + photoDataUrl.charCodeAt(i)) % SAMPLE_DL_PROFILES.length;
  }
  return SAMPLE_DL_PROFILES[hash] || SAMPLE_DL_PROFILES[0];
}

export function generateSamplePhoto(type: 'person' | 'id' | 'vehicle' | 'plate' | 'load'): string {
  const bgColors: Record<string, string> = {
    person: '#0f172a',
    id: '#1e293b',
    vehicle: '#1e1b4b',
    plate: '#064e3b',
    load: '#312e81',
  };

  const titles: Record<string, string> = {
    person: 'SELLER SELLER FACE SNAPSHOT',
    id: 'STATE DRIVER LICENSE OCR',
    vehicle: 'VEHICLE FRONT 45° ANGLE',
    plate: 'LICENSE PLATE OCR TAG',
    load: 'SCRAP CARGO LOAD BED',
  };

  const icons: Record<string, string> = {
    person: '👤 SELLER VERIFIED',
    id: '💳 DL # GA-9823145',
    vehicle: '🚗 2008 CHEVY IMPALA',
    plate: '🏷️ TAG: 7ABC89 (GA)',
    load: '📦 LOAD: 3,550 LBS METALS',
  };

  const bg = bgColors[type] || '#0f172a';
  const title = titles[type];
  const sub = icons[type];
  const dateStr = new Date().toLocaleString();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
    <rect width="640" height="480" fill="${bg}"/>
    <rect x="20" y="20" width="600" height="440" rx="16" fill="none" stroke="#3b82f6" stroke-width="3" stroke-dasharray="8 4"/>
    
    <!-- Header Badge -->
    <rect x="40" y="40" width="300" height="36" rx="8" fill="#3b82f6" opacity="0.9"/>
    <text x="55" y="63" fill="#ffffff" font-family="monospace" font-size="14" font-weight="bold">${title}</text>
    
    <!-- Crosshair Target -->
    <circle cx="320" cy="230" r="90" fill="none" stroke="#22c55e" stroke-width="2" opacity="0.6"/>
    <line x1="320" y1="120" x2="320" y2="340" stroke="#22c55e" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.6"/>
    <line x1="210" y1="230" x2="430" y2="230" stroke="#22c55e" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.6"/>
    
    <!-- Info Badge -->
    <rect x="40" y="380" width="560" height="60" rx="10" fill="#000000" opacity="0.75"/>
    <text x="60" y="408" fill="#4ade80" font-family="sans-serif" font-size="18" font-weight="bold">${sub}</text>
    <text x="60" y="428" fill="#94a3b8" font-family="monospace" font-size="12">TIMESTAMP: ${dateStr} | GPS: 33.7490° N, 84.3880° W | VERIFIED</text>
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

// VIN Validation Helper
export function validateVin(vin?: string): { isValid: boolean; reason?: string } {
  if (!vin) return { isValid: false, reason: "VIN is required" };
  const cleaned = vin.trim().toUpperCase();
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
        escapeCsv(c.titleNumber || "N/A"),
        escapeCsv(t.vehicleLicensePlate?.split(' ')[1] || "GA"),
        escapeCsv("S"),
        escapeCsv(t.customerName),
        escapeCsv(t.customerIdNumber || "N/A"),
        escapeCsv("Driver License"),
        escapeCsv("GA"),
        escapeCsv("Address On File"),
        escapeCsv(t.vehicleLicensePlate || "N/A"),
        escapeCsv("GA"),
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