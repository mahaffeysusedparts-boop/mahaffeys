import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './apiClient';
import { normalizePaymentSafeguards, type PaymentSafeguards } from '@/types/paymentSafeguards';

export const paymentSafeguardsService = {
  get: async () => normalizePaymentSafeguards(await apiRequest<PaymentSafeguards>('/api/scrap-buying/safeguards')),
  save: (enabled: boolean, revision: number, reason: string) => apiRequest<PaymentSafeguards>('/api/scrap-buying/safeguards',{method:'PUT',body:JSON.stringify({enabled,revision,reason})}),
};

export function usePaymentSafeguards() {
  return useQuery({queryKey:['payment-safeguards'],queryFn:paymentSafeguardsService.get,refetchInterval:5000});
}
