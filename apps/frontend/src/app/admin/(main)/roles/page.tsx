import Link from "next/link";
import { redirect } from "next/navigation";
import { staffFetch } from "@/lib/admin-fetch";
import {
  adminCreateRoleAction,
  adminDeleteRoleAction,
  adminLogoutAction,
  adminPatchRoleAction,
} from "../../actions";

type Perm = { id: string; label: string };
type PermGroup = { id: string; label: string; permissions: Perm[] };
type RoleRow = {
  id: string;
  key: string;
  label: string;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
};

function can(permissions: string[], id: string) {
  return permissions.includes("*") || permissions.includes(id);
}

function PermissionCheckboxes({
  groups,
  selected,
}: {
  groups: PermGroup[];
  selected: Set<string>;
}) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {groups.map((g) => (
        <fieldset key={g.id} className="rounded-xl border border-[var(--card-border)] bg-[var(--row-bg)] p-3">
          <legend className="px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {g.label}
          </legend>
          <div className="mt-2 flex flex-col gap-2">
            {g.permissions.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2 text-xs text-[var(--foreground)]">
                <input type="checkbox" name="permissions" value={p.id} defaultChecked={selected.has(p.id)} className="rounded" />
                <span>{p.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export default async function AdminRolesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; updated?: string; deleted?: string }>;
}) {
  const sp = await searchParams;
  const meRes = await staffFetch("/api/v1/auth/me");
  if (!meRes?.ok) redirect("/admin/login");
  const meJson = (await meRes.json()) as { user: { permissions: string[]; email: string; roleLabel: string; roleKey: string } };

  if (!can(meJson.user.permissions, "admin.roles")) redirect("/admin");

  const rolesRes = await staffFetch("/api/v1/admin/roles");
  if (!rolesRes?.ok) redirect("/admin/login");

  const rolesBody = (await rolesRes.json()) as { items: RoleRow[]; groups: PermGroup[] };
  const { items: roles, groups } = rolesBody;

  return (
    <main className="min-h-screen px-4 pb-20 md:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-col gap-4 border-b border-[var(--card-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--foreground)] md:text-3xl">Roles &amp; permissions</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {meJson.user.roleLabel} · map each role to dashboard modules (like Filament, trimmed to this app).
            </p>
            <nav className="mt-3 flex flex-wrap gap-2 text-xs">
              <Link
                href="/admin"
                className="rounded-full border border-[var(--card-border)] px-3 py-1 text-[var(--text-muted)] hover:bg-[var(--card-surface)]"
              >
                ← Staff users
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
            Role created.
          </div>
        ) : null}
        {sp.updated ? (
          <div className="mb-6 rounded-2xl border border-semantic-success/40 bg-semantic-success/10 px-4 py-3 text-sm text-[var(--foreground)]">
            Role updated.
          </div>
        ) : null}
        {sp.deleted ? (
          <div className="mb-6 rounded-2xl border border-semantic-success/40 bg-semantic-success/10 px-4 py-3 text-sm text-[var(--foreground)]">
            Role deleted.
          </div>
        ) : null}

        <section className="mb-10 rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-4 md:p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">New role</h2>
          <p className="mt-2 text-xs text-[var(--text-dim)]">
            Key is permanent (lower_snake_case). Labels are shown in the admin UI.
          </p>
          <form action={adminCreateRoleAction} className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-[var(--text-muted)]">
                Key
                <input
                  name="key"
                  required
                  pattern="[a-z][a-z0-9_]{1,48}"
                  placeholder="sales_lead"
                  className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 py-2 font-mono text-sm text-[var(--foreground)]"
                />
              </label>
              <label className="text-xs text-[var(--text-muted)]">
                Label
                <input
                  name="label"
                  required
                  className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)]"
                />
              </label>
            </div>
            <PermissionCheckboxes groups={groups} selected={new Set()} />
            <button
              type="submit"
              className="rounded-full border border-[var(--sf-teal)]/50 bg-[var(--sf-teal)]/15 px-4 py-2 text-sm font-medium text-[var(--sf-teal)]"
            >
              Create role
            </button>
          </form>
        </section>

        <section className="space-y-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Existing roles</h2>
          {roles.map((r) => (
            <div key={r.id} className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-[var(--foreground)]">{r.label}</h3>
                  <p className="font-mono text-xs text-[var(--text-muted)]">
                    {r.key}
                    {r.isSystem ? (
                      <span className="ml-2 rounded-full bg-[var(--chart-grid)] px-2 py-0.5 text-[10px] text-[var(--text-dim)]">
                        Built-in
                      </span>
                    ) : null}
                    <span className="ml-2 text-[var(--text-faint)]">{r.userCount} user(s)</span>
                  </p>
                </div>
                {!r.isSystem && r.userCount === 0 ? (
                  <form action={adminDeleteRoleAction}>
                    <input type="hidden" name="roleId" value={r.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-semantic-danger/30 px-3 py-1 text-xs text-semantic-danger hover:bg-semantic-danger/10"
                    >
                      Delete
                    </button>
                  </form>
                ) : null}
              </div>

              <form action={adminPatchRoleAction} className="mt-4 border-t border-[var(--chart-grid)] pt-4">
                <input type="hidden" name="roleId" value={r.id} />
                <input type="hidden" name="roleKey" value={r.key} />
                <label className="text-xs text-[var(--text-muted)]">
                  Display label
                  <input
                    name="label"
                    defaultValue={r.label}
                    className="mt-1 w-full max-w-md rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)]"
                  />
                </label>
                {r.key === "admin" ? (
                  <p className="mt-4 text-xs text-[var(--text-dim)]">
                    Super Admin always has full access (<code className="text-[var(--text-muted)]">*</code> in the API). You can
                    rename the label only.
                  </p>
                ) : (
                  <PermissionCheckboxes groups={groups} selected={new Set(r.permissions)} />
                )}
                <button
                  type="submit"
                  className="mt-4 rounded-full border border-[var(--card-border)] px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--row-bg-hover)]"
                >
                  Save role
                </button>
              </form>
            </div>
          ))}
        </section>

        <p className="mt-10 text-center text-xs text-[var(--text-muted)]">
          <Link href="/" className="text-[var(--sf-teal)] hover:underline">
            ← Dashboard
          </Link>
        </p>
      </div>
    </main>
  );
}
