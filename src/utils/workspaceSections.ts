import { UserRole } from '@/types/scrap';
import { hasPageAccess, type PageAccessOverrides, type PageKey } from '@/utils/pageAccess';

export type WorkspaceKind = 'settings' | 'analytics';
export interface WorkspaceSection {
  id: string;
  label: string;
  page: PageKey;
  adminOnly?: boolean;
}

export const workspaceSections: Record<WorkspaceKind, WorkspaceSection[]> = {
  settings: [
    { id: 'general', label: 'Yard settings', page: 'settings', adminOnly: true },
    { id: 'pricing', label: 'Pricing & parts', page: 'pricing' },
    { id: 'users', label: 'User access', page: 'users', adminOnly: true },
    { id: 'server', label: 'Server & backups', page: 'server-admin', adminOnly: true },
  ],
  analytics: [
    { id: 'reports', label: 'Reports', page: 'reports' },
    { id: 'business', label: 'Business intelligence', page: 'server-admin', adminOnly: true },
    { id: 'operations', label: 'Operations review', page: 'operations-review' },
    { id: 'scales', label: 'Scale activity', page: 'scale-log' },
    { id: 'health', label: 'System health', page: 'system-status' },
  ],
};

export function canOpenSection(role: UserRole, section: WorkspaceSection, overrides?: PageAccessOverrides) {
  return (!section.adminOnly || role === 'admin') && hasPageAccess(role, section.page, overrides);
}

export function canOpenWorkspace(role: UserRole, kind: WorkspaceKind, overrides?: PageAccessOverrides) {
  return workspaceSections[kind].some(section => canOpenSection(role, section, overrides));
}
