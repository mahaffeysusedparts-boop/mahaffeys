import type { Customer } from '@/types/scrap';
import { apiRequest } from './apiClient';

export interface CustomerListParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CustomerListResponse {
  customers: Customer[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CustomerInput {
  fullName: string;
  phone: string;
  idType: Customer['idType'];
  idNumber: string;
  idState: string;
  address: string;
  vehicleLicensePlate?: string;
  vehicleState?: string;
  notes?: string;
  idPhotoUrl?: string;
  isCommercial: boolean;
  companyName?: string;
  businessAddress?: string;
}

export const customerService = {
  list: ({ search = '', page = 1, pageSize = 25 }: CustomerListParams = {}) => {
    const params = new URLSearchParams({
      search,
      page: String(page),
      pageSize: String(pageSize),
    });
    return apiRequest<CustomerListResponse>(`/api/customers?${params.toString()}`);
  },

  create: (customer: CustomerInput) => apiRequest<Customer>('/api/customers', {
    method: 'POST',
    body: JSON.stringify(customer),
  }),

  update: (id: string, customer: CustomerInput) => apiRequest<Customer>(`/api/customers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(customer),
  }),
};
