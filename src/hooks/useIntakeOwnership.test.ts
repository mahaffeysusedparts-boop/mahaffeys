// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useIntakeOwnership } from './useIntakeOwnership';
const mocks = vi.hoisted(() => ({ update: vi.fn(), refetch: vi.fn(), owners: [] as any[] }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'OWNER' } }) }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: mocks.owners, refetch: mocks.refetch, isError: false }) }));
vi.mock('@/services/intakeOwnershipService', () => ({ intakeClientId: 'DESK', intakeOwnershipService: { list: vi.fn(), update: mocks.update } }));
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); mocks.owners = []; mocks.update.mockReset(); });
describe('verified editor lease', () => {
  it('pauses on local expiry without waiting for the next renewal', async () => {
    vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const owner = { ticketId: 'TEST', userId: 'OWNER', clientId: 'DESK', operatorName: 'Operator', expiresAt: new Date(Date.now() + 1500).toISOString() };
    mocks.update.mockResolvedValue({ claimed: true, owner });
    let observed!: ReturnType<typeof useIntakeOwnership>;
    function Editor() { observed = useIntakeOwnership('TEST', () => {}); return null; }
    const root = createRoot(document.createElement('div'));
    await act(async () => { root.render(createElement(Editor)); });
    expect(observed.owned).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(observed.owned).toBe(false);
    expect(observed.error).toContain('expired');
    await act(async () => root.unmount());
  });
  it('pauses if polling omits the lease or reports a different owner', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const owner = { ticketId: 'TEST', userId: 'OWNER', clientId: 'DESK', operatorName: 'Operator', expiresAt: new Date(Date.now() + 90000).toISOString() };
    mocks.update.mockResolvedValue({ claimed: true, owner });
    let observed!: ReturnType<typeof useIntakeOwnership>;
    function Editor() { observed = useIntakeOwnership('TEST', () => {}); return null; }
    const root = createRoot(document.createElement('div'));
    await act(async () => { root.render(createElement(Editor)); });
    expect(observed.owned).toBe(true);
    mocks.owners = [];
    await act(async () => root.render(createElement(Editor)));
    expect(observed.owned).toBe(false);
    mocks.owners = [{ ...owner, clientId: 'OTHER', operatorName: 'Other desk' }];
    await act(async () => root.render(createElement(Editor)));
    expect(observed.owned).toBe(false);
    expect(observed.error).toContain('Other desk');
    await act(async () => root.unmount());
  });
});
