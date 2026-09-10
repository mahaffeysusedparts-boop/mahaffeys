import type { UserRole } from "@/types/scrap";

/**
 * Page keys used by ProtectedRoute/Navbar/Settings. Keys map 1:1 to the
 * workstation routes; the defaults ship conservative (scale operators get the
 * transaction surfaces, yard employees get the yard surfaces).
 */
export const PAGE_KEYS = [
  "dashboard",
  "operations",
  "intake",
  "scale-log",
  "tickets",
  "cash-drawer",
  "customers",
  "cameras",
  "compliance",
  "pull-a-part",
  "yard-map",
  "containers",
  "inventory",
  "pricing",
  "shipments",
  "reports",
  "team",
  "users",
  "server-admin",
  "settings",
  "system-status",
] as const;

export type PageKey = (typeof PAGE_KEYS)[number];

export const PAGE_LABELS: Record<PageKey, string> = {
  dashboard: "Dashboard",
  operations: "Operations",
  intake: "Intake Station",
  "scale-log": "Scale Log",
  tickets: "Ticket Ledger",
  "cash-drawer": "Cash Drawer",
  customers: "Customers",
  cameras: "Cameras",
  compliance: "Compliance & NMVTIS",
  "pull-a-part": "Junk Yard Cars",
  "yard-map": "Yard Map",
  containers: "Containers",
  inventory: "Public Inventory",
  pricing: "Metal Rates",
  shipments: "Mill Shipments",
  reports: "Reports",
  team: "Team Ops",
  users: "User Access",
  "server-admin": "Server Admin",
  settings: "Settings",
  "system-status": "System Status",
};

export const DEFAULT_ROLE_PAGE_ACCESS: Record<UserRole, PageKey[]> = {
  admin: [...PAGE_KEYS],
  yard_manager: [...PAGE_KEYS],
  scale_operator: [
    "dashboard",
    "intake",
    "scale-log",
    "tickets",
    "cash-drawer",
    "customers",
    "cameras",
  ],
  yard_employee: [
    "dashboard",
    "yard-map",
    "pull-a-part",
    "containers",
    "inventory",
  ],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrator",
  yard_manager: "Yard Manager",
  scale_operator: "Scale Operator",
  yard_employee: "Yard Employee",
};

function normalizeKey(value: string): PageKey | null {
  return (PAGE_KEYS as readonly string[]).includes(value) ? (value as PageKey) : null;
}

/**
 * Effective page access for a role: stored admin overrides win, otherwise the
 * built-in defaults. Unknown keys in an override are dropped.
 */
export function getAccessiblePages(
  role: UserRole | undefined,
  overrides?: Partial<Record<UserRole, string[]>> | null,
): PageKey[] {
  if (!role) return [];
  const override = overrides?.[role];
  if (Array.isArray(override)) {
    const normalized = override
      .map(normalizeKey)
      .filter((key): key is PageKey => key !== null);
    // De-duplicate while preserving order.
    return Array.from(new Set(normalized));
  }
  return DEFAULT_ROLE_PAGE_ACCESS[role];
}

export function canAccessPage(
  role: UserRole | undefined,
  page: string,
  overrides?: Partial<Record<UserRole, string[]>> | null,
): boolean {
  const key = normalizeKey(page);
  // Routes without a registered page key stay open (public pages live outside ProtectedRoute).
  if (!key) return true;
  if (role === "admin" || role === "yard_manager") return true;
  return getAccessiblePages(role, overrides).includes(key);
}
