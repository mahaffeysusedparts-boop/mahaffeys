export interface PaymentSafeguards {
  enabled: boolean;
  revision: number;
  updatedAt: string | null;
  updatedBy: string | null;
  reason: string;
}

export const DEFAULT_PAYMENT_SAFEGUARDS: PaymentSafeguards = {
  enabled: true,
  revision: 0,
  updatedAt: null,
  updatedBy: null,
  reason: 'Payment-rule safeguards enabled by default',
};

export function normalizePaymentSafeguards(value: Partial<PaymentSafeguards> = {}): PaymentSafeguards {
  return { ...DEFAULT_PAYMENT_SAFEGUARDS, ...value, enabled: value.enabled !== false };
}
