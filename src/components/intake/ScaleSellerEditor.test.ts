// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { intakeDraftAccess } from '@/services/intakeDraftStorage';
import { ScaleSellerEditor } from './ScaleSellerEditor';
import type { Ticket } from '@/types/scrap';
const mocks = vi.hoisted(() => ({ profile: { data: undefined as any, isLoading: true, isError: false, refetch: vi.fn() } }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'SELLER-TEST' } }) }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => mocks.profile }));
vi.mock('@/components/compliance/ComplianceCaptureModal', () => ({ ComplianceCaptureModal: () => null }));
describe('seller restoration lifecycle', () => {
  it('restores address independently of phone and preserves it through a late profile response', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const ticket = { id: 'RESTORE', customerId: 'PROFILE', customerName: 'Seller', customerAddress: 'Original' } as Ticket;
    await intakeDraftAccess('SELLER-TEST:scale-seller:RESTORE', 'write', { values: { address: 'Recovered correction' }, savedAt: new Date().toISOString() });
    const container = document.createElement('div'); document.body.appendChild(container);
    const root = createRoot(container);
    const render = () => root.render(createElement(ScaleSellerEditor, { ticket, onSave: vi.fn(), onDirtyChange: vi.fn() }));
    await act(async () => render());
    await act(async () => { await intakeDraftAccess('SELLER-TEST:scale-seller:RESTORE', 'read'); });
    expect(container.textContent).toContain('Resume draft');
    const resume = [...container.querySelectorAll('button')].find(button => button.textContent === 'Resume draft')!;
    await act(async () => resume.click());
    expect((container.querySelector('#scale-seller-address') as HTMLInputElement).value).toBe('Recovered correction');
    mocks.profile = { ...mocks.profile, isLoading: false, data: { address: 'Late profile address', idState: 'SC', idType: 'Driver License' } };
    await act(async () => render());
    expect((container.querySelector('#scale-seller-address') as HTMLInputElement).value).toBe('Recovered correction');
    await act(async () => root.unmount()); container.remove();
  });
});
