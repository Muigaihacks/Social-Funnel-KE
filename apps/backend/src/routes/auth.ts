import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../lib/db.js";
import { signStaffToken } from "../lib/jwt.js";
import { ensureDefaultStaffRoles } from "../lib/staffRoles.js";
import { requireStaff, type StaffRequest } from "../middleware/staffAuth.js";
import { sendPasswordResetEmail } from "../lib/mailer.js";

const router = Router();

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

const BootstrapSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().max(120).optional(),
  secret: z.string().min(1),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

function staffUserJson(user: { id: string; email: string; name: string | null; roleKey: string; mustChangePassword: boolean }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roleKey: user.roleKey,
    mustChangePassword: user.mustChangePassword,
  };
}

function internalBootstrapSecretOk(secret: string): boolean {
  const expected = process.env.INTERNAL_AUTOMATION_SECRET;
  if (!expected || expected.length === 0) return false;
  return secret === expected;
}

/** First admin user when DB is empty (requires INTERNAL_AUTOMATION_SECRET). */
router.post("/bootstrap", async (req, res) => {
  try {
    const body = BootstrapSchema.parse(req.body ?? {});
    if (!internalBootstrapSecretOk(body.secret)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    await ensureDefaultStaffRoles();
    const count = await prisma.staffUser.count();
    if (count > 0) {
      return res.status(400).json({ ok: false, error: "Staff users already exist — bootstrap is disabled" });
    }

    const adminRole = await prisma.staffRole.findUnique({ where: { key: "admin" } });
    if (!adminRole) {
      return res.status(500).json({ ok: false, error: "Admin role missing" });
    }

    const passwordHash = await bcrypt.hash(body.password, 11);
    const user = await prisma.staffUser.create({
      data: {
        email: body.email.trim().toLowerCase(),
        passwordHash,
        name: body.name?.trim() ?? null,
        roleId: adminRole.id,
        mustChangePassword: false,
      },
      include: { role: true },
    });

    const token = signStaffToken({
      sub: user.id,
      email: user.email,
      permissions: user.role.permissions,
      roleKey: user.role.key,
    });

    return res.status(201).json({
      ok: true,
      token,
      user: staffUserJson({
        id: user.id,
        email: user.email,
        name: user.name,
        roleKey: user.role.key,
        mustChangePassword: user.mustChangePassword,
      }),
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    await ensureDefaultStaffRoles();
    const body = LoginSchema.parse(req.body ?? {});
    const email = body.email.trim().toLowerCase();
    const user = await prisma.staffUser.findFirst({
      where: { email, isActive: true },
      include: { role: true },
    });
    if (!user) {
      return res.status(401).json({ ok: false, error: "Invalid email or password" });
    }
    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) return res.status(401).json({ ok: false, error: "Invalid email or password" });

    const token = signStaffToken({
      sub: user.id,
      email: user.email,
      permissions: user.role.permissions,
      roleKey: user.role.key,
    });

    return res.json({
      ok: true,
      token,
      user: staffUserJson({
        id: user.id,
        email: user.email,
        name: user.name,
        roleKey: user.role.key,
        mustChangePassword: user.mustChangePassword,
      }),
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const body = ForgotPasswordSchema.parse(req.body ?? {});
    const email = body.email.trim().toLowerCase();
    const user = await prisma.staffUser.findFirst({
      where: { email, isActive: true },
    });

    // Don't reveal if user exists or not for security, but proceed if they do
    if (user) {
      if (user.isPasswordLocked) {
        // We could return an error, but standard practice is to not reveal account status
        // Alternatively, we could email them saying their account is locked and to contact admin.
        // For now, we'll just not send the reset link if locked.
        console.log(`User ${email} requested reset but is locked.`);
      } else {
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await prisma.passwordResetToken.create({
          data: {
            token,
            userId: user.id,
            expiresAt,
          },
        });

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        const resetLink = `${frontendUrl}/admin/reset-password?token=${token}`;
        await sendPasswordResetEmail(user.email, resetLink);
      }
    }

    return res.json({ ok: true, message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const body = ResetPasswordSchema.parse(req.body ?? {});
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: body.token },
      include: { user: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return res.status(400).json({ ok: false, error: "Invalid or expired token" });
    }

    if (resetToken.user.isPasswordLocked) {
      return res.status(403).json({ ok: false, error: "Account is locked. Please contact an admin." });
    }

    const passwordHash = await bcrypt.hash(body.password, 11);

    // Update user and mark token as used
    await prisma.$transaction([
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.passwordHistory.create({
        data: {
          userId: resetToken.user.id,
          passwordHash,
        },
      }),
      prisma.staffUser.update({
        where: { id: resetToken.user.id },
        data: {
          passwordHash,
          mustChangePassword: false,
          passwordChangeCount: { increment: 1 },
          isPasswordLocked: resetToken.user.passwordChangeCount + 1 >= 3,
        },
      }),
    ]);

    return res.json({ ok: true, message: "Password reset successfully" });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

router.post("/change-password", requireStaff, async (req: StaffRequest, res) => {
  try {
    const body = ChangePasswordSchema.parse(req.body ?? {});
    const user = await prisma.staffUser.findUnique({
      where: { id: req.staff!.id, isActive: true },
      include: { role: true },
    });
    if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });

    if (user.isPasswordLocked) {
      return res.status(403).json({ ok: false, error: "Account is locked. Please contact an admin." });
    }

    const match = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!match) return res.status(401).json({ ok: false, error: "Current password is incorrect" });

    const passwordHash = await bcrypt.hash(body.newPassword, 11);
    
    // Create history and update user
    await prisma.passwordHistory.create({
      data: {
        userId: user.id,
        passwordHash,
      },
    });

    const newCount = user.passwordChangeCount + 1;
    const isLocked = newCount >= 3;

    const updated = await prisma.staffUser.update({
      where: { id: user.id },
      data: { 
        passwordHash, 
        mustChangePassword: false,
        passwordChangeCount: newCount,
        isPasswordLocked: isLocked,
      },
      include: { role: true },
    });

    const token = signStaffToken({
      sub: updated.id,
      email: updated.email,
      permissions: updated.role.permissions,
      roleKey: updated.role.key,
    });

    return res.json({
      ok: true,
      token,
      user: staffUserJson({
        id: updated.id,
        email: updated.email,
        name: updated.name,
        roleKey: updated.role.key,
        mustChangePassword: updated.mustChangePassword,
      }),
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

router.get("/me", requireStaff, async (req: StaffRequest, res) => {
  const s = req.staff!;
  const user = await prisma.staffUser.findFirst({
    where: { id: s.id },
    include: { role: true },
  });
  if (!user) return res.status(404).json({ ok: false, error: "Not found" });
  return res.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      roleKey: user.role.key,
      roleLabel: user.role.label,
      permissions: user.role.permissions,
      mustChangePassword: user.mustChangePassword,
    },
  });
});

export { router as authRouter };
