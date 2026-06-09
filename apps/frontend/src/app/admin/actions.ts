"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { staffFetch } from "@/lib/admin-fetch";
import { STAFF_TOKEN_COOKIE } from "@/lib/staff-auth-cookie";

export async function adminCreateUserAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const roleId = String(formData.get("roleId") ?? "").trim();
  if (!email || !roleId) redirect("/admin?error=" + encodeURIComponent("Email and role required"));

  const res = await staffFetch("/api/v1/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name: name || undefined, roleId }),
  });
  if (!res) redirect("/admin/login");
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    redirect("/admin?error=" + encodeURIComponent(j.error ?? "Create failed"));
  }
  revalidatePath("/admin");
  redirect("/admin?created=1");
}

export async function adminUpdateUserAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "").trim();
  const roleId = String(formData.get("roleId") ?? "").trim();
  if (!userId) redirect("/admin?error=" + encodeURIComponent("Missing user"));

  const body: Record<string, unknown> = {};
  if (roleId) body.roleId = roleId;
  const activeRaw = String(formData.get("isActive") ?? "");
  if (activeRaw === "true" || activeRaw === "false") body.isActive = activeRaw === "true";

  const isPasswordLockedRaw = String(formData.get("isPasswordLocked") ?? "");
  if (isPasswordLockedRaw === "false") body.isPasswordLocked = false;

  const pwd = String(formData.get("password") ?? "").trim();
  if (pwd.length > 0) {
    if (pwd.length < 8) redirect("/admin?error=" + encodeURIComponent("Password min 8 characters"));
    body.password = pwd;
  }
  if (Object.keys(body).length === 0) redirect("/admin?error=" + encodeURIComponent("No changes"));

  const res = await staffFetch(`/api/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res) redirect("/admin/login");
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    redirect("/admin?error=" + encodeURIComponent(j.error ?? "Update failed"));
  }
  revalidatePath("/admin");
  redirect("/admin?updated=1");
}

export async function adminLogoutAction() {
  (await cookies()).delete(STAFF_TOKEN_COOKIE);
  redirect("/admin/login");
}

export async function adminCreateRoleAction(formData: FormData) {
  const key = String(formData.get("key") ?? "").trim().toLowerCase();
  const label = String(formData.get("label") ?? "").trim();
  const perms = formData.getAll("permissions").map(String);
  if (!key || !label) redirect("/admin/roles?error=" + encodeURIComponent("Key and label required"));

  const res = await staffFetch("/api/v1/admin/roles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, label, permissions: perms }),
  });
  if (!res) redirect("/admin/login");
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    redirect("/admin/roles?error=" + encodeURIComponent(j.error ?? "Create failed"));
  }
  revalidatePath("/admin/roles");
  revalidatePath("/admin");
  redirect("/admin/roles?created=1");
}

export async function adminPatchRoleAction(formData: FormData) {
  const roleId = String(formData.get("roleId") ?? "").trim();
  const roleKey = String(formData.get("roleKey") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const perms = formData.getAll("permissions").map(String);
  if (!roleId) redirect("/admin/roles?error=" + encodeURIComponent("Missing role"));

  const body: Record<string, unknown> = {};
  if (label) body.label = label;
  if (roleKey !== "admin") body.permissions = perms;

  if (Object.keys(body).length === 0) redirect("/admin/roles?error=" + encodeURIComponent("No changes"));

  const res = await staffFetch(`/api/v1/admin/roles/${encodeURIComponent(roleId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res) redirect("/admin/login");
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    redirect("/admin/roles?error=" + encodeURIComponent(j.error ?? "Update failed"));
  }
  revalidatePath("/admin/roles");
  revalidatePath("/admin");
  redirect("/admin/roles?updated=1");
}

export async function adminDeleteRoleAction(formData: FormData) {
  const roleId = String(formData.get("roleId") ?? "").trim();
  if (!roleId) redirect("/admin/roles?error=" + encodeURIComponent("Missing role"));

  const res = await staffFetch(`/api/v1/admin/roles/${encodeURIComponent(roleId)}`, {
    method: "DELETE",
  });
  if (!res) redirect("/admin/login");
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    redirect("/admin/roles?error=" + encodeURIComponent(j.error ?? "Delete failed"));
  }
  revalidatePath("/admin/roles");
  revalidatePath("/admin");
  redirect("/admin/roles?deleted=1");
}
