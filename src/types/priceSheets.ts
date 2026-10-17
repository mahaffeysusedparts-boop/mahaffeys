export interface PartsPriceRow {
  id: string;
  category: string;
  name: string;
  priceKind: 'fixed'|'range'|'description';
  price: string;
  unit: string;
  core: string;
  warranty: string;
  conditions: string;
}
export interface ReviewedPriceRow extends PartsPriceRow {
  sourceText: string;
  page: number;
  reviewed: boolean;
}
export interface PriceSheetDraft {
  id: string;
  fileName: string;
  revision: number;
  status: 'PROCESSING'|'REVIEW'|'FAILED';
  rows: ReviewedPriceRow[];
  warnings: string[];
  extractedText: string;
  error: string|null;
}
export interface PublishedPartsPrices {
  version: string|null;
  publishedAt: string|null;
  legacy: boolean;
  rows: PartsPriceRow[];
}
export interface PriceSheetHistory {
  id: string;
  publishedAt: string;
  documentId: string;
  rowCount: number;
}
