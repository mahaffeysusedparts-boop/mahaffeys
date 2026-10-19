import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './apiClient';
import { normalizeIntakeRequirements, type IntakeRequirements, type IntakeRequirementFlags } from '@/types/intakeRequirements';

export const intakeRequirementsService = {
  get: async () => normalizeIntakeRequirements(await apiRequest<IntakeRequirements>('/api/scrap-buying/requirements')),
  save: async (flags: IntakeRequirementFlags, revision: number, reason: string) =>
    normalizeIntakeRequirements(await apiRequest<IntakeRequirements>('/api/scrap-buying/requirements', {
      method: 'PUT', body: JSON.stringify({ ...flags, revision, reason }),
    })),
};

export function useIntakeRequirements() {
  return useQuery({ queryKey: ['intake-requirements'], queryFn: intakeRequirementsService.get, refetchInterval: 10000 });
}
