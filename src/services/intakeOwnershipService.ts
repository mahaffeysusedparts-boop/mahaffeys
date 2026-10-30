import { apiRequest } from './apiClient';

// Separate tabs get distinct identities, even when they share a login.
export const intakeClientId = crypto.randomUUID();
export interface IntakeOwner { ticketId: string; userId: string; operatorName: string; clientId: string; expiresAt: string }
const pending = new Map<string, Promise<{ claimed: boolean; owner: IntakeOwner | null }>>();
export const intakeOwnershipService = {
  list: () => apiRequest<IntakeOwner[]>('/api/scrap-buying/ownership'),
  update(ticketId: string, action: 'CLAIM' | 'RENEW' | 'RELEASE', replaceClientId?: string) {
    // Preserve claim/release order during rapid navigation and React effect remounts.
    const request = (pending.get(ticketId) ?? Promise.resolve()).catch(() => undefined).then(() =>
      apiRequest<{ claimed: boolean; owner: IntakeOwner | null }>('/api/scrap-buying/ownership', {
        method: 'POST', body: JSON.stringify({ ticketId, action, clientId: intakeClientId, replaceClientId }),
      }));
    pending.set(ticketId, request);
    const cleanup = () => { if (pending.get(ticketId) === request) pending.delete(ticketId); };
    request.then(cleanup, cleanup);
    return request;
  },
};
