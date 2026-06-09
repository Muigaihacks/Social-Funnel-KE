import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/db.js";
import { verifyStaffToken } from "../lib/jwt.js";

export type StaffAuth = {
  id: string;
  email: string;
  permissions: string[];
  roleKey: string;
};

export type StaffRequest = Request & { staff?: StaffAuth };

export async function requireStaff(req: StaffRequest, res: Response, next: NextFunction) {
  try {
    const raw = req.headers.authorization;
    if (!raw?.startsWith("Bearer ")) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    const token = raw.slice("Bearer ".length).trim();
    const payload = verifyStaffToken(token);
    const user = await prisma.staffUser.findFirst({
      where: { id: payload.sub, isActive: true },
      include: { role: true },
    });
    if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });
    req.staff = {
      id: user.id,
      email: user.email,
      permissions: user.role.permissions,
      roleKey: user.role.key,
    };
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
}

export function requireStaffPermission(permission: string) {
  return (req: StaffRequest, res: Response, next: NextFunction) => {
    const s = req.staff;
    if (!s) return res.status(401).json({ ok: false, error: "Unauthorized" });
    if (s.permissions.includes("*") || s.permissions.includes(permission)) return next();
    return res.status(403).json({ ok: false, error: "Forbidden" });
  };
}

/** Any one of the listed permissions (or *). */
export function requireStaffAnyPermission(...permissions: string[]) {
  return (req: StaffRequest, res: Response, next: NextFunction) => {
    const s = req.staff;
    if (!s) return res.status(401).json({ ok: false, error: "Unauthorized" });
    if (s.permissions.includes("*")) return next();
    if (permissions.some((p) => s.permissions.includes(p))) return next();
    return res.status(403).json({ ok: false, error: "Forbidden" });
  };
}
