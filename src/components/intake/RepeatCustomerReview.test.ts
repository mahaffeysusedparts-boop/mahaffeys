// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { RepeatCustomerReview } from './RepeatCustomerReview';
import type { Customer } from '@/types/scrap';
const mocks = vi.hoisted(() => ({ history: { data: undefined as any, isLoading: true, isError: false, refetch: vi.fn() } }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => mocks.history }));
vi.mock('@/services/apiClient', () => ({ apiRequest: vi.fn() }));

describe('exact-value seller reuse', () => {
  it('a late historical plate cannot replace the plate the operator confirmed', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const root = createRoot(document.createElement('div'));
    const confirm = vi.fn();
    const customer = { id: 'TEST', fullName: 'Test Seller', vehicleLicensePlate: 'REVIEWED' } as Customer;
    const render = () => root.render(createElement(RepeatCustomerReview, { customer, onCancel: vi.fn(), onConfirm: confirm, suggestMaterials: true }));
    await act(async () => render());
    const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await act(async () => checkbox.click());
    expect(checkbox.checked).toBe(true);
    mocks.history = { ...mocks.history, isLoading: false, data: { previousTicket: { id: 'OLD', createdAt: new Date().toISOString(), status: 'COMPLETED', vehicleLicensePlate: 'LATE' }, lastVehicle: null, commonMaterials: [{ name: 'Copper', visits: 1 }], historyCount: 1 } };
    await act(async () => render());
    expect((document.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false);
    const button = [...document.querySelectorAll('button')].find(button => button.textContent === 'Confirm & reuse seller details')!;
    await act(async () => button.click());
    expect(confirm).toHaveBeenCalledWith(customer, '', []);
    await act(async () => root.unmount());
  });
});
