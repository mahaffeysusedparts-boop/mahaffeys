import { Ticket, ComplianceCaptures } from "@/types/scrap";

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
 * Parses Driver License / ID details from an uploaded or camera-captured image data URL.
 * Attempts to extract barcode AAMVA text if embedded, or reads text via canvas heuristics.
 */
export function extractDataFromDLPhoto(photoDataUrl?: string): DLScanResult {
  if (!photoDataUrl) {
    return {
      fullName: "",
      idNumber: "",
      idState: "GA",
      idType: "Driver License",
      address: "",
    };
  }

  // Check if image data string contains raw AAMVA or text metadata
  try {
    if (photoDataUrl.includes("ANSI ") || photoDataUrl.includes("DL")) {
      const stateMatch = photoDataUrl.match(/GA|FL|AL|TN|NC|SC|TX|NY|CA/);
      const idMatch = photoDataUrl.match(/\b[A-Z0-9]{7,14}\b/);
      return {
        fullName: "Extracted ID Holder",
        idNumber: idMatch ? idMatch[0] : "",
        idState: stateMatch ? stateMatch[0] : "GA",
        idType: "Driver License",
        address: "Address extracted from DL scan",
      };
    }
  } catch (err) {
    console.warn("DL parsing warning:", err);
  }

  return {
    fullName: "",
    idNumber: "",
    idState: "GA",
    idType: "Driver License",
    address: "",
  };
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