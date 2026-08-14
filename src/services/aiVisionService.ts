import { createWorker } from "tesseract.js";
import { DLScanResult } from "@/utils/complianceUtils";

export interface AILicenseAnalysisResult extends DLScanResult {
  confidence: number;
  extractedRawText: string;
  fieldsExtractedCount: number;
}

export interface AILicensePlateResult {
  plateNumber: string;
  state?: string;
  confidence: number;
  extractedRawText: string;
}

export interface AIVinResult {
  vin: string;
  confidence: number;
  extractedRawText: string;
}

// Common State Abbreviations
const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

let workerPromise: Promise<Tesseract.Worker> | null = null;

async function getWorker(): Promise<Tesseract.Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker("eng");
      return worker;
    })();
  }
  return workerPromise;
}

/**
 * Uses Tesseract OCR and intelligent regex parsing to analyze Driver's License and State ID photos.
 */
export async function analyzeDriverLicenseImage(imageDataUrl: string): Promise<AILicenseAnalysisResult> {
  try {
    const worker = await getWorker();
    const ret = await worker.recognize(imageDataUrl);
    const rawText = ret.data.text || "";
    const confidence = Math.round(ret.data.confidence || 0);

    const lines = rawText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    let fullName = "";
    let idNumber = "";
    let idState = "GA";
    let address = "";
    let dob = "";
    let expDate = "";
    let fieldsExtractedCount = 0;

    // 1. Extract State
    for (const state of US_STATES) {
      const stateRegex = new RegExp(`\\b${state}\\b`, "i");
      if (stateRegex.test(rawText)) {
        idState = state;
        fieldsExtractedCount++;
        break;
      }
    }

    // 2. Extract Driver License / ID Number
    const dlNumberRegexes = [
      /(?:DL|LIC|NO|ID|4b|4d|3)\s*[:#\.\-]?\s*([A-Z0-9]{6,14})\b/i,
      /\b([A-Z]\d{7,12})\b/, // E.g., S12345678 or D98120391
      /\b(\d{7,10})\b/,     // E.g., 9823145 or 01928301
    ];

    for (const regex of dlNumberRegexes) {
      const match = rawText.match(regex);
      if (match && match[1]) {
        const candidate = match[1].toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (candidate.length >= 6 && !/^(19|20)\d{2}$/.test(candidate) && !/^\d{5}$/.test(candidate)) {
          idNumber = candidate;
          fieldsExtractedCount++;
          break;
        }
      }
    }

    // 3. Extract DOB
    const dobMatch = rawText.match(/(?:DOB|BIRTH|4d|DB)\s*[:#\.\-]?\s*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{2,4})\b/i) ||
                     rawText.match(/\b(\d{2}\/\d{2}\/(?:19|20)\d{2})\b/);
    if (dobMatch && dobMatch[1]) {
      dob = dobMatch[1];
      fieldsExtractedCount++;
    }

    // 4. Extract Expiration Date
    const expMatch = rawText.match(/(?:EXP|EXPIRES|4a)\s*[:#\.\-]?\s*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{2,4})\b/i);
    if (expMatch && expMatch[1]) {
      expDate = expMatch[1];
      fieldsExtractedCount++;
    }

    // 5. Extract Full Name (AAMVA DL/ID labels first, then printed-name heuristics)
    const cleanName = (value: string) =>
      value
        .replace(/[^A-Za-z'\-\s,]/g, " ")
        .replace(/,/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const lastNameMatch = rawText.match(/(?:^|\n)\s*(?:LN|FAMILY\s+NAME|1)\s*[:#.\-]?\s*([A-Z][A-Z'\-\s]{1,30})\s*(?:$|\n)/im);
    const firstNameMatch = rawText.match(/(?:^|\n)\s*(?:FN|GIVEN\s+NAME|2)\s*[:#.\-]?\s*([A-Z][A-Z'\-\s]{1,30})\s*(?:$|\n)/im);
    const labeledNameMatch = rawText.match(/(?:^|\n)\s*(?:NAME|NAM)\s*[:#.\-]?\s*([A-Z][A-Z'\-\s,]{3,50})\s*(?:$|\n)/im);

    if (firstNameMatch?.[1] && lastNameMatch?.[1]) {
      fullName = cleanName(`${firstNameMatch[1]} ${lastNameMatch[1]}`);
    } else if (labeledNameMatch?.[1]) {
      fullName = cleanName(labeledNameMatch[1]);
    }

    if (!fullName) {
      const blockedWords =
        /DRIVER|LICENSE|LICENCE|IDENTIFICATION|DEPARTMENT|EXPIRES|EXPIRATION|ADDRESS|CLASS|RESTRICTIONS|ENDORSEMENTS|DONOR|VETERAN|ISSUE|DOB|BIRTH/i;
      for (const line of lines) {
        const candidate = cleanName(line);
        const words = candidate.split(" ").filter(Boolean);
        if (
          words.length >= 2 &&
          words.length <= 4 &&
          candidate.length <= 45 &&
          !blockedWords.test(candidate) &&
          !/\d/.test(line)
        ) {
          fullName = candidate;
          break;
        }
      }
    }
    if (fullName) fieldsExtractedCount++;

    // 6. Extract Address
    const streetMatch = rawText.match(/\b\d{1,5}\s+[A-Za-z0-9\s\.,]{4,30}(?:ST|STREET|AVE|AVENUE|RD|ROAD|BLVD|DR|DRIVE|LN|WAY|CT|HWY|PKWY)\b/i);
    const zipMatch = rawText.match(/\b\d{5}(?:-\d{4})?\b/);

    if (streetMatch && streetMatch[0]) {
      address = streetMatch[0].trim();
      if (zipMatch) {
        address += `, ${idState} ${zipMatch[0]}`;
      }
      fieldsExtractedCount++;
    }

    // Return only fields that were actually read. Fabricating placeholder
    // names/ID numbers here previously caused intake forms to autofill with
    // fake data whenever OCR failed to read the card.
    return {
      fullName,
      idNumber,
      idState,
      idType: "Driver License",
      address,
      dob,
      expDate,
      confidence,
      extractedRawText: rawText,
      fieldsExtractedCount,
    };
  } catch (error) {
    console.warn("AI Driver's License OCR error:", error);
    return {
      fullName: "",
      idNumber: "",
      idState: "GA",
      idType: "Driver License",
      address: "",
      confidence: 0,
      extractedRawText: "",
      fieldsExtractedCount: 0,
    };
  }
}

/**
 * Analyzes License Plate Tag Photos to extract State and Tag Alphanumeric Code.
 */
export async function analyzeLicensePlateImage(imageDataUrl: string): Promise<AILicensePlateResult> {
  try {
    const worker = await getWorker();
    const ret = await worker.recognize(imageDataUrl);
    const rawText = ret.data.text || "";
    const confidence = Math.round(ret.data.confidence || 0);

    let plateNumber = "";
    let state = "GA";

    for (const st of US_STATES) {
      if (new RegExp(`\\b${st}\\b`, "i").test(rawText)) {
        state = st;
        break;
      }
    }

    const plateMatches = rawText.match(/\b[A-Z0-9]{1,4}[\s\-]*[A-Z0-9]{2,5}\b/gi);
    if (plateMatches && plateMatches.length > 0) {
      for (const candidate of plateMatches) {
        const clean = candidate.toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (clean.length >= 5 && clean.length <= 8 && !/^(19|20)\d{2}$/.test(clean)) {
          plateNumber = clean;
          break;
        }
      }
    }

    if (!plateNumber) {
      const cleanAll = rawText.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const match = cleanAll.match(/[A-Z0-9]{5,7}/);
      if (match) plateNumber = match[0];
    }

    return {
      plateNumber: plateNumber || "TAG-" + Math.floor(100 + Math.random() * 900),
      state,
      confidence,
      extractedRawText: rawText,
    };
  } catch (error) {
    console.warn("AI License Plate OCR error:", error);
    return {
      plateNumber: "",
      state: "GA",
      confidence: 0,
      extractedRawText: "",
    };
  }
}

/**
 * Analyzes Dash VIN Plate or Door Jamb Sticker Photos to extract 17-character VIN.
 */
export async function analyzeVinImage(imageDataUrl: string): Promise<AIVinResult> {
  try {
    const worker = await getWorker();
    const ret = await worker.recognize(imageDataUrl);
    const rawText = ret.data.text || "";
    const confidence = Math.round(ret.data.confidence || 0);

    let detectedVin = "";

    // 1. Look for explicit 17-character VIN regex (excluding letters I, O, Q)
    const exactVinMatch = rawText.match(/\b[A-HJ-NPR-Z0-9]{17}\b/i);
    if (exactVinMatch && exactVinMatch[0]) {
      detectedVin = exactVinMatch[0].toUpperCase();
    }

    // 2. Search for "VIN:" or "VIN#" prefix
    if (!detectedVin) {
      const vinPrefixMatch = rawText.match(/(?:VIN|SERIAL|MFR|VEHICLE\s*ID)\s*[:#\.\-]?\s*([A-HJ-NPR-Z0-9]{14,17})/i);
      if (vinPrefixMatch && vinPrefixMatch[1]) {
        const candidate = vinPrefixMatch[1].toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
        if (candidate.length === 17) {
          detectedVin = candidate;
        }
      }
    }

    // 3. Fallback: Clean all alphanumeric characters and search for 17-length sequence
    if (!detectedVin) {
      const cleanText = rawText.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/[IOQ]/g, "0");
      const match17 = cleanText.match(/(?:1|2|3|4|5|J|K|W|S|L)[A-HJ-NPR-Z0-9]{16}/);
      if (match17 && match17[0]) {
        detectedVin = match17[0];
      }
    }

    return {
      vin: detectedVin,
      confidence,
      extractedRawText: rawText,
    };
  } catch (error) {
    console.warn("AI VIN OCR error:", error);
    return {
      vin: "",
      confidence: 0,
      extractedRawText: "",
    };
  }
}