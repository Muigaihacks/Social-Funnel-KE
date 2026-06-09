import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../lib/db.js";
import { ensureDefaultStaffRoles } from "../lib/staffRoles.js";
import { normalizePermissionList, STAFF_PERMISSION_GROUPS } from "../lib/permissionCatalog.js";
import { requireStaff, requireStaffAnyPermission, requireStaffPermission, type StaffRequest } from "../middleware/staffAuth.js";
import { sendPasswordResetEmail } from "../lib/mailer.js";

const router = Router();

router.use(requireStaff);

const KeySchema = z.string().regex(/^[a-z][a-z0-9_]{1,48}$/, "Use lowercase letters, numbers, underscore (2–49 chars)");

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional(),
  roleId: z.string().min(1),
});

const PatchUserSchema = z.object({
  name: z.string().max(120).optional(),
  roleId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
  isPasswordLocked: z.boolean().optional(),
});

const CreateRoleSchema = z.object({
  key: KeySchema,
  label: z.string().min(1).max(120),
  permissions: z.array(z.string()).default([]),
});

const PatchRoleSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  permissions: z.array(z.string()).optional(),
});

router.get("/roles", requireStaffAnyPermission("admin.users", "admin.roles"), async (_req, res) => {
  await ensureDefaultStaffRoles();
  const roles = await prisma.staffRole.findMany({
    orderBy: { key: "asc" },
    include: { _count: { select: { users: true } } },
  });
  return res.json({
    ok: true,
    groups: STAFF_PERMISSION_GROUPS,
    items: roles.map((r) => ({
      id: r.id,
      key: r.key,
      label: r.label,
      permissions: r.permissions,
      isSystem: r.isSystem,
      userCount: r._count.users,
    })),
  });
});

router.post("/roles", requireStaffPermission("admin.roles"), async (req, res) => {
  try {
    const body = CreateRoleSchema.parse(req.body ?? {});
    const key = body.key.trim().toLowerCase();
    const perms = normalizePermissionList(body.permissions ?? []);
    const exists = await prisma.staffRole.findUnique({ where: { key } });
    if (exists) return res.status(400).json({ ok: false, error: "Role key already exists" });

    const role = await prisma.staffRole.create({
      data: {
        key,
        label: body.label.trim(),
        permissions: perms,
        isSystem: false,
      },
    });
    return res.status(201).json({ ok: true, role: { id: role.id, key: role.key, label: role.label, permissions: role.permissions } });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

router.patch("/roles/:roleId", requireStaffPermission("admin.roles"), async (req, res) => {
  try {
    const { roleId } = req.params;
    const body = PatchRoleSchema.parse(req.body ?? {});
    const existing = await prisma.staffRole.findUnique({ where: { id: roleId } });
    if (!existing) return res.status(404).json({ ok: false, error: "Role not found" });

    const data: { label?: string; permissions?: string[] } = {};
    if (body.label !== undefined) data.label = body.label.trim();
    if (body.permissions !== undefined) {
      let perms = normalizePermissionList(body.permissions);
      if (existing.key === "admin") perms = ["*"];
      data.permissions = perms;
    }

    if (Object.keys(data).length === 0) return res.status(400).json({ ok: false, error: "No changes" });

    const updated = await prisma.staffRole.update({ where: { id: roleId }, data });
    return res.json({ ok: true, role: { id: updated.id, key: updated.key, label: updated.label, permissions: updated.permissions } });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

router.delete("/roles/:roleId", requireStaffPermission("admin.roles"), async (req, res) => {
  try {
    const { roleId } = req.params;
    const existing = await prisma.staffRole.findUnique({
      where: { id: roleId },
      include: { _count: { select: { users: true } } },
    });
    if (!existing) return res.status(404).json({ ok: false, error: "Role not found" });
    if (existing.isSystem) return res.status(400).json({ ok: false, error: "Cannot delete a built-in role" });
    if (existing._count.users > 0) {
      return res.status(400).json({ ok: false, error: "Reassign users before deleting this role" });
    }
    await prisma.staffRole.delete({ where: { id: roleId } });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

router.get("/users", requireStaffPermission("admin.users"), async (_req, res) => {
  const users = await prisma.staffUser.findMany({
    orderBy: { createdAt: "desc" },
    include: { role: true },
  });
  return res.json({
    ok: true,
    items: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      isActive: u.isActive,
      mustChangePassword: u.mustChangePassword,
      isPasswordLocked: u.isPasswordLocked,
      passwordChangeCount: u.passwordChangeCount,
      roleId: u.roleId,
      roleKey: u.role.key,
      roleLabel: u.role.label,
      createdAt: u.createdAt,
    })),
  });
});

router.post("/users", requireStaffPermission("admin.users"), async (req: StaffRequest, res) => {
  try {
    const body = CreateUserSchema.parse(req.body ?? {});
    const email = body.email.trim().toLowerCase();
    const exists = await prisma.staffUser.findUnique({ where: { email } });
    if (exists) return res.status(400).json({ ok: false, error: "Email already in use" });

    const role = await prisma.staffRole.findUnique({ where: { id: body.roleId } });
    if (!role) return res.status(400).json({ ok: false, error: "Invalid role" });

    // Generate a dummy password hash since the user will set it via email link
    const dummyPassword = crypto.randomBytes(32).toString("hex");
    const passwordHash = await bcrypt.hash(dummyPassword, 11);
    
    const user = await prisma.staffUser.create({
      data: {
        email,
        passwordHash,
        name: body.name?.trim() ?? null,
        roleId: role.id,
        mustChangePassword: true,
      },
      include: { role: true },
    });

    // Generate reset token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    // Send email
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetLink = `${frontendUrl}/admin/reset-password?token=${token}`;
    await sendPasswordResetEmail(user.email, resetLink);

    return res.status(201).json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roleKey: user.role.key,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

router.patch("/users/:userId", requireStaffPermission("admin.users"), async (req: StaffRequest, res) => {
  try {
    const { userId } = req.params;
    const body = PatchUserSchema.parse(req.body ?? {});

    if (req.staff?.id === userId && body.isActive === false) {
      return res.status(400).json({ ok: false, error: "You cannot deactivate yourself" });
    }

    const existing = await prisma.staffUser.findUnique({ where: { id: userId } });
    if (!existing) return res.status(404).json({ ok: false, error: "User not found" });

    const data: {
      name?: string | null;
      roleId?: string;
      isActive?: boolean;
      passwordHash?: string;
      mustChangePassword?: boolean;
      isPasswordLocked?: boolean;
      passwordChangeCount?: number;
    } = {};

    if (body.name !== undefined) data.name = body.name.trim() || null;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.roleId) {
      const role = await prisma.staffRole.findUnique({ where: { id: body.roleId } });
      if (!role) return res.status(400).json({ ok: false, error: "Invalid role" });
      data.roleId = role.id;
    }
    if (body.password) {
      data.passwordHash = await bcrypt.hash(body.password, 11);
      data.mustChangePassword = userId !== req.staff?.id;
      // If admin resets password, also unlock the user and reset their change count
      data.isPasswordLocked = false;
      data.passwordChangeCount = 0;
    } else if (body.isPasswordLocked !== undefined) {
      data.isPasswordLocked = body.isPasswordLocked;
      if (!body.isPasswordLocked) {
        data.passwordChangeCount = 0; // Reset count on unlock
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ ok: false, error: "No changes" });
    }

    await prisma.staffUser.update({ where: { id: userId }, data });

    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

export { router as adminRouter };
