import { prisma } from "./db.js";

/** Default StaffRole rows (keys stable for seeds). */
export const DEFAULT_STAFF_ROLES = [
  { key: "admin", label: "Super Admin", permissions: ["*"] as string[] },
  {
    key: "operator",
    label: "Operator",
    permissions: [
      "analytics.read",
      "leads.read",
      "leads.write",
      "bookings.read",
      "followups.read",
      "followups.write",
    ],
  },
  {
    key: "viewer",
    label: "Viewer",
    permissions: ["analytics.read", "leads.read", "bookings.read", "followups.read"],
  },
] as const;

export async function ensureDefaultStaffRoles(): Promise<void> {
  for (const r of DEFAULT_STAFF_ROLES) {
    await prisma.staffRole.upsert({
      where: { key: r.key },
      create: {
        key: r.key,
        label: r.label,
        permissions: [...r.permissions],
        isSystem: true,
      },
      // Never reset permissions on existing rows — admins customize built-in roles in the UI.
      // (Previously this overwrote operator/viewer after every login and GET /admin/roles.)
      update: {
        label: r.label,
        isSystem: true,
        ...(r.key === "admin" ? { permissions: ["*"] as string[] } : {}),
      },
    });
  }
}

export function staffHasPermission(permissions: string[], required: string): boolean {
  if (permissions.includes("*")) return true;
  return permissions.includes(required);
}
