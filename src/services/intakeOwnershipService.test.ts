import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('./apiClient', () => ({ apiRequest: mocks.request }));
beforeEach(() => { vi.resetModules(); mocks.request.mockReset(); });

describe('intake workstation ownership', () => {
  it('keeps claim, release and remount claim requests in order', async () => {
    let finishClaim!: (value: { claimed: boolean; owner: null }) => void;
    mocks.request.mockImplementationOnce(() => new Promise(resolve => { finishClaim = resolve; }))
      .mockResolvedValueOnce({ claimed: false, owner: null }).mockResolvedValueOnce({ claimed: true, owner: null });
    const { intakeOwnershipService } = await import('./intakeOwnershipService');
    const claim = intakeOwnershipService.update('TEST-TICKET', 'CLAIM');
    const release = intakeOwnershipService.update('TEST-TICKET', 'RELEASE');
    const reclaim = intakeOwnershipService.update('TEST-TICKET', 'CLAIM');
    await vi.waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(1));
    finishClaim({ claimed: true, owner: null });
    await Promise.all([claim, release, reclaim]);
    expect(mocks.request.mock.calls.map(([, options]) => JSON.parse(options.body).action)).toEqual(['CLAIM', 'RELEASE', 'CLAIM']);
  });
  it('sends the exact previously observed owner when confirming takeover', async () => {
    mocks.request.mockResolvedValue({ claimed: true, owner: null });
    const { intakeOwnershipService, intakeClientId } = await import('./intakeOwnershipService');
    const previousClient = 'd546d441-083b-4ed8-a665-8e17e5df9d44';
    await intakeOwnershipService.update('TEST-TICKET', 'CLAIM', previousClient);
    expect(JSON.parse(mocks.request.mock.calls[0][1].body)).toEqual({ ticketId: 'TEST-TICKET', action: 'CLAIM', clientId: intakeClientId, replaceClientId: previousClient });
  });
  it('gives fresh page instances distinct ownership identities', async () => {
    const first = (await import('./intakeOwnershipService')).intakeClientId;
    vi.resetModules();
    const second = (await import('./intakeOwnershipService')).intakeClientId;
    expect(first).not.toBe(second);
  });
});
