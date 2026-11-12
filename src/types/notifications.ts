export const NOTIFICATION_ACTIONS = {
  'purchase.created': 'New scrap intake created',
  'purchase.paid': 'Purchase payment recorded',
  'purchase.voided': 'Scrap purchase voided',
  'stoplight.changed': 'Scale light changed',
  'prices.changed': 'Buying prices changed',
  'customer.changed': 'Customer created, edited or merged',
  'settings.changed': 'Yard settings changed',
  'operator.login': 'Operator signed in',
} as const;
export type NotificationAction = keyof typeof NOTIFICATION_ACTIONS;
export interface NotificationRule {
  action: NotificationAction;
  recipientIds: string[];
  operatorIds: string[];
}
export interface NotificationSettings {
  rules: NotificationRule[];
  users: { id: string; fullName: string; role: string }[];
}
export interface PushStatus {
  publicKey: string;
  deviceCount: number;
  receiving: boolean;
  localPreview: boolean;
}
