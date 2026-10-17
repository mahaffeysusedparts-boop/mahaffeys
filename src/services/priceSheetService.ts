import { apiRequest } from './apiClient';
import type { PriceSheetDraft, PriceSheetHistory, PublishedPartsPrices, ReviewedPriceRow } from '@/types/priceSheets';

export const priceSheetService = {
  list: () => apiRequest<{drafts:Array<Pick<PriceSheetDraft,'id'|'fileName'|'status'|'revision'>>;history:PriceSheetHistory[];activeVersion:string|null}>('/api/price-sheets'),
  draft: (id: string) => apiRequest<PriceSheetDraft>(`/api/price-sheets/${encodeURIComponent(id)}`),
  async upload(file: File) {
    if (file.size>5*1024*1024) throw new Error('PDF must be 5 MB or smaller');
    const base64 = await new Promise<string>((resolve,reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('Unable to read the selected PDF'));
      reader.readAsDataURL(file);
    });
    return apiRequest<PriceSheetDraft>('/api/price-sheets',{method:'POST',body:JSON.stringify({fileName:file.name,base64})});
  },
  save: (id: string,revision: number,rows: ReviewedPriceRow[]) => apiRequest<PriceSheetDraft>(`/api/price-sheets/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({revision,rows})}),
  retry: (id: string,revision: number) => apiRequest<PriceSheetDraft>(`/api/price-sheets/${encodeURIComponent(id)}/retry`,{method:'POST',body:JSON.stringify({revision,discardDraft:true})}),
  publish: (id: string,revision: number,expectedActiveVersion: string|null) => apiRequest<{version:string}>(`/api/price-sheets/${encodeURIComponent(id)}/publish`,{method:'POST',body:JSON.stringify({revision,expectedActiveVersion,reviewedWarnings:true})}),
  rollback: (version: string,expectedActiveVersion: string) => apiRequest<{version:string}>('/api/price-sheets/rollback',{method:'POST',body:JSON.stringify({version,expectedActiveVersion})}),
  publicPrices: () => apiRequest<PublishedPartsPrices>('/api/public/parts-prices',{cache:'no-cache'}),
  originalUrl: (id: string) => `${(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/,'')}/api/price-sheets/${encodeURIComponent(id)}/document`,
};
