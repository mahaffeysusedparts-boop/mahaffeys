import { apiRequest } from './apiClient';
import type { BinDeductionCatalog, BinCycle, BinReview, BinSelection } from '@/types/binDeductions';
export const binInspectionService = {
  catalog: () => apiRequest<BinDeductionCatalog>('/api/scrap-buying/bin-deduction-catalog', { signal: AbortSignal.timeout(4000) }),
  saveCatalog: (catalog: BinDeductionCatalog) => apiRequest<BinDeductionCatalog>('/api/scrap-buying/bin-deduction-catalog', { method: 'PUT', signal: AbortSignal.timeout(10000), body: JSON.stringify(catalog) }),
  queue: (cycleId?: string) => apiRequest<{ cycles: BinCycle[] }>(`/api/scrap-buying/bin-inspections${cycleId ? `?cycleId=${encodeURIComponent(cycleId)}` : ''}`, { signal: AbortSignal.timeout(4000) }),
  submit: (cycleId: string, expectedRevision: number, catalogRevision: number, selections: BinSelection[]) => apiRequest<BinReview>('/api/scrap-buying/bin-inspections', { method: 'POST', signal: AbortSignal.timeout(10000), body: JSON.stringify({ cycleId, expectedRevision, catalogRevision, selections }) }),
};
