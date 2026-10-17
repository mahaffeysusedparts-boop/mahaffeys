import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './apiClient';
import type { IntakeRequirements, IntakeRequirementFlags } from '@/types/intakeRequirements';

export const intakeRequirementsService = {
  get: () => apiRequest<IntakeRequirements>('/api/scrap-buying/requirements'),
  save: (flags: IntakeRequirementFlags, revision: number, reason: string) =>
    apiRequest<IntakeRequirements>('/api/scrap-buying/requirements', {
      method: 'PUT', body: JSON.stringify({ ...flags, revision, reason }),
    }),
};

export function useIntakeRequirements() {
  return useQuery({ queryKey: ['intake-requirements'], queryFn: intakeRequirementsService.get, refetchInterval: 10000 });
}
