import { apiRequest } from './apiClient';
import type { ScaleEvidenceCameraMappings } from '@/types/scaleEvidence';

export interface ScaleEvidenceConfiguration {
  scales: Array<{ id: string; name: string; evidenceCameras: ScaleEvidenceCameraMappings }>;
  cameras: Array<{ id: string; name: string }>;
}

export const scaleEvidenceService = {
  configuration: () => apiRequest<ScaleEvidenceConfiguration>('/api/scale/evidence-config'),
  saveConfiguration: (scaleId: string, mappings: ScaleEvidenceCameraMappings, expectedMappings: ScaleEvidenceCameraMappings) =>
    apiRequest<{ scaleId: string; mappings: ScaleEvidenceCameraMappings }>('/api/scale/evidence-config', {
      method: 'POST', body: JSON.stringify({ scaleId, mappings, expectedMappings }),
    }),
};
