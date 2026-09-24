import { UserRole } from '@/types/scrap';

/**
 * Per-role page permissions.
 *
 * Defaults ship conservative; admins can override each role's access in
 * Settings (persisted into the synced yard settings). Admins always have
 * access to everything and cannot be locked out.
 */

export const PAGE_KEYS = [
  'dashboard', 'operations', 'intake', 'scale-log', 'tickets', 'cash-drawer', 'customers', 'cameras',
  'yard-map', 'pull-a-part', 'containers', 'public-inventory', 'compliance', 'pricing', 'shipments',
  'reports', 'team', 'system-status', 'users', 'server-admin', 'settings', 'fleet',
] as const;

export type PageKey = (typeof PAGE_KEYS)[number];

export const PAGE_LABELS: Record<PageKey, string> = {
  dashboard: 'Dashboard',
  operations: 'Operations',
  intake: 'Intake (Scale)',
  'scale-log': 'Scale Log',
  tickets: 'Tickets',
  'cash-drawer': 'Cash Drawer',
  customers: 'Customers',
  cameras: 'Cameras',
  'yard-map': 'Yard Map',
  'pull-a-part': 'Pull-a-part',
  containers: 'Containers',
  'public-inventory': 'Public inventory',
  compliance: 'Compliance & NMVTIS',
  pricing: 'Pricing / Metal Rates',
  shipments: 'Mill Shipments',
  reports: 'Reports',
  team: 'Team Ops',
    'system-status': 'System Status',
    users: 'User Access',
    'server-admin': 'Server Admin',
    settings: 'Settings',
    fleet: 'Fleet & Tools',
};

/** Conservative defaults — nothing changes for existing admin/manager users. */
export const ROLE_PAGE_ACCESS: Record<UserRole, PageKey[]> = {
  admin: [...PAGE_KEYS],
  yard_manager: [...PAGE_KEYS],
  scale_operator: ['dashboard', 'intake', 'scale-log', 'tickets', 'cash-drawer', 'customers', 'cameras'],
    yard_employee: ['dashboard', 'yard-map', 'pull-a-part', 'containers', 'public-inventory', 'fleet'],
};

/** Route path → page key (used by the Navbar to hide links a role cannot open). */
export const PATH_TO_PAGE_KEY: Record<string, PageKey> = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/operations': 'operations',
  '/intake': 'intake',
  '/scale-log': 'scale-log',
  '/tickets': 'tickets',
  '/cash-drawer': 'cash-drawer',
  '/customers': 'customers',
  '/cameras': 'cameras',
  '/yard-map': 'yard-map',
  '/pull-a-part': 'pull-a-part',
  '/containers': 'containers',
  '/inventory': 'public-inventory',
  '/compliance': 'compliance',
  '/pricing': 'pricing',
  '/shipments': 'shipments',
  '/reports': 'reports',
  '/team': 'team',
    '/fleet': 'fleet',
    '/system-status': 'system-status',
  '/users': 'users',
  '/server-admin': 'server-admin',
  '/settings': 'settings',
};

export type PageAccessOverrides = Partial<Record<UserRole, string[]>>;

/** Effective access list for a role: admin overrides, else the shipped defaults. */
export function effectivePageAccess(role: UserRole, overrides?: PageAccessOverrides): PageKey[] {
  if (role === 'admin') return [...PAGE_KEYS];
  const custom = overrides?.[role];
  if (Array.isArray(custom) && custom.length > 0) {
    return custom.filter((key): key is PageKey => (PAGE_KEYS as readonly string[]).includes(key));
  }
  return ROLE_PAGE_ACCESS[role];
}

export function hasPageAccess(role: UserRole, pageKey: PageKey, overrides?: PageAccessOverrides): boolean {
  return effectivePageAccess(role, overrides).includes(pageKey);
}
