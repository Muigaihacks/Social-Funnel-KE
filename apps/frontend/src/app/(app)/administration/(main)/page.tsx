import Link from "next/link";
import { redirect } from "next/navigation";
import { PasswordInput } from "@/components/PasswordInput";
import { staffFetch } from "@/lib/admin-fetch";
import { adminCreateUserAction, adminLogoutAction, adminUpdateUserAction } from "../actions";

type Role = { id: string; key: string; label: string; permissions?: string[]; isSystem?: boolean; userCount?: number };
type UserRow = {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  isPasswordLocked: boolean;
  passwordChangeCount: number;
  roleId: string;
  roleKey: string;
  roleLabel: string;
};

function can(permissions: string[], id: string) {
  return permissions.includes("*") || permissions.includes(id);
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; updated?: string }>;
}) {
  const sp = await searchParams;
  const meRes = await staffFetch("/api/v1/auth/me");
  if (!meRes?.ok) redirect("/admin/login");

  const meJson = (await meRes.json()) as {
    user: { email: string; roleKey: string; roleLabel: string; permissions: string[] };
  };

  const usersRes = await staffFetch("/api/v1/admin/users");
  if (usersRes?.status === 401) redirect("/admin/login");
  if (usersRes?.status === 403) {
    return (
      <main className="min-h-screen px-4 pb-20 md:px-8">
        <div className="mx-auto max-w-lg pt-24 text-center text-[var(--foreground)]">
          <p className="text-sm text-[var(--text-muted)]">You do not have permission to manage staff users.</p>
          <Link href="/" className="mt-4 inline-block text-sm text-[var(--sf-teal)] hover:underline">
            ← Dashboard
          </Link>
        </div>
      </main>
    );
  }
  if (!usersRes?.ok) redirect("/admin/login");

  const rolesRes = await staffFetch("/api/v1/admin/roles");
  if (!rolesRes?.ok) redirect("/admin/login");

  const usersJson = (await usersRes.json()) as { items: UserRow[] };
  const rolesJson = (await rolesRes.json()) as { items: Role[] };

  const showRolesLink = can(meJson.user.permissions, "admin.roles");

  return (
    <main className="min-h-screen px-4 pb-20 md:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-col gap-4 border-b border-[var(--card-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--foreground)] md:text-3xl">Administration</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Signed in as <span className="text-[var(--foreground)]">{meJson.user.email}</span> ·{" "}
              <span className="capitalize">{meJson.user.roleLabel}</span> ({meJson.user.roleKey})
            </p>
            <nav className="mt-4 flex flex-wrap gap-3 text-sm">
              {showRolesLink ? (
                <Link
                  href="/admin/roles"
                  className="rounded-full bg-[var(--sf-teal)] px-4 py-2 font-semibold text-[var(--background)] hover:opacity-90 transition-opacity"
                >
                  Roles &amp; permissions
                </Link>
              ) : null}
              <Link
                href="/admin/change-password"
                className="rounded-full bg-[var(--sf-teal)] px-4 py-2 font-semibold text-[var(--background)] hover:opacity-90 transition-opacity"
              >
                Change password
              </Link>
            </nav>
          </div>
          <form action={adminLogoutAction}>
            <button
              type="submit"
              className="rounded-full border border-[var(--card-border)] px-4 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--card-surface)]"
            >
              Sign out
            </button>
          </form>
        </header>

        {sp.error ? (
          <div className="mb-6 rounded-2xl border border-semantic-danger/40 bg-semantic-danger/10 px-4 py-3 text-sm text-[var(--foreground)]">
            {decodeURIComponent(sp.error)}
          </div>
        ) : null}
        {sp.created ? (
          <div className="mb-6 rounded-2xl border border-semantic-success/40 bg-semantic-success/10 px-4 py-3 text-sm text-[var(--foreground)]">
            User created. An email has been sent to them with a link to set their password.
          </div>
        ) : null}
        {sp.updated ? (
          <div className="mb-6 rounded-2xl border border-semantic-success/40 bg-semantic-success/10 px-4 py-3 text-sm text-[var(--foreground)]">
            User updated.
          </div>
        ) : null}

        <section className="mb-10 rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-4 md:p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Create staff user</h2>
          <p className="mt-2 text-xs text-[var(--text-dim)]">
            An email will be sent to the new user with a link to set their password and log in.
          </p>
          <form action={adminCreateUserAction} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-[var(--text-muted)]">
              Email
              <input
                name="email"
                type="email"
                required
                className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)]"
              />
            </label>
            <label className="text-xs text-[var(--text-muted)]">
              Name (optional)
              <input
                name="name"
                type="text"
                className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)]"
              />
            </label>
            <label className="text-xs text-[var(--text-muted)] sm:col-span-2">
              Role
              <select
                name="roleId"
                required
                className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)]"
              >
                {rolesJson.items.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label} ({r.key})
                  </option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="rounded-full border border-[var(--sf-teal)]/50 bg-[var(--sf-teal)]/15 px-4 py-2 text-sm font-medium text-[var(--sf-teal)]"
              >
                Create user
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-4 md:p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Staff users</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--card-border)] text-xs text-[var(--text-muted)]">
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2">Status &amp; updates</th>
                </tr>
              </thead>
              <tbody>
                {usersJson.items.map((u) => (
                  <tr key={u.id} className="border-b border-[var(--chart-grid)]">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-[var(--foreground)]">{u.email}</div>
                      <div className="text-xs text-[var(--text-muted)]">{u.name ?? "—"}</div>
                      {!u.isActive ? <span className="text-xs text-semantic-danger">Inactive · cannot sign in</span> : null}
                      {u.mustChangePassword ? (
                        <span className="ml-0 mt-0.5 block text-xs text-semantic-warning">Must change password</span>
                      ) : null}
                      {u.isPasswordLocked ? (
                        <span className="ml-0 mt-0.5 block text-xs text-semantic-danger font-semibold">🔒 Account Locked (Too many resets)</span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 text-[var(--text-muted)]">
                      {u.roleLabel}{" "}
                      <span className="font-mono text-[10px] opacity-70">({u.roleKey})</span>
                    </td>
                    <td className="py-3">
                      <form action={adminUpdateUserAction} className="flex max-w-xl flex-col gap-2">
                        <input type="hidden" name="userId" value={u.id} />
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            name="roleId"
                            defaultValue={u.roleId}
                            className="rounded-lg border border-[var(--card-border)] bg-[var(--input-bg)] px-2 py-1 text-xs text-[var(--foreground)]"
                          >
                            {rolesJson.items.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                          <select
                            name="isActive"
                            defaultValue={u.isActive ? "true" : "false"}
                            className="rounded-lg border border-[var(--card-border)] bg-[var(--input-bg)] px-2 py-1 text-xs text-[var(--foreground)]"
                          >
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                          </select>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <PasswordInput
                            name="password"
                            placeholder="New password (optional)"
                            wrapperClassName="min-w-[10rem] flex-1"
                            className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--input-bg)] px-2 py-1 text-xs text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:border-sf-teal/50 focus:outline-none"
                          />
                          <button
                            type="submit"
                            className="rounded-full border border-[var(--card-border)] px-3 py-1 text-xs text-[var(--foreground)] hover:bg-[var(--row-bg-hover)]"
                          >
                            Save
                          </button>
                        </div>
                        {u.isPasswordLocked && (
                          <div className="flex items-center gap-2 mt-1">
                            <input type="hidden" name="isPasswordLocked" value="false" />
                            <button
                              type="submit"
                              className="rounded-full border border-semantic-success/50 bg-semantic-success/10 px-3 py-1 text-xs text-semantic-success hover:bg-semantic-success/20"
                            >
                              Unlock Account
                            </button>
                          </div>
                        )}
                        <p className="text-[10px] text-[var(--text-faint)]">
                          Setting a password for someone else requires a password change on their next login.
                        </p>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="mt-8 text-center text-xs text-[var(--text-muted)]">
          <Link href="/analytics" className="text-[var(--sf-teal)] hover:underline">
            ← Analytics
          </Link>
        </p>
      </div>
    </main>
  );
}
