/** Valid staff permission ids (dashboard modules). Admin role uses "*". */

export type PermissionGroup = { id: string; label: string; permissions: { id: string; label: string }[] };

export const STAFF_PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "overview",
    label: "Command Centre",
    permissions: [{ id: "overview.read", label: "View overview" }],
  },
  {
    id: "live_feed",
    label: "Live funnel",
    permissions: [{ id: "live_feed.read", label: "View live feed" }],
  },
  {
    id: "leads",
    label: "Lead profiles",
    permissions: [
      { id: "leads.read", label: "View leads" },
      { id: "leads.write", label: "Edit leads & pipeline" },
    ],
  },
  {
    id: "bookings",
    label: "Bookings",
    permissions: [{ id: "bookings.read", label: "View bookings" }],
  },
  {
    id: "followups",
    label: "Follow-up queue",
    permissions: [
      { id: "followups.read", label: "View queue" },
      { id: "followups.write", label: "Update queue (mark sent, bump, skip)" },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    permissions: [{ id: "analytics.read", label: "View analytics & reports" }],
  },
  {
    id: "admin",
    label: "Administration",
    permissions: [
      { id: "admin.users", label: "Manage staff users" },
      { id: "admin.roles", label: "Manage roles & permissions" },
    ],
  },
];

const ALL_IDS = new Set(STAFF_PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.id)));

export function isValidPermissionId(id: string): boolean {
  return ALL_IDS.has(id);
}

export function normalizePermissionList(ids: string[]): string[] {
  const out = [...new Set(ids.map((s) => s.trim()).filter(Boolean))];
  for (const id of out) {
    if (!isValidPermissionId(id)) throw new Error(`Unknown permission: ${id}`);
  }
  return out.sort();
}
