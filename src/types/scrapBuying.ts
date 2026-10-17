export type WeighingType = 'PLATFORM' | 'VEHICLE_IN_OUT' | 'SPLIT_GROUPS';
export type TareTreatment = 'NONE' | 'SCALE_TARE' | 'MANUAL';

export interface WeightCapture {
  id: string;
  scaleId: string | null;
  originalWeight: number;
  originalUnit: 'LBS' | 'KG';
  normalizedLbs: number;
  actorId: string;
  capturedAt: string;
  stable: boolean;
  source: 'SCALE' | 'MANUAL';
  replacesCaptureId?: string;
}

export interface SplitProfile {
  id: string;
  version: number;
  scaleId: string;
  components: Array<{ id: string; label: string }>;
  operatingInstructions: string;
  suitabilityConfirmation?: {
    confirmedBy: string;
    confirmedAt: string;
    manufacturerReference: string;
    authorityReference: string;
  };
}

export interface WeightPass {
  id: string;
  purpose: 'LOADED' | 'TARE';
  layout: 'WHOLE_VEHICLE' | 'COMPONENTS';
  profile?: SplitProfile;
  components: Array<{ componentId: string; captureId: string }>;
  reviewed: boolean;
}

export interface WeighingCycle {
  id: string;
  ticketId: string;
  number: number;
  type: WeighingType;
  status: 'CAPTURING' | 'REVIEW' | 'CONFIRMED' | 'CANCELLED';
  loadedPass?: WeightPass;
  tarePass?: WeightPass;
  platformCaptureId?: string;
  materialGradeId?: string;
}

export interface PlatformCaptureDraft {
  capturedLbs: number;
  tareLbs: number;
  tareTreatment: TareTreatment;
  isManual: boolean;
  capture: WeightCapture;
}

export interface WeighingCorrection {
  id: string;
  at: string;
  actor: string;
  reason: string;
  action: 'CANCEL_WEIGHING' | 'REMOVE_LINE';
  sourceCaptureIds: string[];
  originalLine?: import('./scrap').ScrapTicketLine;
  originalGrossLbs?: number;
  originalTareLbs?: number;
}
